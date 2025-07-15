#!/usr/bin/env python3
"""
오디오 파일 업로드 테스트
"""

import requests

# 테스트 토큰 (로그에서 확인한 유효한 토큰)
token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiZ29vZ2xlSWQiOiIxMTU0MDM1MzQ5MTAzODc4Njk2NDMiLCJ1c2VybmFtZSI6Ildpbm5lciBDaG9pY2hpIiwiaWF0IjoxNzUyNTU2NTcwLCJleHAiOjE3NTI1NjAxNzB9.oF5J6KlbvDV5eIu3ZuJ0Fmp3MA-QgnyyY0-wqtKWDZQ"

# 테스트용 작은 오디오 파일 생성
import tempfile
import os

# 작은 테스트 파일 생성 (빈 파일이지만 확장자는 mp3)
with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as tmp_file:
    tmp_file.write(b"fake audio content for testing")
    test_file_path = tmp_file.name

print(f"🎵 테스트 파일 생성: {test_file_path}")

try:
    # 오디오 업로드 요청
    with open(test_file_path, 'rb') as audio_file:
        files = {
            'audio': ('test_audio.mp3', audio_file, 'audio/mpeg')
        }
        data = {
            'songTitle': 'Test Audio Upload'
        }
        headers = {
            'Authorization': f'Bearer {token}'
        }
        
        print("🚀 오디오 업로드 요청 시작...")
        response = requests.post(
            'http://localhost:5500/api/files/upload-audio',
            files=files,
            data=data,
            headers=headers,
            timeout=30
        )
        
        print(f"📊 응답 상태: {response.status_code}")
        print(f"📝 응답 내용: {response.text}")
        
        if response.status_code == 200:
            print("✅ 업로드 성공!")
        else:
            print(f"❌ 업로드 실패: {response.status_code}")
            
except Exception as e:
    print(f"❌ 요청 오류: {e}")
    
finally:
    # 임시 파일 삭제
    if os.path.exists(test_file_path):
        os.unlink(test_file_path)
        print("🗑️ 임시 파일 삭제됨")
