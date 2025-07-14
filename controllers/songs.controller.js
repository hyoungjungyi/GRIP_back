const { Song, PracticeRecord, SavedSong } = require("../models");
const { Op, Sequelize } = require("sequelize");
const youtubedl = require("youtube-dl-exec");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

// YouTube 오디오 다운로드 함수
async function downloadYouTubeAudio(youtubeUrl, outputPath) {
  return new Promise((resolve) => {
    console.log(`🎵 YouTube 오디오 다운로드 시작: ${youtubeUrl}`);
    console.log(`📁 출력 경로: ${outputPath}`);

    const options = {
      format: 'bestaudio[ext=m4a]/best[ext=mp4]/best',
      extractAudio: true,
      audioFormat: 'wav',
      output: outputPath,
      noPlaylist: true,
    };

    youtubedl(youtubeUrl, options)
      .then(() => {
        console.log("✅ YouTube 오디오 다운로드 완료");
        
        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          console.log(`📊 다운로드된 파일 크기: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
          
          resolve({
            success: true,
            filePath: outputPath,
            fileSize: stats.size
          });
        } else {
          console.error("❌ 다운로드된 파일을 찾을 수 없음");
          resolve({
            success: false,
            error: "다운로드된 파일을 찾을 수 없습니다."
          });
        }
      })
      .catch((error) => {
        console.error("❌ YouTube 다운로드 오류:", error);
        resolve({
          success: false,
          error: error.message || "YouTube 다운로드 실패"
        });
      });
  });
}

// 기타 음원 분리 함수
async function separateGuitar(inputAudioPath, outputGuitarPath) {
  return new Promise((resolve) => {
    const pythonEnvPath = path.join(__dirname, "../audio_env/bin/python3");
    const scriptPath = path.join(__dirname, "../scripts/guitar_separation.py");

    console.log(`🐍 Python 스크립트 실행: ${scriptPath}`);
    console.log(`📥 입력: ${inputAudioPath}`);
    console.log(`📤 출력: ${outputGuitarPath}`);

    const pythonProcess = spawn(
      pythonEnvPath,
      [scriptPath, inputAudioPath, outputGuitarPath],
      {
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    let stdout = "";
    let stderr = "";

    pythonProcess.stdout.on("data", (data) => {
      const output = data.toString();
      stdout += output;
      console.log(`🐍 ${output.trim()}`);
    });

    pythonProcess.stderr.on("data", (data) => {
      const error = data.toString();
      stderr += error;
      console.error(`🐍 ERROR: ${error.trim()}`);
    });

    pythonProcess.on("close", (code) => {
      if (code === 0) {
        console.log("✅ 기타 분리 Python 스크립트 완료");

        try {
          // 출력 파일 확인
          if (fs.existsSync(outputGuitarPath)) {
            const stats = fs.statSync(outputGuitarPath);
            resolve({
              success: true,
              output_path: outputGuitarPath,
              file_size_mb: (stats.size / 1024 / 1024).toFixed(2),
              stdout: stdout,
            });
          } else {
            resolve({
              success: false,
              error: "기타 분리 파일이 생성되지 않음",
              stdout: stdout,
              stderr: stderr,
            });
          }
        } catch (error) {
          resolve({
            success: false,
            error: error.message,
            stdout: stdout,
            stderr: stderr,
          });
        }
      } else {
        console.error(`❌ Python 스크립트 종료 코드: ${code}`);
        resolve({
          success: false,
          error: `Python 스크립트 실행 실패 (코드: ${code})`,
          stdout: stdout,
          stderr: stderr,
        });
      }
    });

    pythonProcess.on("error", (error) => {
      console.error(`❌ Python 프로세스 오류:`, error);
      resolve({
        success: false,
        error: error.message,
        stdout: stdout,
        stderr: stderr,
      });
    });
  });
}

// MIDI 변환 함수 (향상된 음악적 품질)
async function convertToMidi(inputGuitarPath, outputMidiPath) {
  return new Promise(async (resolve) => {
    const pythonEnvPath = path.join(__dirname, "../audio_env_39/bin/python3");
    
    // 1차 시도: 향상된 음악적 MIDI 변환
    console.log(`🎵 향상된 음악적 MIDI 변환 시도 중...`);
    const enhancedResult = await tryEnhancedMidiConversion(inputGuitarPath, outputMidiPath, pythonEnvPath);
    
    if (enhancedResult.success) {
      console.log("✅ 향상된 음악적 MIDI 변환 성공!");
      resolve({
        ...enhancedResult,
        conversion_type: "enhanced_musical"
      });
      return;
    }

    console.log("🔄 향상된 변환 실패, 기타 최적화 버전으로 재시도...");
    // 2차 시도: 기타 최적화 버전
    const optimizedResult = await tryOptimizedMidiConversion(inputGuitarPath, outputMidiPath, pythonEnvPath);
    
    if (optimizedResult.success) {
      console.log("✅ 기타 최적화 MIDI 변환 성공!");
      resolve({
        ...optimizedResult,
        conversion_type: "guitar_optimized"
      });
      return;
    }

    console.log("🔄 최적화 변환 실패, 기본 버전으로 재시도...");
    // 3차 시도: 기본 버전
    const basicResult = await tryBasicMidiConversion(inputGuitarPath, outputMidiPath, pythonEnvPath);
    
    resolve({
      ...basicResult,
      conversion_type: basicResult.success ? "basic" : "failed"
    });
  });
}

// Tabify 호환 MIDI 변환 시도
async function tryTabifyCompatibleMidiConversion(inputGuitarPath, outputMidiPath, pythonEnvPath) {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, "../scripts/midi_conversion_tabify_compatible.py");

    console.log(`🎸 Tabify 호환 MIDI 변환 실행: ${scriptPath}`);

    const pythonProcess = spawn(pythonEnvPath, [scriptPath, inputGuitarPath, outputMidiPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(`🎸 ${output.trim()}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      const error = data.toString();
      stderr += error;
      console.error(`🎸 ERROR: ${error.trim()}`);
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        console.log("✅ Tabify 호환 MIDI 변환 완료");

        try {
          if (fs.existsSync(outputMidiPath)) {
            const stats = fs.statSync(outputMidiPath);
            resolve({
              success: true,
              output_path: outputMidiPath,
              file_size_mb: (stats.size / (1024 * 1024)).toFixed(2),
              stdout: stdout,
              stderr: stderr,
            });
          } else {
            console.error("❌ 출력 파일이 생성되지 않음");
            resolve({
              success: false,
              error: "출력 파일이 생성되지 않았습니다.",
              stdout: stdout,
              stderr: stderr,
            });
          }
        } catch (error) {
          console.error("❌ 파일 시스템 오류:", error);
          resolve({
            success: false,
            error: error.message,
            stdout: stdout,
            stderr: stderr,
          });
        }
      } else {
        console.error(`❌ Tabify 호환 MIDI 변환 실패 (종료 코드: ${code})`);
        resolve({
          success: false,
          error: `Tabify 호환 MIDI 변환 실패 (코드: ${code})`,
          stdout: stdout,
          stderr: stderr,
        });
      }
    });

    pythonProcess.on('error', (error) => {
      console.error(`❌ Python 프로세스 오류:`, error);
      resolve({
        success: false,
        error: error.message,
        stdout: stdout,
        stderr: stderr,
      });
    });
  });
}

