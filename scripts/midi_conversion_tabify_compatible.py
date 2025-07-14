#!/usr/bin/env python3
"""
Tabify 호환 기타 MIDI 변환기
- 실제 기타 연주 가능 범위 (MIDI 40-84)
- 완전 모노포닉 (동시 발음 없음)
- 적절한 노트 길이 및 타이밍
- 기타 현별 자연스러운 분포
"""

import sys
import numpy as np
import pretty_midi
import librosa
from basic_pitch.inference import predict
from basic_pitch import ICASSP_2022_MODEL_PATH

def guitar_string_mapping(pitch):
    """기타 현별 최적 매핑 (확장된 범위)"""
    # 확장된 튜닝: E2(40), A2(45), D3(50), G3(55) - 15프렛 범위
    strings = [
        (40, "E(저음현)"),  # E2 - 0~15프렛 (40-55)
        (45, "A현"),       # A2 - 0~15프렛 (45-60)
        (50, "D현"),       # D3 - 0~10프렛 (50-60)
        (55, "G현"),       # G3 - 0~5프렛 (55-60)
    ]
    
    # 가장 적합한 현 찾기 (낮은 프렛 우선)
    best_string = None
    best_fret = 16  # 최대 프렛 초과값
    
    for open_pitch, string_name in strings:
        fret = pitch - open_pitch
        max_fret = 15  # 최대 15프렛
        
        if 0 <= fret <= max_fret and fret < best_fret:
            best_fret = fret
            best_string = (open_pitch, string_name)
    
    return best_string, best_fret

def constrain_to_guitar_range(pitch):
    """기타 연주 가능 범위로 제한 (확장된 범위)"""
    # 확장된 기타 범위: E2(40) ~ C4(60) - 20프렛 범위
    min_pitch = 40  # E2 (저음현 개방)
    max_pitch = 60  # C4 (15프렛 정도)
    
    if pitch < min_pitch:
        # 낮은 음은 한 옥타브 올림
        while pitch < min_pitch:
            pitch += 12
    elif pitch > max_pitch:
        # 높은 음은 한 옥타브 내림
        while pitch > max_pitch:
            pitch -= 12
    
    return max(min_pitch, min(pitch, max_pitch))

def create_monophonic_sequence(notes_data):
    """폴리포닉을 모노포닉으로 변환"""
    if not notes_data:
        return []
    
    # 시간 순으로 정렬
    sorted_notes = sorted(notes_data, key=lambda x: x['onset'])
    
    # 겹치는 노트 제거 및 간격 조정
    monophonic_notes = []
    min_note_gap = 0.05  # 최소 50ms 간격
    min_duration = 0.125  # 최소 125ms 길이
    max_duration = 3.0    # 최대 3초 길이
    
    for i, note in enumerate(sorted_notes):
        pitch = constrain_to_guitar_range(int(round(note['pitch'])))
        onset = note['onset']
        offset = note['offset']
        
        # 노트 길이 조정
        duration = offset - onset
        duration = max(min_duration, min(duration, max_duration))
        
        # 이전 노트와 겹치지 않도록 조정
        if monophonic_notes:
            prev_note = monophonic_notes[-1]
            if onset < prev_note['offset'] + min_note_gap:
                # 이전 노트 종료 후 간격을 두고 시작
                onset = prev_note['offset'] + min_note_gap
        
        offset = onset + duration
        
        # 기타 현별 매핑 검증
        string_info, fret = guitar_string_mapping(pitch)
        if string_info and fret <= 15:  # 15프렛 이하만 연주 가능한 노트만 추가
            monophonic_notes.append({
                'pitch': pitch,
                'onset': onset,
                'offset': offset,
                'duration': duration,
                'string': string_info[1],
                'fret': fret
            })
    
    return monophonic_notes

