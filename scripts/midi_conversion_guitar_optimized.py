#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import librosa
import numpy as np
from basic_pitch.inference import predict
from basic_pitch import ICASSP_2022_MODEL_PATH
import pretty_midi

def convert_to_guitar_optimized_midi(audio_path, output_path):
    """기타 연주 가능하고 듣기 좋은 MIDI로 최적화"""
    try:
        print("🎸 기타 최적화 MIDI 변환 시작...")
        
        # Basic Pitch로 예측
        print("🤖 Basic Pitch 모델 실행...")
        model_output, midi_data, note_events = predict(audio_path, ICASSP_2022_MODEL_PATH)
        
        if not midi_data.instruments:
            print("❌ MIDI 데이터에 악기가 없습니다.")
            sys.exit(1)
        
        print(f"📊 원본 노트 수: {len(midi_data.instruments[0].notes)}")
        
        # 기타 연주 가능하도록 최적화
        guitar_midi = optimize_for_guitar_playability(midi_data)
        
        # 저장
        guitar_midi.write(output_path)
        print(f"✅ 기타 최적화 MIDI 저장: {output_path}")
        
        # 통계 출력
        print_guitar_midi_stats(guitar_midi)
        
    except Exception as e:
        print(f"❌ MIDI 변환 에러: {e}")
        sys.exit(1)

def optimize_for_guitar_playability(midi_data):
    """기타 연주 가능성과 음악성을 위한 최적화"""
    
    # 새로운 MIDI 객체 생성 (480 틱 = 고해상도)
    new_midi = pretty_midi.PrettyMIDI(resolution=480, initial_tempo=120.0)
    
    # 기타 트랙 생성
    guitar_program = pretty_midi.instrument_name_to_program('Acoustic Guitar (steel)')
    guitar_track = pretty_midi.Instrument(program=guitar_program, name="Guitar", is_drum=False)
    
    # 기타 표준 튜닝 (개방현 음높이) - 실용적인 15프렛까지
    # E2(40), A2(45), D3(50), G3(55), B3(59), E4(64)
    open_strings = [40, 45, 50, 55, 59, 64]
    max_fret = 15  # 15프렛까지 (실용적 범위)
    
    # 연주 가능한 음역대 계산
    playable_notes = set()
    string_fret_map = {}  # 각 음에 대한 현-프렛 조합 저장
    
    for string_idx, string_note in enumerate(open_strings):
        for fret in range(max_fret + 1):
            pitch = string_note + fret
            playable_notes.add(pitch)
            if pitch not in string_fret_map:
                string_fret_map[pitch] = []
            string_fret_map[pitch].append((string_idx, fret))
    
    print(f"🎸 연주 가능한 음역대: {min(playable_notes)} - {max(playable_notes)} (MIDI)")
    print(f"🎸 총 연주 가능한 음: {len(playable_notes)}개")
    
    # 원본 노트들 처리
    original_notes = midi_data.instruments[0].notes
    
    if not original_notes:
        print("❌ 처리할 노트가 없습니다.")
        return new_midi
    
    # 시간순으로 정렬
    original_notes.sort(key=lambda x: x.start)
    
    # 1. 모노포닉 변환 (화음 → 멜로디)
    print("🎵 모노포닉 멜로디 추출...")
    monophonic_notes = convert_to_musical_monophonic(original_notes)
    print(f"📊 모노포닉 변환 후: {len(monophonic_notes)}개")
    
    # 2. 기타 연주 가능한 노트로 변환
    print("🎸 기타 연주 가능 범위로 조정...")
    playable_notes_list = process_for_guitar_playability(monophonic_notes, playable_notes, string_fret_map)
    
    # 3. 음악적 후처리 (듣기 좋게)
    print("🎼 음악적 후처리...")
    musical_notes = apply_musical_post_processing(playable_notes_list)
    
    print(f"📊 최종 노트 수: {len(musical_notes)}개")
    
    # 기타 트랙에 노트 추가
    guitar_track.notes.extend(musical_notes)
    
    # MIDI에 트랙 추가
    new_midi.instruments.append(guitar_track)
    
    return new_midi

