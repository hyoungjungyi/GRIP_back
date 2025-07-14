#!/usr/bin/env python3
"""
테스트용 MIDI 파일 생성기 (40-60 범위)
"""

import pretty_midi
import numpy as np

def create_test_midi(output_path):
    """기타 연주 가능한 간단한 테스트 MIDI 생성"""
    
    # MIDI 파일 생성
    midi_file = pretty_midi.PrettyMIDI()
    
    # 기타 트랙 생성
    guitar = pretty_midi.Instrument(program=24, name="Acoustic Guitar")  # 24 = Acoustic Guitar
    
    # 테스트 멜로디: 표준 기타 범위 (E2-E4)
    notes = [40, 42, 43, 45, 47, 48, 50, 52, 53, 55, 57, 58, 60, 62, 64]  # E2 ~ E4
    
    start_time = 0.0
    note_duration = 0.8  # 조금 더 긴 노트
    
    for i, pitch in enumerate(notes):
        note = pretty_midi.Note(
            velocity=80,
            pitch=pitch,
            start=start_time + i * note_duration,
            end=start_time + (i + 1) * note_duration
        )
        guitar.notes.append(note)
    
    # 간단한 기타 아르페지오 추가
    arpeggio_notes = [
        40, 47, 52, 55,  # E-B-E-G (Em chord)
        45, 52, 57, 60,  # A-E-A-C (Am chord)  
        43, 50, 55, 58,  # G-D-G-B (G chord)
        40, 47, 52, 55,  # E-B-E-G (Em chord)
    ]
    
    start_time = len(notes) * note_duration + 0.5
    
    for i, pitch in enumerate(arpeggio_notes):
        note = pretty_midi.Note(
            velocity=70,
            pitch=pitch,
            start=start_time + i * 0.25,  # 빠른 아르페지오
            end=start_time + i * 0.25 + 0.4
        )
        guitar.notes.append(note)
    
    midi_file.instruments.append(guitar)
    
    # MIDI 파일 저장
    midi_file.write(output_path)
    print(f"✅ 테스트 MIDI 파일 생성: {output_path}")
    print(f"📊 총 노트 개수: {len(guitar.notes)}")
    print(f"📏 총 길이: {midi_file.get_end_time():.2f}초")
    
    return True

if __name__ == "__main__":
    output_file = "/Users/choechiwon/madcamp/week2/GRIP_back/test_guitar.mid"
    create_test_midi(output_file)
