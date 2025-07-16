const path = require('path');

// Python 환경 설정 함수
function getPythonConfig() {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDocker = process.env.DOCKER_ENV === 'true' || process.env.RAILWAY_ENVIRONMENT;
  
  if (isProduction || isDocker) {
    // Docker/Railway 환경
    return {
      pythonPath: path.join(__dirname, "../audio_env_39/bin/python3"),
      scriptsDir: path.join(__dirname, "../scripts"),
      outputDir: path.join(__dirname, "../output"),
      tempDir: path.join(__dirname, "../temp")
    };
  } else {
    // 로컬 환경
    return {
      pythonPath: path.join(__dirname, "../audio_env_39/bin/python3"),
      scriptsDir: path.join(__dirname, "../scripts"),
      outputDir: path.join(__dirname, "../output"),
      tempDir: path.join(__dirname, "../temp")
    };
  }
}

module.exports = { getPythonConfig };