def convert_to_musical_monophonic(notes):
    """음악적으로 자연스러운 모노포닉 변환"""
    if not notes:
        return []
    
    # 시간 해상도 (20ms - 더 정밀하게)
    time_resolution = 0.02
    time_groups = {}
    
    for note in notes:
        time_key = round(note.start / time_resolution) * time_resolution
        if time_key not in time_groups:
            time_groups[time_key] = []
        time_groups[time_key].append(note)
    
    monophonic_notes = []
    prev_pitch = None
    
    for time_key in sorted(time_groups.keys()):
        group_notes = time_groups[time_key]
        
        if len(group_notes) == 1:
            selected_note = group_notes[0]
        else:
            # 멜로디 라인 선택 (이전 음과의 연결성 고려)
            selected_note = select_melodic_note(group_notes, prev_pitch)
        
        monophonic_notes.append(selected_note)
        prev_pitch = selected_note.pitch
    
    return monophonic_notes

def select_melodic_note(notes, prev_pitch):
    """멜로디 라인에 가장 적합한 노트 선택 (음악적 연결성 고려)"""
    
    # 기타 멜로디에 적합한 음역대 (C3-E5: MIDI 48-76)
    sweet_spot = (48, 76)
    
    scored_notes = []
    
    for note in notes:
        score = 0
        
        # 1. 음역대 점수 (기타 스위트 스팟)
        if sweet_spot[0] <= note.pitch <= sweet_spot[1]:
            score += 100
        else:
            distance = min(abs(note.pitch - sweet_spot[0]), abs(note.pitch - sweet_spot[1]))
            score += max(0, 100 - distance * 2)
        
        # 2. 벨로시티 점수 (강한 소리가 주 멜로디)
        score += note.velocity * 0.8
        
        # 3. 노트 길이 점수 (적절한 길이 선호)
        duration = note.end - note.start
        if 0.1 <= duration <= 3.0:
            score += 50
        elif duration > 3.0:
            score -= 20
        
        # 4. 이전 음과의 연결성 (큰 점프 피하기)
        if prev_pitch is not None:
            interval = abs(note.pitch - prev_pitch)
            if interval <= 7:  # 완전5도 이내 (자연스러운 멜로디)
                score += 30
            elif interval <= 12:  # 옥타브 이내
                score += 10
            else:  # 큰 점프는 감점
                score -= (interval - 12) * 2
        
        scored_notes.append((score, note))
    
    # 최고 점수 노트 선택
    scored_notes.sort(key=lambda x: x[0], reverse=True)
    return scored_notes[0][1]

def process_for_guitar_playability(notes, playable_notes, string_fret_map):
    """기타 연주 가능성을 위한 처리"""
    
    playable_filtered = []
    transposed_count = 0
    removed_count = 0
    
    for note in notes:
        original_pitch = note.pitch
        
        # 연주 가능한 음역대로 조정
        adjusted_pitch = find_best_guitar_pitch(original_pitch, playable_notes, string_fret_map)
        
        if adjusted_pitch != original_pitch:
            transposed_count += 1
        
        # 너무 짧은 노트 제거 (32분음표 이하)
        min_duration = 0.0625
        if note.end - note.start < min_duration:
            removed_count += 1
            continue
        
        # 노트 길이 조정
        duration = note.end - note.start
        
        # 최소 길이 보장 (16분음표)
        if duration < 0.125:
            note.end = note.start + 0.125
        
        # 최대 길이 제한 (4박자)
        elif duration > 4.0:
            note.end = note.start + 4.0
        
        # 벨로시티 조정 (기타에 적합한 범위)
        # 70-120 범위로 설정 (너무 약하거나 강하지 않게)
        original_velocity = note.velocity
        note.velocity = max(70, min(120, int(original_velocity * 1.1)))  # 약간 강화
        
        # 조정된 음높이 적용
        note.pitch = int(adjusted_pitch)
        
        playable_filtered.append(note)
    
    print(f"📊 옥타브 조정: {transposed_count}개")
    print(f"📊 제거된 짧은 노트: {removed_count}개")
    
    return playable_filtered

