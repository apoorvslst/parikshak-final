# ==============================================================================
# INSTRUCTIONS FOR GOOGLE COLAB:
# 1. Copy this entire script.
# 2. Paste it into a code cell in Google Colab (https://colab.research.google.com).
# 3. Replace 'ENTER_YOUR_NGROK_TOKEN_HERE' with your actual ngrok token.
# 4. Run the cell.
# 5. Copy the 'public_url' printed at the end (e.g., https://xyz.ngrok-free.app)
#    and paste it into your JSX React Application.
# ==============================================================================

import os
import sys
import subprocess
import shutil

# --- 1. CLEANUP & INSTALL ---
print("🚀 Cleaning environment and installing dependencies...")

# Uninstall speechbrain to prevent conflicts
subprocess.run([sys.executable, "-m", "pip", "uninstall", "-y", "speechbrain"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

# Install required libraries including panns-inference for noise detection
packages = [
    "torch",
    "torchaudio",
    "transformers",
    "fastapi", 
    "uvicorn", 
    "python-multipart", 
    "librosa", 
    "pyngrok", 
    "nest_asyncio", 
    "soundfile", 
    "huggingface_hub",
    "accelerate",
    "panns-inference" # Official PANNs wrapper
]

subprocess.check_call([sys.executable, "-m", "pip", "install"] + packages + ["--upgrade", "-q"])

# --- 2. IMPORTS ---
import torch
import torch.nn as nn
import librosa
import numpy as np
import uvicorn
import nest_asyncio
import asyncio
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from transformers import AutoProcessor, Wav2Vec2PreTrainedModel, Wav2Vec2Model
from huggingface_hub import login
from pyngrok import ngrok
from typing import List, Dict

# Import PANNs
from panns_inference import AudioTagging, labels

# --- 3. CUSTOM EMOTION MODEL CLASS ---
class Wav2Vec2ClassificationHead(nn.Module):
    """Head for wav2vec classification task."""
    def __init__(self, config):
        super().__init__()
        self.dense = nn.Linear(config.hidden_size, config.hidden_size)
        self.dropout = nn.Dropout(config.final_dropout)
        self.out_proj = nn.Linear(config.hidden_size, config.num_labels)

    def forward(self, features, **kwargs):
        x = features
        x = self.dropout(x)
        x = self.dense(x)
        x = torch.tanh(x)
        x = self.dropout(x)
        x = self.out_proj(x)
        return x

class Wav2Vec2ForSpeechClassification(Wav2Vec2PreTrainedModel):
    def __init__(self, config):
        super().__init__(config)
        self.num_labels = config.num_labels
        self.pooling_mode = config.pooling_mode
        self.wav2vec2 = Wav2Vec2Model(config)
        self.classifier = Wav2Vec2ClassificationHead(config)
        self.init_weights()

    def forward(self, input_values, attention_mask=None):
        outputs = self.wav2vec2(input_values, attention_mask=attention_mask)
        hidden_states = outputs[0]
        hidden_states = torch.mean(hidden_states, dim=1)
        logits = self.classifier(hidden_states)
        return logits

# --- 4. CONFIGURATION ---
# ⚠️ REPLACE WITH YOUR NGROK TOKEN
NGROK_AUTH_TOKEN = os.environ.get("VITE_NGROK_AUTH_TOKEN")
# Your provided Hugging Face Token
HF_TOKEN = os.environ.get("VITE_HF_TOKEN")

MODEL_ID = "audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim"
CHUNK_DURATION = 30  # seconds

# --- 5. AUTH & MODEL LOADING ---
print(f"\n🔑 Logging into Hugging Face...")
try:
    login(token=HF_TOKEN)
except:
    pass

# A. Load Emotion Model
print(f"🔄 Loading Emotion Model: {MODEL_ID}...")
try:
    processor = AutoProcessor.from_pretrained(MODEL_ID, token=HF_TOKEN)
    emotion_model = Wav2Vec2ForSpeechClassification.from_pretrained(MODEL_ID, token=HF_TOKEN)
    emotion_model.eval() 
    print("✅ Emotion Model loaded successfully!")
except Exception as e:
    print(f"❌ Error loading emotion model: {e}")
    sys.exit(1)

# B. Load PANNs (Noise/Event) Model
print(f"🔄 Loading PANNs (CNN14) Model for Background Noise...")
try:
    # Check for GPU
    device = "cuda" if torch.cuda.is_available() else "cpu"
    # AudioTagging automatically downloads the official Cnn14_mAP=0.431.pth
    panns_model = AudioTagging(checkpoint_path=None, device=device)
    print("✅ PANNs Model loaded successfully!")
except Exception as e:
    print(f"❌ Error loading PANNs model: {e}")
    sys.exit(1)

# --- 6. AUDIO PROCESSING LOGIC ---
def process_audio_chunks(file_path: str, chunk_len: int = 30) -> List[Dict]:
    """
    Splits audio into 'chunk_len' second segments.
    Analyzes Emotion (Wav2Vec2) and Background Noise (PANNs).
    """
    # Load audio at 16kHz (Standard for both models)
    try:
        y, sr = librosa.load(file_path, sr=16000)
    except Exception as e:
        print(f"Librosa Load Error: {e}")
        return []
    
    total_samples = len(y)
    samples_per_chunk = chunk_len * sr
    results = []
    
    print(f"   Processing {total_samples} samples in chunks...")

    for i in range(0, total_samples, samples_per_chunk):
        chunk = y[i : i + samples_per_chunk]
        
        # Skip tiny chunks (< 1 sec)
        if len(chunk) < 1 * sr:
            continue
            
        # --- 1. Emotion Analysis ---
        inputs = processor(chunk, sampling_rate=16000, return_tensors="pt", padding=True)
        with torch.no_grad():
            emotion_logits = emotion_model(input_values=inputs.input_values)
        emotion_scores = emotion_logits[0].numpy().tolist()
        
        # --- 2. PANNs Noise Analysis ---
        # PANNs expects shape (batch_size, time_steps)
        chunk_input = chunk[None, :] 
        # inference returns (clipwise_output, embedding)
        clipwise_output, _ = panns_model.inference(chunk_input)
        
        # Get top 20 detected sound events to capture detailed classroom environment
        # e.g., Speech, Whispering, Coughing, Chair moving, Paper, Writing, Laughter
        top_indices = np.argsort(clipwise_output[0])[::-1][:20]
        top_events = []
        for idx in top_indices:
            top_events.append({
                "label": labels[idx],
                "score": round(float(clipwise_output[0][idx]), 4)
            })

        # --- 3. Compile Results ---
        start_sec = i / sr
        end_sec = (i + len(chunk)) / sr
        
        results.append({
            "chunk_id": i // samples_per_chunk + 1,
            "start": round(start_sec, 2),
            "end": round(end_sec, 2),
            "emotions": {
                "arousal": round(emotion_scores[0], 4),   
                "dominance": round(emotion_scores[1], 4), 
                "valence": round(emotion_scores[2], 4)    
            },
            "classroom_events": top_events
        })
        
    return results

# --- 7. FASTAPI SETUP ---
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"status": "Online", "models": ["Wav2Vec2-Emotion", "PANNs-CNN14"]}

@app.post("/analyze")
async def analyze_endpoint(file: UploadFile = File(...)):
    temp_filename = f"temp_{file.filename}"
    try:
        # Save file to disk temporarily
        with open(temp_filename, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Process
        analysis = process_audio_chunks(temp_filename, CHUNK_DURATION)
        
        # Cleanup
        os.remove(temp_filename)
        
        return JSONResponse(content={
            "filename": file.filename,
            "total_chunks": len(analysis),
            "results": analysis
        })
        
    except Exception as e:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
        # Detailed error logging
        print(f"Server Error: {str(e)}")
        return HTTPException(status_code=500, detail=str(e))

# --- 8. RUN SERVER ---
if __name__ == "__main__":
    if NGROK_AUTH_TOKEN == "ENTER_YOUR_NGROK_TOKEN_HERE":
        print("\n❌ ERROR: You must edit the script to add your Ngrok Token first.\n")
    else:
        # Set auth token
        ngrok.set_auth_token(NGROK_AUTH_TOKEN)
        ngrok.kill() # Kill any existing tunnels
        
        # Start tunnel
        public_url = ngrok.connect(8000).public_url
        print("\n" + "="*60)
        print(f"🚀 SERVER IS LIVE!")
        print(f"🔗 Public URL: {public_url}")
        print(f"👉 Copy this URL into the Server URL field in your React App.")
        print(f"👉 Endpoint is: {public_url}/analyze")
        print("="*60 + "\n")
        
        # Apply nested asyncio for Colab
        nest_asyncio.apply()
        
        # Run server using config.serve() instead of run() to avoid event loop errors in Colab
        config = uvicorn.Config(app, port=8000)
        server = uvicorn.Server(config)
        loop = asyncio.get_event_loop()
        loop.run_until_complete(server.serve())