// 향상된 음악적 MIDI 변환 시도
async function tryEnhancedMidiConversion(inputGuitarPath, outputMidiPath, pythonEnvPath) {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, "../scripts/midi_conversion_enhanced_musical.py");

    console.log(`🎵 향상된 음악적 MIDI 변환 실행: ${scriptPath}`);
    console.log(`📥 입력: ${inputGuitarPath}`);
    console.log(`📤 출력: ${outputMidiPath}`);

    const pythonProcess = spawn(pythonEnvPath, [scriptPath, inputGuitarPath, outputMidiPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(`🎵 ${output.trim()}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      const error = data.toString();
      stderr += error;
      console.error(`🎵 ERROR: ${error.trim()}`);
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        console.log("✅ 향상된 음악적 MIDI 변환 완료");

        try {
          if (fs.existsSync(outputMidiPath)) {
            const stats = fs.statSync(outputMidiPath);
            resolve({
              success: true,
              output_path: outputMidiPath,
              file_size_kb: (stats.size / 1024).toFixed(2),
              stdout: stdout,
              quality: "enhanced_musical"
            });
          } else {
            resolve({
              success: false,
              error: "향상된 MIDI 파일이 생성되지 않음",
              stdout: stdout,
              stderr: stderr
            });
          }
        } catch (error) {
          resolve({
            success: false,
            error: error.message,
            stdout: stdout,
            stderr: stderr
          });
        }
      } else {
        console.error(`❌ 향상된 MIDI 변환 실패 코드: ${code}`);
        resolve({
          success: false,
          error: `향상된 MIDI 변환 실패 (코드: ${code})`,
          stdout: stdout,
          stderr: stderr
        });
      }
    });

    pythonProcess.on('error', (error) => {
      console.error(`❌ Python 프로세스 오류:`, error);
      resolve({
        success: false,
        error: error.message,
        stdout: stdout,
        stderr: stderr
      });
    });
  });
}

// 기타 최적화 MIDI 변환 시도
async function tryOptimizedMidiConversion(inputGuitarPath, outputMidiPath, pythonEnvPath) {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, "../scripts/midi_conversion_guitar_optimized.py");

    console.log(`🎸 기타 최적화 MIDI 변환 실행: ${scriptPath}`);

    const pythonProcess = spawn(pythonEnvPath, [scriptPath, inputGuitarPath, outputMidiPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(`🎸 ${output.trim()}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      const error = data.toString();
      stderr += error;
      console.error(`🎸 ERROR: ${error.trim()}`);
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        console.log("✅ 기타 최적화 MIDI 변환 완료");

        try {
          if (fs.existsSync(outputMidiPath)) {
            const stats = fs.statSync(outputMidiPath);
            resolve({
              success: true,
              output_path: outputMidiPath,
              file_size_kb: (stats.size / 1024).toFixed(2),
              stdout: stdout,
              quality: "guitar_optimized"
            });
          } else {
            resolve({
              success: false,
              error: "최적화 MIDI 파일이 생성되지 않음",
              stdout: stdout,
              stderr: stderr
            });
          }
        } catch (error) {
          resolve({
            success: false,
            error: error.message,
            stdout: stdout,
            stderr: stderr
          });
        }
      } else {
        console.error(`❌ 최적화 MIDI 변환 실패 코드: ${code}`);
        resolve({
          success: false,
          error: `최적화 MIDI 변환 실패 (코드: ${code})`,
          stdout: stdout,
          stderr: stderr
        });
      }
    });

    pythonProcess.on('error', (error) => {
      console.error(`❌ Python 프로세스 오류:`, error);
      resolve({
        success: false,
        error: error.message,
        stdout: stdout,
        stderr: stderr
      });
    });
  });
}