def find_best_guitar_pitch(target_pitch, playable_notes, string_fret_map):
    """기타에서 가장 자연스럽게 연주할 수 있는 음높이 찾기"""
    
    # 이미 연주 가능하면 그대로 사용
    if target_pitch in playable_notes:
        # 여러 현에서 연주 가능한 경우 가장 적합한 위치 선택
        return target_pitch
    
    # 옥타브 단위로 조정
    adjusted_pitch = target_pitch
    
    # 너무 높으면 옥타브 down
    while adjusted_pitch > max(playable_notes):
        adjusted_pitch -= 12
    
    # 너무 낮으면 옥타브 up
    while adjusted_pitch < min(playable_notes):
        adjusted_pitch += 12
    
    # 가장 가까운 연주 가능한 음 찾기
    if adjusted_pitch not in playable_notes:
        playable_list = sorted(list(playable_notes))
        distances = [abs(adjusted_pitch - p) for p in playable_list]
        closest_idx = distances.index(min(distances))
        adjusted_pitch = playable_list[closest_idx]
    
    return adjusted_pitch

def apply_musical_post_processing(notes):
    """음악적 후처리 (듣기 좋게 만들기)"""
    
    if not notes:
        return notes
    
    processed_notes = []
    
    for i, note in enumerate(notes):
        # 복사본 생성
        processed_note = pretty_midi.Note(
            velocity=note.velocity,
            pitch=note.pitch,
            start=note.start,
            end=note.end
        )
        
        # 1. 다이나믹 처리 (표현력 향상)
        processed_note.velocity = enhance_dynamics(note, i, len(notes))
        
        # 2. 타이밍 미세 조정 (그루브 향상)
        processed_note.start, processed_note.end = adjust_timing_groove(note)
        
        # 3. 노트 간격 최적화
        if i > 0:
            prev_note = processed_notes[-1]
            # 겹치는 노트 방지
            if processed_note.start < prev_note.end:
                prev_note.end = processed_note.start - 0.01
        
        processed_notes.append(processed_note)
    
    # 4. 프레이징 적용 (음악적 구문)
    processed_notes = apply_musical_phrasing(processed_notes)
    
    return processed_notes

def enhance_dynamics(note, position, total_notes):
    """다이나믹 향상 (자연스러운 강약 처리)"""
    
    base_velocity = note.velocity
    
    # 위치에 따른 다이나믹 곡선 (곡의 구조 반영)
    position_ratio = position / max(total_notes - 1, 1)
    
    # 곡의 시작과 끝은 약간 약하게, 중간은 강하게
    if position_ratio < 0.1:  # 도입부
        dynamic_factor = 0.8
    elif position_ratio > 0.9:  # 결말부
        dynamic_factor = 0.85
    else:  # 중간부
        dynamic_factor = 1.0
    
    # 노트 길이에 따른 조정
    duration = note.end - note.start
    if duration > 1.5:  # 긴 노트는 약간 약하게
        duration_factor = 0.9
    elif duration < 0.2:  # 짧은 노트는 약간 강하게
        duration_factor = 1.1
    else:
        duration_factor = 1.0
    
    # 최종 벨로시티 계산
    final_velocity = int(base_velocity * dynamic_factor * duration_factor)
    
    # 범위 제한 (75-115: 기타에 적합한 범위)
    return max(75, min(115, final_velocity))

def adjust_timing_groove(note):
    """타이밍 그루브 조정 (자연스러운 리듬감)"""
    
    start_time = note.start
    end_time = note.end
    duration = end_time - start_time
    
    # 매우 미세한 타이밍 조정 (인간적인 느낌)
    # ±5ms 범위에서 랜덤 조정
    import random
    random.seed(int(start_time * 1000))  # 일관성 위해 시드 설정
    
    timing_adjustment = (random.random() - 0.5) * 0.01  # ±5ms
    
    new_start = start_time + timing_adjustment
    new_end = new_start + duration
    
    # 음수 시간 방지
    if new_start < 0:
        new_start = 0
        new_end = duration
    
    return new_start, new_end

