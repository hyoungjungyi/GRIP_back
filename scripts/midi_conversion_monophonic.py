#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import librosa
import numpy as np
from basic_pitch.inference import predict
from basic_pitch import ICASSP_2022_MODEL_PATH
import pretty_midi

def convert_to_monophonic_midi(audio_path, output_path):
    """모노포닉 기타를 위한 MIDI 변환"""
    try:
        print("🎵 모노포닉 MIDI 변환 시작...")
        
        # Basic Pitch로 예측
        print("🤖 Basic Pitch 모델 실행...")
        model_output, midi_data, note_events = predict(audio_path, ICASSP_2022_MODEL_PATH)
        
        if not midi_data.instruments:
            print("❌ MIDI 데이터에 악기가 없습니다.")
            sys.exit(1)
        
        print(f"📊 원본 노트 수: {len(midi_data.instruments[0].notes)}")
        
        # 화음 제거하고 멜로디만 추출
        print("🎼 멜로디 라인 추출...")
        monophonic_midi = extract_lead_melody(midi_data)
        
        # 기타 튜닝에 맞게 조정
        print("🎸 기타 튜닝 최적화...")
        guitar_midi = adjust_for_guitar_tuning(monophonic_midi)
        
        # 추가 정제
        print("✨ 최종 정제...")
        refined_midi = refine_guitar_midi(guitar_midi)
        
        # 저장
        refined_midi.write(output_path)
        print(f"✅ 모노포닉 MIDI 저장: {output_path}")
        
        # 통계 출력
        print_midi_stats(refined_midi)
        
    except Exception as e:
        print(f"❌ MIDI 변환 에러: {e}")
        sys.exit(1)

def extract_lead_melody(midi_data):
    """화음에서 멜로디 라인만 보수적으로 추출"""
    new_midi = pretty_midi.PrettyMIDI()
    guitar_program = pretty_midi.instrument_name_to_program('Acoustic Guitar (steel)')
    guitar_track = pretty_midi.Instrument(program=guitar_program, name="Lead Guitar")
    
    # 시간대별로 노트 그룹화 (더 관대한 그룹화)
    time_groups = {}
    time_resolution = 0.1  # 100ms 단위로 그룹화 (더 관대하게)
    
    for note in midi_data.instruments[0].notes:
        time_key = round(note.start / time_resolution) * time_resolution
        if time_key not in time_groups:
            time_groups[time_key] = []
        time_groups[time_key].append(note)
    
    print(f"📊 시간 그룹 수: {len(time_groups)}")
    
    # 각 시간대에서 가장 적합한 노트 선택 (더 관대하게)
    for time_key, notes in sorted(time_groups.items()):
        if not notes:
            continue
            
        # 기타 음역대 필터링 (더 넓은 범위 허용)
        guitar_notes = [n for n in notes if 35 <= n.pitch <= 95]  # E1-B6까지 허용
        
        if not guitar_notes:
            continue
        
        # 4개 이상의 동시 노트가 있을 때만 선택적으로 처리
        if len(guitar_notes) >= 4:
            # 너무 많은 화음일 때만 최고음 선택
            selected_note = max(guitar_notes, key=lambda n: n.pitch)
            guitar_track.notes.append(selected_note)
        elif len(guitar_notes) <= 3:
            # 3개 이하면 모두 유지 (기타는 3음 화음까지 자연스러움)
            for note in guitar_notes:
                guitar_track.notes.append(note)
        else:
            # 중간 경우 - 가장 긴 노트 선택
            selected_note = max(guitar_notes, key=lambda n: n.end - n.start)
            guitar_track.notes.append(selected_note)
    
    new_midi.instruments.append(guitar_track)
    print(f"📊 추출된 노트 수: {len(guitar_track.notes)}")
    return new_midi

