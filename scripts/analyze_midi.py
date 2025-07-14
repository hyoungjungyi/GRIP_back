#!/usr/bin/env python3
"""
MIDI 파일 분석 도구
기타 연주 가능성과 Tabify 호환성 검사
"""

import pretty_midi
import sys

def analyze_midi_file(midi_path):
    """MIDI 파일 분석"""
    try:
        midi_data = pretty_midi.PrettyMIDI(midi_path)
        
        print(f"🎵 MIDI 파일 분석: {midi_path}")
        print(f"📊 총 트랙 수: {len(midi_data.instruments)}")
        print(f"📊 해상도: {midi_data.resolution} ticks per beat")
        
        if not midi_data.instruments:
            print("❌ 악기 트랙이 없습니다.")
            return
        
        instrument = midi_data.instruments[0]
        notes = instrument.notes
        
        print(f"📊 총 노트 수: {len(notes)}")
        print(f"📊 악기: {pretty_midi.program_to_instrument_name(instrument.program)}")
        print(f"📊 드럼 트랙 여부: {instrument.is_drum}")
        
        if not notes:
            print("❌ 노트가 없습니다.")
            return
        
        # 음역대 분석
        pitches = [note.pitch for note in notes]
        velocities = [note.velocity for note in notes]
        print(f"📊 음역대: {min(pitches)} - {max(pitches)}")
        print(f"📊 벨로시티: {min(velocities)} - {max(velocities)}")
        
        # 기타 표준 튜닝 범위 확인 (확장된 범위)
        # 확장된 범위: E2(40) ~ C4(60) - 15프렛 범위
        min_guitar_pitch = 40  # E2
        max_guitar_pitch = 60  # C4
        
        playable_range = (min_guitar_pitch, max_guitar_pitch)
        print(f"🎸 확장된 기타 연주 가능 범위: {playable_range[0]} - {playable_range[1]} (E2-C4, 15프렛)")
        
        # 범위 밖 노트 확인
        out_of_range = [p for p in pitches if p < playable_range[0] or p > playable_range[1]]
        if out_of_range:
            print(f"❌ 범위 밖 노트 {len(out_of_range)}개: {set(out_of_range)}")
        else:
            print("✅ 모든 노트가 기타 연주 가능 범위 내")
        
        # 노트 길이 분석
        durations = [note.end - note.start for note in notes]
        long_notes = [d for d in durations if d > 5.0]  # 5초 이상
        very_short_notes = [d for d in durations if d < 0.05]  # 50ms 이하
        
        print(f"📊 노트 길이 - 최소: {min(durations):.3f}초, 최대: {max(durations):.3f}초, 평균: {sum(durations)/len(durations):.3f}초")
        
        if long_notes:
            print(f"⚠️ 너무 긴 노트 {len(long_notes)}개 (5초 이상)")
        
        if very_short_notes:
            print(f"⚠️ 너무 짧은 노트 {len(very_short_notes)}개 (50ms 이하)")
        
        # 동시 발음 확인 (모노포닉인지)
        time_overlaps = 0
        sorted_notes = sorted(notes, key=lambda x: x.start)
        
        for i in range(len(sorted_notes) - 1):
            current = sorted_notes[i]
            next_note = sorted_notes[i + 1]
            
            if current.end > next_note.start:  # 겹침
                time_overlaps += 1
        
        if time_overlaps > 0:
            print(f"⚠️ 동시 발음(폴리포닉) 감지: {time_overlaps}개 겹침")
        else:
            print("✅ 모노포닉 (동시 발음 없음)")
        
        # 현별 분포 (확장된 범위)
        print("\n🎸 현별 분포 (확장된 범위):")
        string_ranges = {
            "E(저음현)": (40, 55),   # E2-G3 (0-15프렛)
            "A현": (45, 60),         # A2-C4 (0-15프렛)
            "D현": (50, 60),         # D3-C4 (0-10프렛)
            "G현": (55, 60),         # G3-C4 (0-5프렛)
        }
        
        for string_name, (low, high) in string_ranges.items():
            count = len([p for p in pitches if low <= p <= high])
            if count > 0:
                percentage = (count / len(pitches)) * 100
                print(f"  {string_name}: {count}개 ({percentage:.1f}%)")
        
        # 문제점 요약
        print("\n🔍 문제점 요약:")
        issues = []
        
        if out_of_range:
            issues.append(f"범위 밖 노트 {len(out_of_range)}개")
        
        if long_notes:
            issues.append(f"너무 긴 노트 {len(long_notes)}개")
        
        if very_short_notes:
            issues.append(f"너무 짧은 노트 {len(very_short_notes)}개")
        
        if time_overlaps > 0:
            issues.append(f"폴리포닉 겹침 {time_overlaps}개")
        
        if issues:
            for issue in issues:
                print(f"  ❌ {issue}")
        else:
            print("  ✅ 문제 없음")
            
    except Exception as e:
        print(f"❌ 분석 에러: {e}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("사용법: python analyze_midi.py <midi_file.mid>")
        sys.exit(1)
    
    midi_path = sys.argv[1]
    analyze_midi_file(midi_path)
