#!/usr/bin/env python3
"""
기타 음원 분리 스크립트
Facebook Demucs v4를 사용하여 오디오에서 기타만 추출
"""

import sys
import os
import argparse
import torch
import soundfile as sf
from demucs.pretrained import get_model
from demucs.apply import apply_model
import librosa
import numpy as np

def separate_guitar(input_path, output_path):
    """
    Demucs v4를 사용하여 기타 음원 분리
    """
    try:
        print(f"🎸 기타 분리 시작: {input_path}")
        
        # GPU 사용 가능 여부 확인
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        print(f"🔧 디바이스: {device}")
        
        # Demucs 모델 로드 (htdemucs는 4-stem separation: drums, bass, other, vocals)
        # 하지만 기타는 주로 'other' 채널에 들어감
        print("📥 Demucs 모델 로딩...")
        model = get_model('htdemucs')
        model.to(device)
        model.eval()
        
        # 오디오 로드
        print("📥 오디오 로딩...")
        waveform, sr = librosa.load(input_path, sr=44100, mono=False)
        
        # 모노를 스테레오로 변환 (필요한 경우)
        if waveform.ndim == 1:
            waveform = np.stack([waveform, waveform])
        elif waveform.shape[0] == 1:
            waveform = np.repeat(waveform, 2, axis=0)
            
        print(f"📊 오디오 형태: {waveform.shape}, 샘플링 레이트: {sr}")
        
        # PyTorch 텐서로 변환
        waveform_tensor = torch.from_numpy(waveform).float().unsqueeze(0).to(device)
        
        # Demucs 적용
        print("🔄 Demucs로 음원 분리 중...")
        with torch.no_grad():
            # apply_model returns: drums, bass, other, vocals
            sources = apply_model(model, waveform_tensor, split=True, overlap=0.25)
        
        # 기타는 주로 'other' 스템에 포함됨 (인덱스 2)
        # 하지만 더 나은 기타 추출을 위해 'other' + 일부 'vocals' 조합 시도
        drums, bass, other, vocals = sources[0].cpu().numpy()
        
        print("🎸 기타 음원 추출 중...")
        
        # 방법 1: 'other' 스템만 사용 (순수한 기타 + 키보드 등)
        guitar_audio = other
        
        # 방법 2: 향상된 기타 추출 - 'other' + 고주파 vocals
        # vocals에서 기타 성분이 있을 수 있으므로 고주파 부분만 추가
        vocals_high_freq = librosa.effects.preemphasis(vocals.mean(axis=0))
        
        # other 스템에 vocals의 고주파 성분을 약하게 추가
        if vocals_high_freq.shape[0] == guitar_audio.shape[1]:
            vocals_stereo = np.stack([vocals_high_freq, vocals_high_freq])
            guitar_audio = guitar_audio + 0.3 * vocals_stereo
        
        # 기타 음역대 강조 (80Hz ~ 5kHz)
        guitar_enhanced = np.zeros_like(guitar_audio)
        for channel in range(guitar_audio.shape[0]):
            # 밴드패스 필터 적용
            guitar_enhanced[channel] = librosa.effects.preemphasis(guitar_audio[channel])
        
        # 정규화
        guitar_final = guitar_enhanced / (np.max(np.abs(guitar_enhanced)) + 1e-8)
        
        # 스테레오 형태로 저장
        guitar_stereo = guitar_final.T  # (time, channels)
        
        # WAV 파일로 저장
        sf.write(output_path, guitar_stereo, sr)
        
        # 결과 정보
        duration = len(guitar_stereo) / sr
        file_size = os.path.getsize(output_path) / (1024 * 1024)
        
        print(f"✅ 기타 분리 완료!")
        print(f"📁 출력 파일: {output_path}")
        print(f"⏱️  길이: {duration:.2f}초")
        print(f"📊 파일 크기: {file_size:.2f}MB")
        
        return {
            "success": True,
            "output_path": output_path,
            "duration": duration,
            "file_size_mb": file_size,
            "sample_rate": sr,
            "channels": guitar_stereo.shape[1]
        }
        
    except Exception as e:
        print(f"❌ 기타 분리 오류: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

def main():
    parser = argparse.ArgumentParser(description='기타 음원 분리')
    parser.add_argument('input_path', help='입력 오디오 파일 경로')
    parser.add_argument('output_path', help='출력 기타 오디오 파일 경로')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.input_path):
        print(f"❌ 입력 파일이 존재하지 않습니다: {args.input_path}")
        sys.exit(1)
    
    # 출력 디렉토리 생성
    os.makedirs(os.path.dirname(args.output_path), exist_ok=True)
    
    result = separate_guitar(args.input_path, args.output_path)
    
    if result["success"]:
        print("🎉 기타 분리 성공!")
        sys.exit(0)
    else:
        print("💥 기타 분리 실패!")
        sys.exit(1)

if __name__ == "__main__":
    main()