def apply_musical_phrasing(notes):
    """음악적 프레이징 적용"""
    
    if len(notes) < 3:
        return notes
    
    # 프레이즈 단위로 그룹화 (약 4-8개 노트)
    phrase_length = 6
    
    for i in range(0, len(notes), phrase_length):
        phrase_notes = notes[i:i + phrase_length]
        
        # 프레이즈 내에서 미세한 다이나믹 조정
        for j, note in enumerate(phrase_notes):
            phrase_position = j / max(len(phrase_notes) - 1, 1)
            
            # 프레이즈 중간이 가장 강하게
            phrase_dynamic = 0.95 + 0.1 * np.sin(phrase_position * np.pi)
            note.velocity = int(note.velocity * phrase_dynamic)
            
            # 범위 제한
            note.velocity = max(75, min(115, note.velocity))
    
    return notes

def print_guitar_midi_stats(midi_data):
    """기타 MIDI 통계 출력 (상세)"""
    if not midi_data.instruments:
        print("📊 악기 트랙이 없습니다.")
        return
        
    notes = midi_data.instruments[0].notes
    total_notes = len(notes)
    print(f"📊 총 노트 수: {total_notes}")
    
    if not notes:
        print("📊 노트가 없습니다.")
        return
    
    # 음역대 분석
    pitches = [note.pitch for note in notes]
    print(f"📊 음역대: {min(pitches)} - {max(pitches)} (MIDI)")
    
    # 음이름 변환
    note_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    min_note = note_names[min(pitches) % 12] + str(min(pitches) // 12 - 1)
    max_note = note_names[max(pitches) % 12] + str(max(pitches) // 12 - 1)
    print(f"📊 음역대: {min_note} - {max_note}")
    
    # 기타 현별 분포 (15프렛 기준)
    string_ranges = {
        "E(저음현)": (40, 55),   # E2-G3
        "A현": (45, 60),         # A2-C4
        "D현": (50, 65),         # D3-F4
        "G현": (55, 70),         # G3-A#4
        "B현": (59, 74),         # B3-D5
        "E(고음현)": (64, 79)    # E4-G5
    }
    
    print("📊 기타 현별 분포:")
    for string_name, (low, high) in string_ranges.items():
        count = len([p for p in pitches if low <= p <= high])
        if count > 0:
            percentage = (count / total_notes) * 100
            print(f"   {string_name}: {count}개 ({percentage:.1f}%)")
    
    # 지속시간 분석
    durations = [note.end - note.start for note in notes]
    avg_duration = sum(durations) / len(durations)
    min_duration = min(durations)
    max_duration = max(durations)
    print(f"📊 노트 길이:")
    print(f"   평균: {avg_duration:.3f}초")
    print(f"   범위: {min_duration:.3f}초 - {max_duration:.3f}초")
    
    # 벨로시티 분석
    velocities = [note.velocity for note in notes]
    avg_velocity = sum(velocities) / len(velocities)
    print(f"📊 벨로시티:")
    print(f"   범위: {min(velocities)} - {max(velocities)}")
    print(f"   평균: {avg_velocity:.1f}")
    
    # 음악적 특성 분석
    print("📊 음악적 특성:")
    
    # 음정 간격 분석
    intervals = []
    for i in range(1, len(notes)):
        interval = abs(notes[i].pitch - notes[i-1].pitch)
        intervals.append(interval)
    
    if intervals:
        avg_interval = sum(intervals) / len(intervals)
        max_interval = max(intervals)
        print(f"   평균 음정 간격: {avg_interval:.1f} 반음")
        print(f"   최대 음정 점프: {max_interval} 반음")
    
    # 전체 곡 길이
    total_duration = max(note.end for note in notes) - min(note.start for note in notes)
    print(f"📊 전체 연주 시간: {total_duration:.1f}초")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("사용법: python midi_conversion_guitar_optimized.py <input.wav> <output.mid>")
        sys.exit(1)
    
    audio_path = sys.argv[1]
    output_path = sys.argv[2]
    convert_to_guitar_optimized_midi(audio_path, output_path)