def enhance_musical_expression(notes):
    """음악적 표현력 향상"""
    if not notes:
        return notes
    
    enhanced_notes = []
    
    for i, note in enumerate(notes):
        # 다이내믹스 (벨로시티) 계산
        base_velocity = 85
        
        # 높은 음일수록 약간 작게
        pitch_factor = max(0.8, 1.0 - (note['pitch'] - 40) / 200)
        
        # 긴 노트일수록 약간 작게 (지속음 효과)
        duration_factor = max(0.85, 1.0 - note['duration'] / 6.0)
        
        # 랜덤 변화로 자연스러움 추가
        random_factor = np.random.uniform(0.9, 1.1)
        
        velocity = int(base_velocity * pitch_factor * duration_factor * random_factor)
        velocity = max(70, min(110, velocity))  # 70-110 범위
        
        note['velocity'] = velocity
        enhanced_notes.append(note)
    
    return enhanced_notes

def convert_to_tabify_compatible_midi(input_audio_path, output_midi_path):
    """Tabify 호환 기타 MIDI 변환"""
    try:
        print("🎸 Tabify 호환 기타 MIDI 변환 시작...")
        
        # Basic Pitch로 MIDI 변환
        print("🔍 Basic Pitch 음성 인식 중...")
        model_output, midi_data, note_events = predict(input_audio_path, ICASSP_2022_MODEL_PATH)
        
        if not note_events or len(note_events) == 0:
            print("❌ 음표를 찾을 수 없습니다.")
            return False
        
        print(f"📊 원본 노트 수: {len(note_events)}")
        
        # 노트 데이터 정리
        notes_data = []
        for note in note_events:
            if len(note) >= 3:  # onset, offset, pitch
                notes_data.append({
                    'onset': float(note[0]),
                    'offset': float(note[1]), 
                    'pitch': float(note[2])
                })
        
        if not notes_data:
            print("❌ 유효한 노트 데이터가 없습니다.")
            return False
        
        # 모노포닉 시퀀스 생성
        print("🎯 모노포닉 변환 및 기타 범위 조정...")
        monophonic_notes = create_monophonic_sequence(notes_data)
        
        if not monophonic_notes:
            print("❌ 변환 가능한 노트가 없습니다.")
            return False
        
        print(f"📊 변환된 노트 수: {len(monophonic_notes)}")
        
        # 음악적 표현력 향상
        print("🎵 음악적 표현력 향상...")
        enhanced_notes = enhance_musical_expression(monophonic_notes)
        
        # MIDI 파일 생성
        print("🎹 MIDI 파일 생성...")
        midi = pretty_midi.PrettyMIDI()
        
        # 기타 악기 설정 (Acoustic Guitar steel)
        guitar = pretty_midi.Instrument(program=25, name="Acoustic Guitar (steel)")
        guitar.is_drum = False
        
        # 노트 추가
        for note_data in enhanced_notes:
            note = pretty_midi.Note(
                velocity=note_data['velocity'],
                pitch=note_data['pitch'],
                start=note_data['onset'],
                end=note_data['offset']
            )
            guitar.notes.append(note)
        
        midi.instruments.append(guitar)
        
        # 파일 저장
        midi.write(output_midi_path)
        print(f"✅ Tabify 호환 MIDI 저장: {output_midi_path}")
        
        # 결과 요약
        pitches = [n['pitch'] for n in enhanced_notes]
        velocities = [n['velocity'] for n in enhanced_notes]
        durations = [n['duration'] for n in enhanced_notes]
        
        print(f"📊 최종 결과:")
        print(f"  - 음역대: {min(pitches)} - {max(pitches)} (확장된 기타 범위: 40-60)")
        print(f"  - 벨로시티: {min(velocities)} - {max(velocities)}")
        print(f"  - 노트 길이: {min(durations):.3f} - {max(durations):.3f}초")
        print(f"  - 총 연주 시간: {max([n['offset'] for n in enhanced_notes]):.1f}초")
        
        # 현별 분포
        string_distribution = {}
        for note in enhanced_notes:
            string_name = note['string']
            string_distribution[string_name] = string_distribution.get(string_name, 0) + 1
        
        print(f"🎸 현별 분포:")
        for string, count in string_distribution.items():
            percentage = (count / len(enhanced_notes)) * 100
            print(f"  - {string}: {count}개 ({percentage:.1f}%)")
        
        return True
        
    except Exception as e:
        print(f"❌ 변환 실패: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("사용법: python midi_conversion_tabify_compatible.py <input.wav> <output.mid>")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    success = convert_to_tabify_compatible_midi(input_path, output_path)
    sys.exit(0 if success else 1)