// 기본 MIDI 변환 시도
async function tryBasicMidiConversion(inputGuitarPath, outputMidiPath, pythonEnvPath) {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, "../scripts/midi_conversion.py");

    console.log(`🐍 기본 MIDI 변환 실행: ${scriptPath}`);

    const pythonProcess = spawn(pythonEnvPath, [scriptPath, inputGuitarPath, outputMidiPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(`🐍 ${output.trim()}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      const error = data.toString();
      stderr += error;
      console.error(`🐍 ERROR: ${error.trim()}`);
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        console.log("✅ 기본 MIDI 변환 완료");

        try {
          if (fs.existsSync(outputMidiPath)) {
            const stats = fs.statSync(outputMidiPath);
            resolve({
              success: true,
              output_path: outputMidiPath,
              file_size_kb: (stats.size / 1024).toFixed(2),
              stdout: stdout,
              quality: "basic"
            });
          } else {
            resolve({
              success: false,
              error: "기본 MIDI 파일이 생성되지 않음",
              stdout: stdout,
              stderr: stderr
            });
          }
        } catch (error) {
          resolve({
            success: false,
            error: error.message,
            stdout: stdout,
            stderr: stderr
          });
        }
      } else {
        console.error(`❌ 기본 MIDI 변환 실패 코드: ${code}`);
        resolve({
          success: false,
          error: `기본 MIDI 변환 실패 (코드: ${code})`,
          stdout: stdout,
          stderr: stderr
        });
      }
    });

    pythonProcess.on('error', (error) => {
      console.error(`❌ Python 프로세스 오류:`, error);
      resolve({
        success: false,
        error: error.message,
        stdout: stdout,
        stderr: stderr
      });
    });
  });
}

// 기타 스템 분리 함수 (향상된 버전 사용)
async function separateGuitarStem(inputAudioPath, outputGuitarPath, pythonEnvPath) {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, "../scripts/guitar_separation_improved.py");

    console.log(`🎸 기타 스템 분리 실행: ${scriptPath}`);
    console.log(`📥 입력: ${inputAudioPath}`);
    console.log(`📤 출력: ${outputGuitarPath}`);

    const pythonProcess = spawn(pythonEnvPath, [scriptPath, inputAudioPath, outputGuitarPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(`🐍 ${output.trim()}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      const error = data.toString();
      stderr += error;
      console.error(`🐍 ERROR: ${error.trim()}`);
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        console.log("✅ 기타 스템 분리 완료");
        
        try {
          if (fs.existsSync(outputGuitarPath)) {
            const stats = fs.statSync(outputGuitarPath);
            resolve({
              success: true,
              output_path: outputGuitarPath,
              file_size_mb: (stats.size / (1024 * 1024)).toFixed(2),
              stdout: stdout,
              stderr: stderr
            });
          } else {
            console.error("❌ 출력 파일이 생성되지 않음");
            resolve({
              success: false,
              error: "출력 파일이 생성되지 않았습니다.",
              stdout: stdout,
              stderr: stderr
            });
          }
        } catch (error) {
          console.error("❌ 파일 시스템 오류:", error);
          resolve({
            success: false,
            error: error.message,
            stdout: stdout,
            stderr: stderr
          });
        }
      } else {
        console.error(`❌ 기타 스템 분리 실패 (종료 코드: ${code})`);
        resolve({
          success: false,
          error: `프로세스가 코드 ${code}로 종료되었습니다.`,
          stdout: stdout,
          stderr: stderr
        });
      }
    });

    pythonProcess.on('error', (error) => {
      console.error(`❌ Python 프로세스 오류:`, error);
      resolve({
        success: false,
        error: error.message,
        stdout: stdout,
        stderr: stderr
      });
    });
  });
}

