#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import torch
import torchaudio
import numpy as np
import librosa
import soundfile as sf
from demucs.pretrained import get_model
from demucs.apply import apply_model
import sys

def separate_guitar_enhanced(input_path, output_path):
    try:
        print("🎸 향상된 기타 분리 시작...")
        
        # 더 정확한 모델 사용
        model_name = "htdemucs"  # High-quality 모델
        model = get_model(model_name)
        model.eval()
        
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model.to(device)
        print(f"📱 사용 장치: {device}")
        
        # 오디오 로드 (높은 샘플링 레이트 유지)
        waveform, sr = torchaudio.load(input_path)
        print(f"📊 원본 오디오 형태: {waveform.shape}, 샘플링 레이트: {sr}")
        
        # 스테레오로 변환
        if waveform.shape[0] == 1:
            waveform = waveform.repeat(2, 1)
            print("🔄 모노에서 스테레오로 변환")
        
        # Demucs 적용 (더 높은 품질 설정)
        waveform_tensor = waveform.unsqueeze(0).to(device)
        with torch.no_grad():
            sources = apply_model(model, waveform_tensor, split=True, overlap=0.25)
        
        drums, bass, other, vocals = sources[0].cpu().numpy()
        print("✅ Demucs 스템 분리 완료")
        
        # 기타 전용 후처리
        guitar_audio = extract_guitar_only(drums, bass, other, vocals, sr)
        
        # 저장
        sf.write(output_path, guitar_audio.T, sr, format='WAV', subtype='PCM_16')
        print(f"✅ 향상된 기타 파일 저장: {output_path}")
        print(f"📊 최종 기타 오디오 형태: {guitar_audio.shape}")
        
    except Exception as e:
        print(f"❌ 에러: {e}")
        sys.exit(1)

def extract_guitar_only(drums, bass, other, vocals, sr):
    """기타만 보수적으로 추출하는 함수 (멜로디 보존 우선)"""
    print("🎯 보수적 기타 추출 시작...")
    
    # 1. 기본적으로 'other' 스템 사용 (기타가 주로 포함됨)
    guitar_base = other.copy()
    print("📋 기본 'other' 스템 사용")
    
    # 2. 명백한 베이스 주파수만 제거 (매우 보수적)
    print("🔊 극저주파 제거 중...")
    for channel in range(guitar_base.shape[0]):
        # 50Hz 이하만 제거 (베이스 기본음만)
        stft = librosa.stft(guitar_base[channel], n_fft=2048, hop_length=512)
        freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
        
        # 극저주파만 제거
        very_low_freq_mask = freqs < 50
        stft[very_low_freq_mask] *= 0.1
        
        # 역변환 (길이 맞춤)
        reconstructed = librosa.istft(stft, hop_length=512, length=guitar_base[channel].shape[0])
        guitar_base[channel] = reconstructed
    
    # 3. 극단적인 드럼 타격음만 제거 (보수적)
    print("🥁 극단적 타격음만 제거...")
    for channel in range(guitar_base.shape[0]):
        # 매우 약한 HPF 적용
        harmonic, percussive = librosa.effects.hpss(guitar_base[channel], margin=1.0)
        # 80% 하모닉 + 20% 퍼커시브 (너무 과하게 제거하지 않음)
        guitar_base[channel] = harmonic * 0.8 + percussive * 0.2
    
    # 4. 매우 약한 보컬 제거
    print("🎤 약간의 보컬 제거...")
    vocals_reduced = vocals * 0.1  # 아주 약하게만 빼기
    guitar_final = guitar_base - vocals_reduced
    
    # 5. 최소한의 노이즈 게이트만 적용
    print("🎛️ 최소한의 노이즈 제거...")
    for channel in range(guitar_final.shape[0]):
        audio = guitar_final[channel]
        
        # 매우 낮은 노이즈 게이트 (최대값의 0.5%만)
        threshold = np.max(np.abs(audio)) * 0.005
        audio = np.where(np.abs(audio) < threshold, audio * 0.1, audio)
        
        guitar_final[channel] = audio
    
    print("✅ 보수적 기타 추출 완료")
    return guitar_final

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("사용법: python guitar_separation_improved.py <input.wav> <output.wav>")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    separate_guitar_enhanced(input_path, output_path)
