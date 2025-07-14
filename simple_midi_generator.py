#!/usr/bin/env python3
"""
극도로 단순한 테스트 MIDI 파일 생성기 (Tabify 호환)
"""

import pretty_midi
import numpy as np

def create_simple_test_midi(output_path):
    """Tabify 호환 초단순 MIDI 생성"""
    
    # MIDI 파일 생성
    midi_file = pretty_midi.PrettyMIDI()
    
    # 기타 트랙 생성 (일반적인 MIDI 기타 프로그램)
    guitar = pretty_midi.Instrument(program=24, name="Acoustic Guitar")
    
    # 단순한 단일 음 멜로디 (표준 기타 범위)
    # 저음현 E(40)부터 시작해서 기본적인 스케일
    simple_notes = [
        40,  # E2 (6현 개방)
        41,  # F2 (6현 1프렛)
        42,  # F#2 (6현 2프렛)
        43,  # G2 (6현 3프렛)
        44,  # G#2 (6현 4프렛)
        45,  # A2 (5현 개방)
        47,  # B2 (5현 2프렛)
        48,  # C3 (5현 3프렛)
    ]
    
    start_time = 0.0
    note_duration = 1.0  # 1초씩 긴 노트
    
    for i, pitch in enumerate(simple_notes):
        note = pretty_midi.Note(
            velocity=80,
            pitch=pitch,
            start=start_time + i * note_duration,
            end=start_time + (i + 1) * note_duration
        )
        guitar.notes.append(note)
    
    midi_file.instruments.append(guitar)
    
    # MIDI 파일 저장
    midi_file.write(output_path)
    print(f"✅ 단순 테스트 MIDI 파일 생성: {output_path}")
    print(f"📊 총 노트 개수: {len(guitar.notes)}")
    print(f"📏 총 길이: {midi_file.get_end_time():.2f}초")
    print(f"🎵 노트 범위: {min(n.pitch for n in guitar.notes)} - {max(n.pitch for n in guitar.notes)}")
    
    return True

if __name__ == "__main__":
    output_file = "/Users/choechiwon/madcamp/week2/GRIP_back/simple_test.mid"
    create_simple_test_midi(output_file)