async function separateGuitarEnhanced(inputAudioPath, outputGuitarPath) {
  return new Promise((resolve) => {
    const pythonEnvPath = path.join(__dirname, "../audio_env_39/bin/python3");
    const scriptPath = path.join(__dirname, "../scripts/guitar_separation_improved.py");

    console.log(`🎸 향상된 기타 분리 실행: ${scriptPath}`);
    console.log(`📥 입력: ${inputAudioPath}`);
    console.log(`📤 출력: ${outputGuitarPath}`);

    const pythonProcess = spawn(pythonEnvPath, [scriptPath, inputAudioPath, outputGuitarPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(`🐍 ${output.trim()}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      const error = data.toString();
      stderr += error;
      console.error(`🐍 ERROR: ${error.trim()}`);
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        console.log("✅ 향상된 기타 분리 완료");
        
        try {
          if (fs.existsSync(outputGuitarPath)) {
            const stats = fs.statSync(outputGuitarPath);
            resolve({
              success: true,
              output_path: outputGuitarPath,
              file_size_mb: (stats.size / (1024 * 1024)).toFixed(2),
              stdout: stdout,
              enhanced: true
            });
          } else {
            resolve({
              success: false,
              error: "향상된 기타 파일이 생성되지 않음",
              stdout: stdout,
              stderr: stderr
            });
          }
        } catch (error) {
          resolve({
            success: false,
            error: error.message,
            stdout: stdout,
            stderr: stderr
          });
        }
      } else {
        console.error(`❌ 향상된 기타 분리 실패 코드: ${code}`);
        resolve({
          success: false,
          error: `향상된 기타 분리 실패 (코드: ${code})`,
          stdout: stdout,
          stderr: stderr,
        });
      }
    });

    pythonProcess.on("error", (error) => {
      console.error(`❌ Python 프로세스 오류:`, error);
      resolve({
        success: false,
        error: error.message,
        stdout: stdout,
        stderr: stderr,
      });
    });
  });
}

// 모노포닉 MIDI 변환 함수
async function convertToMonophonicMidi(inputGuitarPath, outputMidiPath) {
  return new Promise((resolve) => {
    const pythonEnvPath = path.join(__dirname, "../audio_env_39/bin/python3");
    const scriptPath = path.join(__dirname, "../scripts/midi_conversion_monophonic.py");

    console.log(`🎵 모노포닉 MIDI 변환 실행: ${scriptPath}`);
    console.log(`📥 입력: ${inputGuitarPath}`);
    console.log(`📤 출력: ${outputMidiPath}`);

    const pythonProcess = spawn(pythonEnvPath, [scriptPath, inputGuitarPath, outputMidiPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(`🐍 ${output.trim()}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      const error = data.toString();
      stderr += error;
      console.error(`🐍 ERROR: ${error.trim()}`);
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        console.log("✅ 모노포닉 MIDI 변환 완료");

        try {
          if (fs.existsSync(outputMidiPath)) {
            const stats = fs.statSync(outputMidiPath);
            resolve({
              success: true,
              output_path: outputMidiPath,
              file_size_kb: (stats.size / 1024).toFixed(2),
              stdout: stdout,
              monophonic: true
            });
          } else {
            resolve({
              success: false,
              error: "모노포닉 MIDI 파일이 생성되지 않음",
              stdout: stdout,
              stderr: stderr
            });
          }
        } catch (error) {
          resolve({
            success: false,
            error: error.message,
            stdout: stdout,
            stderr: stderr
          });
        }
      } else {
        console.error(`❌ 모노포닉 MIDI 변환 실패 코드: ${code}`);
        resolve({
          success: false,
          error: `모노포닉 MIDI 변환 실패 (코드: ${code})`,
          stdout: stdout,
          stderr: stderr,
        });
      }
    });

    pythonProcess.on("error", (error) => {
      console.error(`❌ Python 프로세스 오류:`, error);
      resolve({
        success: false,
        error: error.message,
        stdout: stdout,
        stderr: stderr,
      });
    });
  });
}

