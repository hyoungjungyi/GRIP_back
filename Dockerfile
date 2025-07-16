FROM ubuntu:20.04

# 시간대 설정 (interactive 방지)
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Asia/Seoul

# 시스템 패키지 업데이트 및 Node.js 18 설치
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    gnupg \
    lsb-release \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Python 3.9 및 필수 도구 설치
RUN apt-get install -y \
    python3.9 \
    python3.9-venv \
    python3.9-dev \
    python3-pip \
    ffmpeg \
    git \
    build-essential \
    libsndfile1-dev \
    libasound2-dev \
    portaudio19-dev \
    libportaudio2 \
    libportaudiocpp0 \
    && rm -rf /var/lib/apt/lists/*

# Python3.9를 기본 python3으로 설정
RUN update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.9 1

# 작업 디렉토리 설정
WORKDIR /app

# Node.js 의존성 설치 (package.json을 먼저 복사해서 캐시 활용)
COPY package*.json ./
RUN npm ci --only=production

# Python 가상환경 생성 (Python 3.9 사용)
RUN python3.9 -m venv audio_env_39

# Python 패키지 설치 (pip 최신화 및 단계별 설치)
COPY requirements.txt ./
RUN ./audio_env_39/bin/python -m pip install --upgrade pip setuptools wheel
RUN ./audio_env_39/bin/pip install --no-cache-dir -r requirements.txt

# Spleeter 모델 사전 다운로드 (빌드 시간 단축)
RUN ./audio_env_39/bin/python -c "import spleeter; from spleeter.separator import Separator; Separator('spleeter:2stems-16kHz')"

# 애플리케이션 소스 복사
COPY . .

# 필요한 디렉토리 생성
RUN mkdir -p output temp uploads scripts

# 실행 권한 설정
RUN chmod +x audio_env_39/bin/python3

# 포트 노출 (Railway에서 PORT 환경변수 사용)
EXPOSE $PORT

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:$PORT/ || exit 1

# 시작 명령
CMD ["npm", "start"]
