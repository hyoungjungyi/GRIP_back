#!/usr/bin/env python3
"""
Tabify를 사용한 MIDI to TAB 변환기
GitHub: https://github.com/roelvanduijnhoven/tabify
"""

import sys
import os
import subprocess
import tempfile
import shutil

def convert_midi_to_tab_with_tabify(input_midi_path, output_tab_path, output_text_path=None):
    """Tabify를 사용하여 MIDI를 TAB으로 변환"""
    try:
        print("🎸 Tabify를 사용한 MIDI → TAB 변환 시작...")
        print(f"📥 입력 MIDI: {input_midi_path}")
        print(f"📤 출력 TAB: {output_tab_path}")
        
        # Tabify 실행 가능 여부 확인
        try:
            result = subprocess.run(['tabify', '--version'], 
                                  capture_output=True, text=True, timeout=10)
            print(f"✅ Tabify 버전: {result.stdout.strip()}")
        except FileNotFoundError:
            print("❌ Tabify가 설치되어 있지 않습니다.")
            print("설치 방법: npm install -g tabify")
            return False
        except Exception as e:
            print(f"❌ Tabify 버전 확인 실패: {e}")
            return False
        
        # Tabify 명령어 실행 (stdout으로 TAB 출력)
        cmd = [
            'tabify',
            input_midi_path
        ]
        
        print(f"🚀 Tabify 실행: {' '.join(cmd)}")
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        
        if result.returncode == 0:
            print("✅ Tabify 변환 성공!")
            
            # stdout에서 TAB 결과 가져오기
            tab_content = result.stdout
            
            if tab_content.strip() and "Song is unplayable" not in tab_content:
                print(f"📊 생성된 TAB 길이: {len(tab_content)} 문자")
                
                # 텍스트 TAB 저장 (요청된 경우)
                if output_text_path:
                    with open(output_text_path, 'w', encoding='utf-8') as f:
                        f.write(tab_content)
                    print(f"💾 텍스트 TAB 저장: {output_text_path}")
                
                # 이미지 변환을 위해 간단한 ASCII 아트 생성
                create_tab_image_from_text(tab_content, output_tab_path)
                
                return True
            else:
                print("❌ Tabify에서 연주 불가능한 곡이라고 판단했습니다.")
                print(f"STDOUT: {tab_content}")
                print(f"STDERR: {result.stderr}")
                return False
        else:
            print(f"❌ Tabify 실행 실패 (코드: {result.returncode})")
            print(f"STDOUT: {result.stdout}")
            print(f"STDERR: {result.stderr}")
            return False
                
    except subprocess.TimeoutExpired:
        print("❌ Tabify 실행 시간 초과")
        return False
    except Exception as e:
        print(f"❌ Tabify 변환 오류: {e}")
        return False

def create_tab_image_from_text(tab_text, output_image_path):
    """텍스트 TAB을 이미지로 변환"""
    try:
        from PIL import Image, ImageDraw, ImageFont
        
        # 이미지 설정
        font_size = 12
        line_height = 16
        margin = 20
        bg_color = (255, 255, 255)  # 흰색 배경
        text_color = (0, 0, 0)      # 검은색 텍스트
        
        # 폰트 설정 (모노스페이스)
        try:
            font = ImageFont.truetype("Monaco.ttf", font_size)
        except:
            try:
                font = ImageFont.truetype("Courier.ttf", font_size)
            except:
                font = ImageFont.load_default()
        
        # 텍스트 줄 분리
        lines = tab_text.split('\n')
        max_width = max(len(line) for line in lines if line.strip()) if lines else 80
        
        # 이미지 크기 계산
        char_width = 7  # 추정 문자 너비
        image_width = max_width * char_width + 2 * margin
        image_height = len(lines) * line_height + 2 * margin
        
        # A4 비율로 조정 (필요시)
        if image_width > 800:
            image_width = 800
        if image_height > 1000:
            image_height = 1000
        
        # 이미지 생성
        image = Image.new('RGB', (image_width, image_height), bg_color)
        draw = ImageDraw.Draw(image)
        
        # 텍스트 그리기
        y = margin
        for line in lines:
            if y + line_height > image_height - margin:
                break
            draw.text((margin, y), line, fill=text_color, font=font)
            y += line_height
        
        # 이미지 저장
        image.save(output_image_path, 'PNG', quality=95)
        print(f"🖼️ TAB 이미지 저장: {output_image_path}")
        
        return True
        
    except ImportError:
        print("⚠️ PIL 모듈이 없어 이미지 생성을 건너뜁니다.")
        # 간단한 더미 이미지 생성
        with open(output_image_path.replace('.png', '_dummy.txt'), 'w') as f:
            f.write("TAB 이미지 생성 실패 - PIL 모듈 필요")
        return False
    except Exception as e:
        print(f"❌ 이미지 생성 오류: {e}")
        return False

def install_tabify():
    """Tabify 설치 안내"""
    print("📦 Tabify 설치가 필요합니다.")
    print("다음 명령어로 설치하세요:")
    print("  npm install -g tabify")
    print("또는:")
    print("  yarn global add tabify")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("사용법: python tabify_converter.py <input.mid> <output.png> [output.txt]")
        sys.exit(1)
    
    input_midi = sys.argv[1]
    output_image = sys.argv[2]
    output_text = sys.argv[3] if len(sys.argv) > 3 else None
    
    if not os.path.exists(input_midi):
        print(f"❌ 입력 파일이 존재하지 않습니다: {input_midi}")
        sys.exit(1)
    
    success = convert_midi_to_tab_with_tabify(input_midi, output_image, output_text)
    
    if not success:
        install_tabify()
        sys.exit(1)
    
    print("✅ Tabify 변환 완료!")
    sys.exit(0)