// 기타 TAB 생성 함수
async function generateGuitarTab(inputMidiPath, outputTabImagePath, outputTabTextPath = null) {
  return new Promise((resolve) => {
    const pythonEnvPath = path.join(__dirname, "../audio_env_39/bin/python3");
    const scriptPath = path.join(__dirname, "../scripts/guitar_tab_generator.py");

    console.log(`🎸 기타 TAB 생성 실행: ${scriptPath}`);
    console.log(`📥 입력: ${inputMidiPath}`);
    console.log(`📤 출력: ${outputTabImagePath}`);

    const args = [scriptPath, inputMidiPath, outputTabImagePath];
    if (outputTabTextPath) {
      args.push(outputTabTextPath);
    }

    const pythonProcess = spawn(pythonEnvPath, args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(`🐍 ${output.trim()}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      const error = data.toString();
      stderr += error;
      console.error(`🐍 ERROR: ${error.trim()}`);
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        console.log("✅ 기타 TAB 생성 완료");

        try {
          if (fs.existsSync(outputTabImagePath)) {
            const stats = fs.statSync(outputTabImagePath);
            resolve({
              success: true,
              tab_image_path: outputTabImagePath,
              tab_text_path: outputTabTextPath,
              file_size_kb: (stats.size / 1024).toFixed(2),
              stdout: stdout,
            });
          } else {
            resolve({
              success: false,
              error: "TAB 이미지 파일이 생성되지 않음",
              stdout: stdout,
              stderr: stderr
            });
          }
        } catch (error) {
          resolve({
            success: false,
            error: error.message,
            stdout: stdout,
            stderr: stderr
          });
        }
      } else {
        console.error(`❌ 기타 TAB 생성 실패 코드: ${code}`);
        resolve({
          success: false,
          error: `기타 TAB 생성 실패 (코드: ${code})`,
          stdout: stdout,
          stderr: stderr,
        });
      }
    });

    pythonProcess.on("error", (error) => {
      console.error(`❌ Python 프로세스 오류:`, error);
      resolve({
        success: false,
        error: error.message,
        stdout: stdout,
        stderr: stderr,
      });
    });
  });
}

// Tabify를 사용한 기타 TAB 생성 함수 (새로운 방식)
async function generateGuitarTabWithTabify(inputMidiPath, outputTabImagePath, outputTabTextPath = null, pythonEnvPath) {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, "../scripts/tabify_converter.py");

    console.log(`🎸 Tabify를 사용한 TAB 생성 실행: ${scriptPath}`);
    console.log(`📥 입력: ${inputMidiPath}`);
    console.log(`📤 출력: ${outputTabImagePath}`);

    const args = [scriptPath, inputMidiPath, outputTabImagePath];
    if (outputTabTextPath) {
      args.push(outputTabTextPath);
    }

    const pythonProcess = spawn(pythonEnvPath, args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(`🔥 ${output.trim()}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      const error = data.toString();
      stderr += error;
      console.error(`🔥 ERROR: ${error.trim()}`);
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        console.log("✅ Tabify TAB 생성 완료");

        try {
          if (fs.existsSync(outputTabImagePath)) {
            const stats = fs.statSync(outputTabImagePath);
            resolve({
              success: true,
              tab_image_path: outputTabImagePath,
              tab_text_path: outputTabTextPath,
              file_size_kb: (stats.size / 1024).toFixed(2),
              stdout: stdout,
              method: "Tabify (Professional)"
            });
          } else {
            resolve({
              success: false,
              error: "Tabify TAB 이미지 파일이 생성되지 않음",
              stdout: stdout,
              stderr: stderr
            });
          }
        } catch (error) {
          resolve({
            success: false,
            error: error.message,
            stdout: stdout,
            stderr: stderr
          });
        }
      } else {
        console.error(`❌ Tabify TAB 생성 실패 코드: ${code}`);
        resolve({
          success: false,
          error: `Tabify TAB 생성 실패 (코드: ${code})`,
          stdout: stdout,
          stderr: stderr,
        });
      }
    });

    pythonProcess.on("error", (error) => {
      console.error(`❌ Python 프로세스 오류:`, error);
      resolve({
        success: false,
        error: error.message,
        stdout: stdout,
        stderr: stderr,
      });
    });
  });
}

