FROM node:18

# 시스템 패키지 업데이트 및 필수 도구 설치
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    ffmpeg \
    git \
    wget \
    curl \
    build-essential \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# 작업 디렉토리 설정
WORKDIR /app

# Node.js 의존성 설치 (package.json을 먼저 복사해서 캐시 활용)
COPY package*.json ./
RUN npm ci --only=production

# Python 가상환경 생성
RUN python3 -m venv audio_env_39

# Python 패키지 설치
COPY requirements.txt ./
RUN ./audio_env_39/bin/pip install --upgrade pip
RUN ./audio_env_39/bin/pip install -r requirements.txt

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
