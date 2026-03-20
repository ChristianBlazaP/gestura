# Filipino Sign Language (FSL) Dataset & Model Guide

## Overview
This guide outlines how to create and train a Filipino Sign Language (FSL) gesture recognition model for the Gestura platform.

## Dataset Collection

### Target Vocabulary
**Phase 1 (MVP):** 50-100 common FSL gestures including:
- Common phrases: "hello", "thank you", "yes", "no", "sorry"
- Numbers: 0-10
- Emotions: happy, sad, angry, confused
- Actions: eat, drink, sleep, walk, run

### Collection Protocol
1. **Signers:** 20-50 native or fluent FSL users from Pasay City
2. **Samples per gesture:** 50-100 video recordings per gesture per signer
3. **Setup:**
   - Camera: Webcam or smartphone, 30 fps, 720p minimum
   - Lighting: Well-lit indoor environment (avoid shadows)
   - Background: Neutral, non-distracting
   - Framing: Full hand visibility, arm movement visible
4. **Metadata:**
   - Signer ID (anonymized)
   - Gender (optional, for research)
   - Handedness
   - Age range (for demographic analysis)
   - Gesture label
   - Confidence rating by signer

### Consent & Privacy
- All signers must provide written informed consent
- Store videos separately from metadata
- Use anonymized IDs (e.g., Signer001)
- Option for local-only processing (videos never uploaded)

## Data Preprocessing

### MediaPipe Landmark Extraction
1. Extract 21-point hand landmarks per frame
2. Normalize landmarks:
   - Translate so wrist is at origin
   - Scale by hand size (distance wrist to middle finger)
   - Optional: rotate to canonical orientation
3. Create temporal sequences:
   - Extract N consecutive frames (e.g., 16-32 frames)
   - Pad/truncate to fixed length
   - Include velocity features (frame-to-frame differences)

### Output Format
- Input: `(num_sequences, sequence_length, landmark_dim)` e.g., `(10000, 32, 63)`
- Output: `(num_sequences, num_classes)` one-hot encoded labels

## Model Architecture

### Option A: Lightweight LSTM (Recommended for on-device + server)
```
Input: (batch, 32, 63) — 32 frames × 21 points × 3 coords
├─ LSTM(128, return_sequences=True) → (batch, 32, 128)
├─ Dropout(0.5)
├─ LSTM(64) → (batch, 64)
├─ Dropout(0.5)
├─ Dense(128, activation='relu')
└─ Dense(num_classes, activation='softmax') → (batch, num_classes)
```

### Option B: Temporal 1D CNN
```
Input: (batch, 32, 63)
├─ Conv1D(64, kernel_size=3, activation='relu')
├─ MaxPooling1D(2)
├─ Conv1D(128, kernel_size=3, activation='relu')
├─ GlobalAveragePooling1D()
├─ Dense(128, activation='relu', dropout=0.5)
└─ Dense(num_classes, activation='softmax')
```

## Training Pipeline

### Framework: TensorFlow/Keras
1. **Load data:** Preprocessed sequences + labels
2. **Split:** 70% train, 15% val, 15% test
3. **Augmentation:**
   - Small noise injection (±0.02 on landmarks)
   - Random time warping
   - Random drops of frames
4. **Training:**
   - Optimizer: Adam (lr=0.001)
   - Loss: categorical_crossentropy
   - Metrics: accuracy, precision, recall, F1
   - Epochs: 50-100 (with early stopping)
   - Batch size: 32-64
5. **Evaluation:**
   - Per-class precision, recall, F1
   - Confusion matrix
   - Cross-validation (stratified 5-fold)

## Model Export

### For on-device (TFJS):
```bash
tensorflowjs_converter --input_format=keras model.h5 model_tfjs/
# Generates: model.json + weights.bin
```

### For server deployment:
```bash
# Keep as SavedModel or .pb
# Deploy with TensorFlow Serving or custom REST API
```

## Integration

### Frontend (on-device fallback):
- Load TFJS model from `/public/models/fsl/model.json`
- Use for low-latency, privacy-preserving predictions
- Threshold: if confidence < 0.7, ask server

### Backend (server inference):
- Load model in `/backend/models/fsl_model/`
- API endpoint: `POST /api/predict`
- Returns: label, confidence, latency

## Evaluation Metrics

1. **Accuracy:** Overall correct predictions
2. **Per-class F1:** Balance precision & recall per gesture
3. **Latency:** Time from landmark extraction to prediction
4. **Robustness:** Performance across lighting, backgrounds, signers

## References
- MediaPipe Hands: https://github.com/google/mediapipe/blob/master/docs/solutions/hands.md
- TensorFlow.js: https://www.tensorflow.org/js
- FSL resources: (Add FSL corpus / research links)

## Next Steps
1. Form IRB for ethics approval (data collection with humans)
2. Set up data collection infrastructure (app or web form)
3. Recruit signers from Pasay City
4. Preprocess and train model
5. Evaluate with target users