def adjust_for_guitar_tuning(midi_data):
    """기타 튜닝에 보수적으로 최적화"""
    
    for instrument in midi_data.instruments:
        notes_to_remove = []
        
        for i, note in enumerate(instrument.notes):
            # 매우 짧은 노트만 제거 (64분음표 이하)
            min_duration = 0.03  # 64분음표보다도 짧은 것만
            if note.end - note.start < min_duration:
                notes_to_remove.append(i)
                continue
            
            # 극단적인 음역대만 조정
            original_pitch = note.pitch
            while note.pitch > 100:  # 매우 높은 음만 옥타브 down
                note.pitch -= 12
            while note.pitch < 30:   # 매우 낮은 음만 옥타브 up
                note.pitch += 12
            
            if note.pitch != original_pitch:
                print(f"🔄 극단적 음높이 조정: {original_pitch} → {note.pitch}")
        
        # 제거할 노트들 삭제 (역순으로)
        for i in reversed(notes_to_remove):
            del instrument.notes[i]
    
    return midi_data

def refine_guitar_midi(midi_data):
    """최종 MIDI 보수적 정제"""
    for instrument in midi_data.instruments:
        # 시간 순서로 정렬
        instrument.notes.sort(key=lambda n: n.start)
        
        # 심하게 겹치는 노트만 처리
        notes_to_remove = []
        for i in range(len(instrument.notes) - 1):
            current_note = instrument.notes[i]
            next_note = instrument.notes[i + 1]
            
            # 90% 이상 겹치는 노트만 처리
            overlap = max(0, min(current_note.end, next_note.end) - max(current_note.start, next_note.start))
            current_duration = current_note.end - current_note.start
            next_duration = next_note.end - next_note.start
            
            overlap_ratio = overlap / max(current_duration, next_duration)
            
            if overlap_ratio > 0.9:  # 90% 이상 겹칠 때만
                # 더 짧은 노트 제거
                if current_duration < next_duration:
                    notes_to_remove.append(i)
                else:
                    # 겹치는 부분만 조정
                    current_note.end = next_note.start - 0.01
        
        # 제거할 노트들 삭제
        for i in reversed(notes_to_remove):
            if i < len(instrument.notes):
                del instrument.notes[i]
        
        # 벨로시티 조정 (더 자연스럽게)
        for note in instrument.notes:
            # 원래 벨로시티 유지하되, 극단값만 조정
            if note.velocity < 20:
                note.velocity = 20
            elif note.velocity > 127:
                note.velocity = 127
    
    return midi_data

def print_midi_stats(midi_data):
    """MIDI 통계 출력"""
    if not midi_data.instruments:
        print("📊 악기가 없습니다.")
        return
        
    total_notes = len(midi_data.instruments[0].notes)
    print(f"📊 최종 노트 수: {total_notes}")
    
    if total_notes == 0:
        print("📊 노트가 없습니다.")
        return
    
    # 음역대 분석
    pitches = [note.pitch for note in midi_data.instruments[0].notes]
    print(f"📊 음역대: {min(pitches)} - {max(pitches)}")
    
    # 지속시간 분석
    durations = [note.end - note.start for note in midi_data.instruments[0].notes]
    print(f"📊 평균 노트 길이: {np.mean(durations):.3f}초")
    print(f"📊 최단/최장 노트: {min(durations):.3f}초 / {max(durations):.3f}초")
    
    # 기타 현별 분포
    string_counts = {
        "E(저음)": len([p for p in pitches if 40 <= p < 45]),
        "A현": len([p for p in pitches if 45 <= p < 50]),
        "D현": len([p for p in pitches if 50 <= p < 55]),
        "G현": len([p for p in pitches if 55 <= p < 59]),
        "B현": len([p for p in pitches if 59 <= p < 64]),
        "E(고음)": len([p for p in pitches if 64 <= p <= 88])
    }
    
    print("📊 기타 현별 노트 분포:")
    for string_name, count in string_counts.items():
        if count > 0:
            percentage = (count / total_notes) * 100
            print(f"   {string_name}: {count}개 ({percentage:.1f}%)")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("사용법: python midi_conversion_monophonic.py <input.wav> <output.mid>")
        sys.exit(1)
    
    audio_path = sys.argv[1]
    output_path = sys.argv[2]
    convert_to_monophonic_midi(audio_path, output_path)