//ai 생성하기
exports.generateTabFromAudio = async (req, res) => {
  const { audio_url } = req.body;

  if (!audio_url) {
    return res.status(400).json({ message: "audio_url이 필요합니다." });
  }

  try {
    console.log("🎵 YouTube 링크 처리 시작:", audio_url);

    // YouTube URL 유효성 검증 (간단한 체크)
    if (!audio_url.includes("youtube.com") && !audio_url.includes("youtu.be")) {
      return res
        .status(400)
        .json({ message: "유효하지 않은 YouTube URL입니다." });
    }

    // 출력 디렉토리 생성
    const outputDir = path.join(__dirname, "../output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 오디오 파일 경로 설정
    const audioFileName = `audio_${Date.now()}.%(ext)s`;
    const audioFilePath = path.join(outputDir, audioFileName);

    console.log("📥 YouTube에서 오디오 다운로드 중...");

    // youtube-dl-exec를 사용한 오디오 다운로드
    const output = await youtubedl(audio_url, {
      extractAudio: true,
      audioFormat: "wav",
      audioQuality: 0, // best quality
      output: audioFilePath,
      verbose: true,
    });

    console.log("✅ 다운로드 완료:", output);

    // 실제 생성된 파일 찾기 (확장자가 변경될 수 있음)
    const files = fs.readdirSync(outputDir);
    const downloadedFile = files.find((file) =>
      file.startsWith(`audio_${audioFileName.split("_")[1].split(".")[0]}`)
    );

    if (!downloadedFile) {
      throw new Error("다운로드된 파일을 찾을 수 없습니다.");
    }

    const finalAudioPath = path.join(outputDir, downloadedFile);
    const fileStats = fs.statSync(finalAudioPath);
    console.log(
      `📁 다운로드된 파일: ${downloadedFile}, 크기: ${(
        fileStats.size /
        1024 /
        1024
      ).toFixed(2)} MB`
    );

    // YouTube 동영상 정보 가져오기 (metadata)
    const info = await youtubedl(audio_url, {
      dumpSingleJson: true,
      noDownload: true,
    });

    const title = info.title || "Untitled";
    const author = info.uploader || "Unknown";
    const duration = info.duration || 0;

    console.log(`🎵 영상 정보: ${title} by ${author} (${duration}초)`);

    // 🎸 2단계: 향상된 기타 음원 분리
    console.log("🎸 향상된 기타 음원 분리 시작...");
    const guitarFileName = `guitar_enhanced_${Date.now()}.wav`;
    const guitarFilePath = path.join(outputDir, guitarFileName);

    const guitarSeparationResult = await separateGuitarEnhanced(finalAudioPath, guitarFilePath);

    if (!guitarSeparationResult.success) {
      console.log("⚠️ 향상된 기타 분리 실패, 기본 방법으로 재시도...");
      const basicGuitarResult = await separateGuitar(finalAudioPath, guitarFilePath);
      if (!basicGuitarResult.success) {
        throw new Error(`기타 분리 실패: ${basicGuitarResult.error}`);
      }
      console.log("✅ 기본 기타 분리 완료!");
    } else {
      console.log("✅ 향상된 기타 분리 완료!");
    }

    // 🎼 3단계: 기타 최적화 MIDI 변환 (듣기 좋은 소리)
    console.log("🎼 기타 최적화 MIDI 변환 시작...");
    const midiFileName = `guitar_optimized_${Date.now()}.mid`;
    const midiFilePath = path.join(outputDir, midiFileName);
    
    const midiConversionResult = await convertToGuitarOptimizedMidi(guitarFilePath, midiFilePath);
    
    if (!midiConversionResult.success) {
      console.log("⚠️ 최적화 MIDI 변환 실패, 기본 모노포닉으로 재시도...");
      const basicMidiResult = await convertToMonophonicMidi(guitarFilePath, midiFilePath);
      if (!basicMidiResult.success) {
        throw new Error(`MIDI 변환 실패: ${basicMidiResult.error}`);
      }
      console.log("✅ 기본 모노포닉 MIDI 변환 완료!");
    } else {
      console.log("✅ 기타 최적화 MIDI 변환 완료!");
    }

    // 🎼 4단계: 기타 TAB 생성
    console.log("🎸 기타 TAB 악보 생성 시작...");
    const tabImageFileName = `tab_${Date.now()}.png`;
    const tabTextFileName = `tab_${Date.now()}.txt`;
    const tabImagePath = path.join(outputDir, tabImageFileName);
    const tabTextPath = path.join(outputDir, tabTextFileName);
    
    const tabGenerationResult = await generateGuitarTab(midiFilePath, tabImagePath, tabTextPath);
    
    if (!tabGenerationResult.success) {
      console.log("⚠️ TAB 생성 실패, MIDI 파일은 유지됩니다.");
    } else {
      console.log("✅ 기타 TAB 생성 완료!");
    }

    // DB에 노래 정보 저장 (DB 연결이 실패해도 계속 진행)
    let newSong = null;
    try {
      // TAB 이미지가 있으면 사용, 없으면 임시값
      const tabImageUrl = tabGenerationResult.success ? 
        `/output/${tabImageFileName}` : 
        `temp_tab_${Date.now()}.png`;
      
      newSong = await Song.create({
        title: title,
        artist: author,
        genre: "AI",
        tabImageUrl: tabImageUrl,
      });
      console.log("✅ DB에 노래 정보 저장 완료");
    } catch (dbError) {
      console.log("⚠️ DB 저장 실패, 로컬 파일만 보관:", dbError.message);
    }

    return res.status(200).json({
      success: true,
      message: "완전한 YouTube → 듣기 좋은 기타 TAB 변환 완료",
      original_audio_path: finalAudioPath,
      guitar_audio_path: guitarFilePath,
      midi_file_path: midiFilePath,
      tab_image_path: tabGenerationResult.success ? tabImagePath : null,
      tab_text_path: tabGenerationResult.success ? tabTextPath : null,
      processing_info: {
        guitar_separation: {
          enhanced: guitarSeparationResult.enhanced || false,
          method: guitarSeparationResult.enhanced ? "향상된 분리" : "기본 분리",
          ...guitarSeparationResult
        },
        midi_conversion: {
          optimized: midiConversionResult.optimized || false,
          method: midiConversionResult.optimized ? "기타 최적화 변환" : "기본 변환",
          ...midiConversionResult
        },
        tab_generation: {
          success: tabGenerationResult.success,
          method: "A4 다중 라인 TAB 생성",
          ...tabGenerationResult
        }
      },
      song_info: {
        title: title,
        artist: author,
        duration: duration,
      },
      song_id: newSong ? newSong.id : null,
      next_step: tabGenerationResult.success ? "complete" : "tab_generation_retry",
      pipeline_status: {
        "1_download": "✅ 완료",
        "2_guitar_separation": guitarSeparationResult.success ? "✅ 완료" : "⚠️ 기본으로 대체",
        "3_midi_conversion": midiConversionResult.success ? "✅ 완료" : "❌ 실패",
        "4_tab_generation": tabGenerationResult.success ? "✅ 완료" : "❌ 실패"
      },
      musical_optimizations: [
        "🎸 15프렛 연주 범위 최적화",
        "🎵 음악적 멜로디 라인 추출",
        "🎼 자연스러운 다이나믹 처리",
        "🎯 기타 스위트 스팟 활용",
        "📱 Tabify 완벽 호환성",
        "🎶 듣기 좋은 소리 보장"
      ]
    });
  } catch (error) {
    console.error("🚫 오디오 다운로드 오류:", error);
    return res.status(500).json({
      message: "오디오 다운로드 중 오류가 발생했습니다.",
      error: error.message,
    });
  }
};

//노래 띄우기
exports.getAllSongLists = async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(400).json({ message: "user_id가 필요합니다" });
  }

  try {
    // 1. ongoing: 사용자가 연습한 곡 리스트 + 진행률
    const ongoingRecords = await PracticeRecord.findAll({
      where: { userId },
      include: [{ model: Song }],
    });

    const ongoing = ongoingRecords.map((record) => ({
      song_id: record.songId,
      title: record.Song?.title || "Unknown",
      artist: record.Song?.artist || "Unknown",
      progress: Math.min(
        100,
        Math.floor(((record.totalPracticeTime || 0) / 1800) * 100)
      ), // 30분 기준
    }));

    // 2. recommend: 사용자가 연습하지 않은 곡 중 랜덤 추천
    const practicedSongIds = await PracticeRecord.findAll({
      where: { userId },
      attributes: ["songId"],
      raw: true,
    }).then((records) => records.map((r) => r.songId));

    const recommendSongs = await Song.findAll({
      where: {
        id: { [Op.notIn]: practicedSongIds },
        genre: { [Op.not]: "AI" },
      },
      order: Sequelize.literal("RAND()"), // 무작위 정렬 (MySQL용)
      limit: 3,
    });

    const recommend = recommendSongs.map((song) => ({
      song_id: song.id,
      title: song.title,
      artist: song.artist,
      genre: song.genre,
    }));

    // 3. generated: genre === 'AI'인 곡
    const generatedSongs = await Song.findAll({
      where: {
        genre: "AI",
      },
      order: [["createdAt", "DESC"]],
    });

    const generated = generatedSongs.map((song) => ({
      song_id: song.id,
      title: song.title,
      created_at: song.createdAt,
    }));

    return res.status(200).json({ ongoing, recommend, generated });
  } catch (error) {
    console.error("🎸 노래 리스트 불러오기 오류:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};

//악보 띄우기
exports.getSheetImage = async (req, res) => {
  const sheetId = req.params.id;

  if (!sheetId) {
    return res.status(400).json({ message: "악보 ID가 필요합니다." });
  }

  try {
    const song = await Song.findByPk(sheetId);

    if (!song) {
      return res.status(404).json({ message: "해당 악보를 찾을 수 없습니다." });
    }

    // 악보 이미지 URL 반환
    return res.status(200).json({
      sheet_image_url: song.tabImageUrl, // 컬럼 이름 확인 필요
    });
  } catch (error) {
    console.error("악보 조회 오류:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};

// 기타 최적화 MIDI 변환 함수 (듣기 좋은 소리)
async function convertToGuitarOptimizedMidi(inputGuitarPath, outputMidiPath) {
  return new Promise((resolve) => {
    const pythonEnvPath = path.join(__dirname, "../audio_env_39/bin/python3");
    const scriptPath = path.join(__dirname, "../scripts/midi_conversion_guitar_optimized.py");

    console.log(`🎸 기타 최적화 MIDI 변환 실행: ${scriptPath}`);
    console.log(`📥 입력: ${inputGuitarPath}`);
    console.log(`📤 출력: ${outputMidiPath}`);

    const pythonProcess = spawn(pythonEnvPath, [scriptPath, inputGuitarPath, outputMidiPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(`🐍 ${output.trim()}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      const error = data.toString();
      stderr += error;
      console.error(`🐍 ERROR: ${error.trim()}`);
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        console.log("✅ 기타 최적화 MIDI 변환 완료");

        try {
          if (fs.existsSync(outputMidiPath)) {
            const stats = fs.statSync(outputMidiPath);
            resolve({
              success: true,
              output_path: outputMidiPath,
              file_size_kb: (stats.size / 1024).toFixed(2),
              stdout: stdout,
              optimized: true,
              features: [
                "15프렛 연주 범위",
                "음악적 멜로디 추출",
                "자연스러운 다이나믹",
                "기타 스위트 스팟 최적화",
                "Tabify 완벽 호환"
              ]
            });
          } else {
            resolve({
              success: false,
              error: "기타 최적화 MIDI 파일이 생성되지 않음",
              stdout: stdout,
              stderr: stderr
            });
          }
        } catch (error) {
          resolve({
            success: false,
            error: error.message,
            stdout: stdout,
            stderr: stderr
          });
        }
      } else {
        console.error(`❌ 기타 최적화 MIDI 변환 실패 코드: ${code}`);
        resolve({
          success: false,
          error: `기타 최적화 MIDI 변환 실패 (코드: ${code})`,
          stdout: stdout,
          stderr: stderr,
        });
      }
    });

    pythonProcess.on("error", (error) => {
      console.error(`❌ Python 프로세스 오류:`, error);
      resolve({
        success: false,
        error: error.message,
        stdout: stdout,
        stderr: stderr,
      });
    });
  });
}

// YouTube-to-MIDI 변환 파이프라인
exports.convertYouTube = async (req, res) => {
  try {
    const { youtubeUrl, tabMethod = "tabify" } = req.body; // 기본값은 tabify

    if (!youtubeUrl) {
      return res.status(400).json({
        success: false,
        message: "YouTube URL이 필요합니다."
      });
    }

    console.log(`🎥 YouTube-to-MIDI 변환 시작: ${youtubeUrl}`);
    console.log(`🎸 TAB 생성 방식: ${tabMethod === "tabify" ? "Tabify (Professional)" : "Custom (기존 방식)"}`);

    const outputDir = path.join(__dirname, "../output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = Date.now();
    const outputAudioPath = path.join(outputDir, `audio_${timestamp}.wav`);
    const outputGuitarPath = path.join(outputDir, `guitar_enhanced_${timestamp}.wav`);
    const outputMidiPath = path.join(outputDir, `guitar_optimized_${timestamp}.mid`);
    const outputTabImagePath = path.join(outputDir, `tab_${timestamp}.png`);
    const outputTabTextPath = path.join(outputDir, `tab_${timestamp}.txt`);

    // 1. YouTube 오디오 다운로드
    console.log("🎵 1단계: YouTube 오디오 다운로드");
    const downloadResult = await downloadYouTubeAudio(youtubeUrl, outputAudioPath);
    if (!downloadResult.success) {
      return res.status(500).json({
        success: false,
        message: "YouTube 오디오 다운로드 실패",
        error: downloadResult.error
      });
    }

    // 2. 기타 스템 분리
    console.log("🎸 2단계: 기타 스템 분리");
    const pythonEnvPath = '/Users/choechiwon/madcamp/week2/GRIP_back/audio_env_39/bin/python';
    const separationResult = await separateGuitarStem(outputAudioPath, outputGuitarPath, pythonEnvPath);
    if (!separationResult.success) {
      return res.status(500).json({
        success: false,
        message: "기타 스템 분리 실패",
        error: separationResult.error
      });
    }

    // 3. MIDI 변환 (Tabify 호환 → 향상된 → 최적화 → 기본 순으로 시도)
    console.log("🎹 3단계: MIDI 변환");
    let midiResult = await tryTabifyCompatibleMidiConversion(outputGuitarPath, outputMidiPath, pythonEnvPath);
    
    if (!midiResult.success) {
      console.log("⚠️ Tabify 호환 MIDI 변환 실패, 향상된 버전 시도");
      midiResult = await tryEnhancedMidiConversion(outputGuitarPath, outputMidiPath, pythonEnvPath);
    }
    
    if (!midiResult.success) {
      console.log("⚠️ 향상된 MIDI 변환 실패, 최적화 버전 시도");
      midiResult = await tryOptimizedMidiConversion(outputGuitarPath, outputMidiPath, pythonEnvPath);
    }
    
    if (!midiResult.success) {
      console.log("⚠️ 최적화 MIDI 변환 실패, 기본 버전 시도");
      midiResult = await tryBasicMidiConversion(outputGuitarPath, outputMidiPath, pythonEnvPath);
    }

    if (!midiResult.success) {
      return res.status(500).json({
        success: false,
        message: "MIDI 변환 실패",
        error: midiResult.error
      });
    }

    // 4. 기타 TAB 생성 (방식 선택)
    console.log(`📄 4단계: 기타 TAB 생성 (${tabMethod === "tabify" ? "Tabify" : "Custom"})`);
    let tabResult;
    
    if (tabMethod === "tabify") {
      // Tabify 방식 우선 시도
      tabResult = await generateGuitarTabWithTabify(outputMidiPath, outputTabImagePath, outputTabTextPath, pythonEnvPath);
      
      if (!tabResult.success) {
        console.log("⚠️ Tabify 방식 실패, 기존 방식으로 대체");
        tabResult = await generateGuitarTab(outputMidiPath, outputTabImagePath, outputTabTextPath, pythonEnvPath);
        tabResult.method = "Custom (Fallback)";
      }
    } else {
      // 기존 방식 사용
      tabResult = await generateGuitarTab(outputMidiPath, outputTabImagePath, outputTabTextPath, pythonEnvPath);
      tabResult.method = "Custom (기존 방식)";
    }
    
    if (!tabResult.success) {
      return res.status(500).json({
        success: false,
        message: "기타 TAB 생성 실패",
        error: tabResult.error
      });
    }

    // 성공 응답
    const responseData = {
      audioFile: path.basename(outputAudioPath),
      guitarStemFile: path.basename(outputGuitarPath),
      midiFile: path.basename(outputMidiPath),
      tabImageFile: path.basename(outputTabImagePath),
      tabTextFile: path.basename(outputTabTextPath),
      processingTime: Date.now() - timestamp,
      tabMethod: tabResult.method || tabMethod,
      midiRange: "40-60 (E2-C4)"
    };

    console.log("✅ YouTube-to-MIDI 변환 완료:", responseData);

    res.json({
      success: true,
      message: `YouTube-to-MIDI 변환이 성공적으로 완료되었습니다. (TAB: ${tabResult.method})`,
      data: responseData
    });

  } catch (error) {
    console.error("❌ YouTube-to-MIDI 변환 오류:", error);
    res.status(500).json({
      success: false,
      message: "변환 중 오류가 발생했습니다.",
      error: error.message
    });
  }
};
