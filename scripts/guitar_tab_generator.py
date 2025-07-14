#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import pretty_midi
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import io

class GuitarTabGenerator:
    def __init__(self):
        # 기타 표준 튜닝 (6현부터 1현까지, 낮은음부터 높은음)
        self.standard_tuning = [40, 45, 50, 55, 59, 64]  # E A D G B E (MIDI 노트 번호)
        self.string_names = ['E', 'A', 'D', 'G', 'B', 'e']
        
        # A4 크기 TAB 설정 (300 DPI 기준)
        self.page_width = 2480  # A4 가로 (8.27인치 * 300 DPI)
        self.page_height = 3508  # A4 세로 (11.69인치 * 300 DPI)
        
        # TAB 라인 설정
        self.lines_per_page = 10  # 페이지당 줄 수
        self.line_height = 200    # 각 TAB 라인 높이
        self.string_spacing = 25  # 현 간격
        self.margin_left = 120    # 좌측 여백
        self.margin_right = 120   # 우측 여백
        self.margin_top = 150     # 상단 여백
        self.margin_bottom = 150  # 하단 여백
        
        # 노트 간격 설정
        self.min_note_spacing = 40  # 최소 노트 간격
        self.notes_per_line = 32    # 한 줄당 최대 노트 수
        
        # 사용 가능한 영역 계산
        self.usable_width = self.page_width - self.margin_left - self.margin_right
        self.usable_height = self.page_height - self.margin_top - self.margin_bottom
        
    def midi_to_tab_positions(self, midi_file_path):
        """MIDI 파일을 기타 TAB 위치로 변환"""
        try:
            midi_data = pretty_midi.PrettyMIDI(midi_file_path)
            
            if not midi_data.instruments:
                print("❌ MIDI 파일에 악기가 없습니다.")
                return []
            
            notes = midi_data.instruments[0].notes
            tab_positions = []
            
            print(f"📊 처리할 노트 수: {len(notes)}")
            
            for note in notes:
                # MIDI 노트를 기타 프렛 위치로 변환
                fret_positions = self.find_fret_positions(note.pitch)
                
                if fret_positions:
                    # 가장 적합한 위치 선택 (낮은 프렛 우선)
                    best_position = min(fret_positions, key=lambda x: x[1])
                    
                    tab_positions.append({
                        'time': note.start,
                        'string': best_position[0],  # 현 번호 (0-5)
                        'fret': best_position[1],    # 프렛 번호
                        'duration': note.end - note.start,
                        'velocity': note.velocity,
                        'pitch': note.pitch
                    })
            
            # 시간 순으로 정렬
            tab_positions.sort(key=lambda x: x['time'])
            
            print(f"✅ TAB 위치 변환 완료: {len(tab_positions)}개 노트")
            return tab_positions
            
        except Exception as e:
            print(f"❌ MIDI 변환 오류: {e}")
            return []
    
    def find_fret_positions(self, midi_pitch):
        """MIDI 피치를 기타 프렛 위치들로 변환"""
        positions = []
        
        for string_idx, open_pitch in enumerate(self.standard_tuning):
            # 이 현에서 해당 음을 낼 수 있는지 확인
            fret = midi_pitch - open_pitch
            
            # 0~15프렛 범위 내에서만 허용
            if 0 <= fret <= 15:
                positions.append((string_idx, fret))
        
        return positions
    
    def generate_tab_image(self, tab_positions, output_path):
        """A4 크기 다중 라인 TAB 악보 이미지 생성"""
        try:
            if not tab_positions:
                print("❌ TAB 위치가 없습니다.")
                return False
            
            # A4 이미지 생성
            img = Image.new('RGB', (self.page_width, self.page_height), 'white')
            draw = ImageDraw.Draw(img)
            
            # 폰트 설정
            try:
                title_font = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", 28)
                string_font = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", 20)
                fret_font = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", 16)
                small_font = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", 12)
            except:
                title_font = ImageFont.load_default()
                string_font = title_font
                fret_font = title_font
                small_font = title_font
            
            # 제목 그리기
            title = "Guitar Tablature"
            title_bbox = draw.textbbox((0, 0), title, font=title_font)
            title_width = title_bbox[2] - title_bbox[0]
            title_x = (self.page_width - title_width) // 2
            draw.text((title_x, 50), title, fill='black', font=title_font)
            
            # TAB 위치를 라인별로 분할
            tab_lines = self.split_tab_into_lines(tab_positions)
            
            print(f"📊 총 {len(tab_lines)}개 라인으로 분할")
            
            # 각 라인 그리기
            for line_idx, line_positions in enumerate(tab_lines):
                if line_idx >= self.lines_per_page:
                    print(f"⚠️ 페이지 용량 초과, {self.lines_per_page}줄까지만 표시")
                    break
                
                y_offset = self.margin_top + 100 + (line_idx * self.line_height)
                self.draw_tab_line(draw, line_positions, y_offset, string_font, fret_font, line_idx + 1)
            
            # 범례 추가
            self.draw_legend(draw, small_font)
            
            # 이미지 저장
            img.save(output_path, 'PNG', quality=95, dpi=(300, 300))
            print(f"✅ A4 TAB 이미지 저장: {output_path}")
            
            return True
            
        except Exception as e:
            print(f"❌ TAB 이미지 생성 오류: {e}")
            return False
    
    def split_tab_into_lines(self, tab_positions):
        """TAB 위치들을 읽기 좋은 라인들로 분할"""
        if not tab_positions:
            return []
        
        lines = []
        current_line = []
        
        # 고정된 간격으로 분할 (시간 기반)
        total_duration = max(pos['time'] for pos in tab_positions)
        line_duration = total_duration / self.lines_per_page if total_duration > 0 else 1
        
        current_line_end_time = line_duration
        
        for pos in tab_positions:
            if pos['time'] <= current_line_end_time and len(current_line) < self.notes_per_line:
                current_line.append(pos)
            else:
                if current_line:
                    lines.append(current_line)
                current_line = [pos]
                current_line_end_time += line_duration
        
        # 마지막 라인 추가
        if current_line:
            lines.append(current_line)
        
        return lines
    
    def draw_tab_line(self, draw, line_positions, y_offset, string_font, fret_font, line_number):
        """하나의 TAB 라인 그리기"""
        # 라인 번호 표시
        draw.text((20, y_offset), f"{line_number}", fill='gray', font=string_font)
        
        # 6개 현 라인 그리기
        for string_idx in range(6):
            y = y_offset + string_idx * self.string_spacing
            
            # 현 라인
            draw.line(
                [(self.margin_left, y), (self.page_width - self.margin_right, y)],
                fill='black',
                width=1
            )
            
            # 현 이름 (맨 왼쪽)
            string_name = self.string_names[string_idx]
            draw.text((self.margin_left - 40, y - 10), string_name, fill='black', font=string_font)
        
        # 마디 시작선
        draw.line(
            [(self.margin_left, y_offset), (self.margin_left, y_offset + 5 * self.string_spacing)],
            fill='black',
            width=2
        )
        
        # 노트 위치 계산 및 그리기
        if line_positions:
            self.draw_notes_on_line(draw, line_positions, y_offset, fret_font)
    
    def draw_notes_on_line(self, draw, line_positions, y_offset, fret_font):
        """한 라인에 노트들 그리기"""
        if not line_positions:
            return
        
        # 시간 순 정렬
        line_positions.sort(key=lambda x: x['time'])
        
        # 시간 범위 계산
        start_time = line_positions[0]['time']
        end_time = line_positions[-1]['time']
        time_range = max(end_time - start_time, 0.1)  # 최소값 설정
        
        # 각 노트 위치 계산
        for i, pos in enumerate(line_positions):
            # X 위치 계산 (균등 간격 + 시간 기반)
            if time_range > 0:
                time_ratio = (pos['time'] - start_time) / time_range
            else:
                time_ratio = i / max(len(line_positions) - 1, 1)
            
            # 균등한 간격 보장
            base_x = self.margin_left + 60 + (i * self.min_note_spacing)
            time_x = self.margin_left + 60 + (time_ratio * (self.usable_width - 120))
            
            # 두 방식의 가중 평균 (균등성 우선)
            x = int(base_x * 0.7 + time_x * 0.3)
            
            # 페이지 범위 내로 제한
            x = min(x, self.page_width - self.margin_right - 30)
            
            # Y 위치 (현 위치)
            y = y_offset + pos['string'] * self.string_spacing
            
            # 프렛 번호 그리기
            self.draw_fret_number(draw, x, y, pos['fret'], pos['velocity'], fret_font)
    
    def draw_fret_number(self, draw, x, y, fret, velocity, font):
        """프렛 번호 그리기 (배경 원 포함)"""
        fret_text = str(fret)
        
        # 텍스트 크기 계산
        bbox = draw.textbbox((0, 0), fret_text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        
        # 배경 원 크기
        circle_radius = max(text_width, text_height) // 2 + 8
        
        # 벨로시티에 따른 색상 선택
        if velocity > 90:
            bg_color = 'red'
            outline_color = 'darkred'
        elif velocity > 70:
            bg_color = 'orange'
            outline_color = 'darkorange'
        elif velocity > 50:
            bg_color = 'lightblue'
            outline_color = 'blue'
        else:
            bg_color = 'lightgray'
            outline_color = 'gray'
        
        # 배경 원 그리기
        draw.ellipse(
            [x - circle_radius, y - circle_radius,
             x + circle_radius, y + circle_radius],
            fill=bg_color,
            outline=outline_color,
            width=2
        )
        
        # 프렛 번호 텍스트
        draw.text(
            (x - text_width//2, y - text_height//2),
            fret_text,
            fill='black',
            font=font
        )
        
        # 오픈 스트링 표시 (0프렛)
        if fret == 0:
            draw.ellipse(
                [x - circle_radius - 3, y - circle_radius - 3,
                 x + circle_radius + 3, y + circle_radius + 3],
                fill=None,
                outline='green',
                width=3
            )
    
    def draw_legend(self, draw, font):
        """범례 그리기"""
        legend_y = self.page_height - 120
        
        draw.text((self.margin_left, legend_y), "Legend:", fill='black', font=font)
        legend_y += 25
        
        # 벨로시티 범례
        legends = [
            ("High velocity (>90)", 'red'),
            ("Medium velocity (70-90)", 'orange'),
            ("Low velocity (50-70)", 'lightblue'),
            ("Very low velocity (<50)", 'lightgray'),
            ("Open string (0 fret)", 'white')
        ]
        
        for i, (text, color) in enumerate(legends):
            x = self.margin_left + (i % 2) * 400
            y = legend_y + (i // 2) * 20
            
            # 작은 원 그리기
            draw.ellipse([x, y, x + 12, y + 12], fill=color, outline='black')
            # 텍스트
            draw.text((x + 20, y - 2), text, fill='black', font=font)
    
    def generate_text_tab(self, tab_positions, output_path):
        """텍스트 형식 TAB 생성"""
        try:
            if not tab_positions:
                print("❌ TAB 위치가 없습니다.")
                return False
            
            # 시간을 기준으로 위치 분할
            time_positions = self.group_by_time(tab_positions)
            
            # 텍스트 TAB 생성
            tab_lines = ['e|', 'B|', 'G|', 'D|', 'A|', 'E|']
            
            for time_group in time_positions:
                # 각 현에 대해 프렛 번호 또는 '-' 추가
                current_frets = ['-'] * 6
                
                for pos in time_group:
                    string_idx = 5 - pos['string']  # 역순 (e현이 위)
                    current_frets[string_idx] = str(pos['fret'])
                
                # 프렛 번호 정렬 (최대 2자리)
                for i, fret in enumerate(current_frets):
                    tab_lines[i] += f"{fret:>2}-"
            
            # 파일 저장
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write("Guitar TAB\n")
                f.write("=" * 50 + "\n\n")
                for line in tab_lines:
                    f.write(line + "\n")
                
                f.write("\n" + "=" * 50 + "\n")
                f.write(f"Total notes: {len(tab_positions)}\n")
            
            print(f"✅ 텍스트 TAB 저장: {output_path}")
            return True
            
        except Exception as e:
            print(f"❌ 텍스트 TAB 생성 오류: {e}")
            return False
    
    def group_by_time(self, tab_positions, time_threshold=0.1):
        """시간별로 노트 그룹화"""
        if not tab_positions:
            return []
        
        groups = []
        current_group = [tab_positions[0]]
        
        for i in range(1, len(tab_positions)):
            current_pos = tab_positions[i]
            last_pos = current_group[-1]
            
            # 시간 차이가 임계값보다 작으면 같은 그룹
            if abs(current_pos['time'] - last_pos['time']) <= time_threshold:
                current_group.append(current_pos)
            else:
                groups.append(current_group)
                current_group = [current_pos]
        
        groups.append(current_group)
        return groups
    
    def print_statistics(self, tab_positions):
        """TAB 통계 출력"""
        if not tab_positions:
            print("📊 통계: 노트가 없습니다.")
            return
        
        print(f"📊 총 노트 수: {len(tab_positions)}")
        
        # 현별 분포
        string_usage = [0] * 6
        for pos in tab_positions:
            string_usage[pos['string']] += 1
        
        print("📊 현별 사용 분포:")
        for i, count in enumerate(string_usage):
            percentage = (count / len(tab_positions)) * 100
            print(f"   {self.string_names[i]}현: {count}개 ({percentage:.1f}%)")
        
        # 프렛 분포
        fret_usage = {}
        for pos in tab_positions:
            fret = pos['fret']
            fret_usage[fret] = fret_usage.get(fret, 0) + 1
        
        print("📊 주요 프렛 사용:")
        sorted_frets = sorted(fret_usage.items(), key=lambda x: x[1], reverse=True)
        for fret, count in sorted_frets[:5]:
            percentage = (count / len(tab_positions)) * 100
            print(f"   {fret}프렛: {count}개 ({percentage:.1f}%)")

def generate_guitar_tab(midi_file_path, output_image_path, output_text_path=None):
    """메인 함수: MIDI 파일을 기타 TAB으로 변환"""
    print("🎸 기타 TAB 생성 시작...")
    
    generator = GuitarTabGenerator()
    
    # MIDI → TAB 변환
    tab_positions = generator.midi_to_tab_positions(midi_file_path)
    
    if not tab_positions:
        print("❌ TAB 생성 실패: 유효한 노트가 없습니다.")
        return False
    
    # 통계 출력
    generator.print_statistics(tab_positions)
    
    # 이미지 TAB 생성
    image_success = generator.generate_tab_image(tab_positions, output_image_path)
    
    # 텍스트 TAB 생성 (옵션)
    text_success = True
    if output_text_path:
        text_success = generator.generate_text_tab(tab_positions, output_text_path)
    
    if image_success:
        print("✅ 기타 TAB 생성 완료!")
        return True
    else:
        print("❌ 기타 TAB 생성 실패!")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("사용법: python guitar_tab_generator.py <input.mid> <output.png> [output.txt]")
        sys.exit(1)
    
    midi_file = sys.argv[1]
    output_image = sys.argv[2]
    output_text = sys.argv[3] if len(sys.argv) > 3 else None
    
    success = generate_guitar_tab(midi_file, output_image, output_text)
    sys.exit(0 if success else 1)
