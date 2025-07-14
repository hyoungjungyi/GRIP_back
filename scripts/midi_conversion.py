#!/usr/bin/env python3
"""
Basic Pitch를 사용한 기타 오디오 -> MIDI 변환 스크립트
Spotify의 Basic Pitch 모델을 사용하여 고품질 MIDI 변환 수행
"""

import sys
import os
import argparse
import numpy as np
from basic_pitch.inference import predict
from basic_pitch import ICASSP_2022_MODEL_PATH
import pretty_midi
import librosa

def audio_to_midi(input_audio_path, output_midi_path):
    """
    Basic Pitch를 사용하여 오디오를 MIDI로 변환
    """
    try:
        print(f"🎼 MIDI 변환 시작: {input_audio_path}")
        
        # Basic Pitch로 오디오 분석
        print("🔍 Basic Pitch로 오디오 분석 중...")
        model_output, midi_data, note_events = predict(input_audio_path)
        
        print(f"✅ 기본 분석 완료!")
        print(f"📊 감지된 노트 개수: {len(note_events)}")
        
        if len(note_events) == 0:
            print("⚠️ 노트가 감지되지 않았습니다. 다른 오디오 파일을 시도해보세요.")
            return {
                "success": False,
                "error": "노트가 감지되지 않음",
                "note_count": 0
            }
        
        # 기타에 최적화된 MIDI 후처리
        print("🎸 기타 MIDI 최적화 중...")
        
        # 기타 음역대로 필터링 (E2 ~ E6, MIDI 40-88)
        filtered_notes = []
        for note in note_events:
            start_time, end_time, pitch, velocity, _ = note
            midi_pitch = int(pitch)
            
            # 기타 음역대 필터링
            if 40 <= midi_pitch <= 88:
                # 기타 현에 맞는 피치로 조정
                filtered_notes.append((start_time, end_time, midi_pitch, velocity))
        
        print(f"🎸 기타 음역대 필터링 후: {len(filtered_notes)}개 노트")
        
        if len(filtered_notes) == 0:
            print("⚠️ 기타 음역대에서 노트가 감지되지 않았습니다.")
            return {
                "success": False,
                "error": "기타 음역대에서 노트 없음",
                "note_count": 0
            }
        
        # 새로운 MIDI 파일 생성
        guitar_midi = pretty_midi.PrettyMIDI()
        guitar_instrument = pretty_midi.Instrument(program=24, name='Electric Guitar (clean)')  # 일렉 기타
        
        # 필터링된 노트들을 MIDI에 추가
        for start_time, end_time, pitch, velocity in filtered_notes:
            # 최소 지속시간 보장 (너무 짧은 노트 방지)
            duration = max(end_time - start_time, 0.1)
            
            # 벨로시티 조정 (기타에 맞게)
            adjusted_velocity = min(max(int(velocity * 127), 30), 120)
            
            note = pretty_midi.Note(
                velocity=adjusted_velocity,
                pitch=pitch,
                start=start_time,
                end=start_time + duration
            )
            guitar_instrument.notes.append(note)
        
        # 노트들을 시간순으로 정렬
        guitar_instrument.notes.sort(key=lambda x: x.start)
        
        # 악기를 MIDI에 추가
        guitar_midi.instruments.append(guitar_instrument)
        
        # MIDI 파일 저장
        guitar_midi.write(output_midi_path)
        
        # 결과 분석
        total_duration = max([note.end for note in guitar_instrument.notes]) if guitar_instrument.notes else 0
        file_size = os.path.getsize(output_midi_path) / 1024  # KB
        
        # 기타 현별 노트 분포 분석
        string_distribution = {
            "E_low": 0,   # 40-45 (E2-A2)
            "A": 0,       # 45-50 (A2-D3)
            "D": 0,       # 50-55 (D3-G3)
            "G": 0,       # 55-60 (G3-C4)
            "B": 0,       # 60-65 (C4-F4)
            "E_high": 0   # 65+ (F4+)
        }
        
        for note in guitar_instrument.notes:
            if note.pitch < 45:
                string_distribution["E_low"] += 1
            elif note.pitch < 50:
                string_distribution["A"] += 1
            elif note.pitch < 55:
                string_distribution["D"] += 1
            elif note.pitch < 60:
                string_distribution["G"] += 1
            elif note.pitch < 65:
                string_distribution["B"] += 1
            else:
                string_distribution["E_high"] += 1
        
        print(f"✅ MIDI 변환 완료!")
        print(f"📁 출력 파일: {output_midi_path}")
        print(f"⏱️  총 길이: {total_duration:.2f}초")
        print(f"📊 파일 크기: {file_size:.2f}KB")
        print(f"🎼 최종 노트 수: {len(guitar_instrument.notes)}")
        print(f"🎸 현별 분포: {string_distribution}")
        
        return {
            "success": True,
            "output_path": output_midi_path,
            "duration": total_duration,
            "file_size_kb": file_size,
            "note_count": len(guitar_instrument.notes),
            "string_distribution": string_distribution,
            "original_notes": len(note_events),
            "filtered_notes": len(filtered_notes)
        }
        
    except Exception as e:
        print(f"❌ MIDI 변환 오류: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

def main():
    parser = argparse.ArgumentParser(description='기타 오디오를 MIDI로 변환')
    parser.add_argument('input_path', help='입력 기타 오디오 파일 경로')
    parser.add_argument('output_path', help='출력 MIDI 파일 경로')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.input_path):
        print(f"❌ 입력 파일이 존재하지 않습니다: {args.input_path}")
        sys.exit(1)
    
    # 출력 디렉토리 생성
    os.makedirs(os.path.dirname(args.output_path), exist_ok=True)
    
    result = audio_to_midi(args.input_path, args.output_path)
    
    if result["success"]:
        print("🎉 MIDI 변환 성공!")
        sys.exit(0)
    else:
        print("💥 MIDI 변환 실패!")
        sys.exit(1)

if __name__ == "__main__":
    main()
