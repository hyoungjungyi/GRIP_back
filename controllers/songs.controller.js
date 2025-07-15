const { Song, PracticeRecord, SavedSong } = require("../models");
const { Op, Sequelize } = require("sequelize");
const youtubedl = require("youtube-dl-exec");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");

// Cloudinary 설정 (파일 업로드를 위해)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer 설정 (악보 업로드용)
const sheetStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../uploads/sheets");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    cb(null, `${file.fieldname}_${timestamp}${extension}`);
  },
});

const sheetUpload = multer({
  storage: sheetStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB 제한
  },
  fileFilter: function (req, file, cb) {
    // 이미지 파일만 허용 (SVG 포함)
    const allowedMimes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/svg+xml", // SVG 지원 추가
    ];

    const allowedExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
      ".gif",
      ".svg",
    ];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    console.log(`📋 악보 파일 정보:`, {
      name: file.originalname,
      mimetype: file.mimetype,
      extension: fileExtension,
    });

    const isMimeTypeAllowed = allowedMimes.includes(file.mimetype);
    const isExtensionAllowed = allowedExtensions.includes(fileExtension);

    if (isMimeTypeAllowed || isExtensionAllowed) {
      cb(null, true);
    } else {
      console.log(`❌ 지원하지 않는 파일:`, {
        mimetype: file.mimetype,
        extension: fileExtension,
      });
      cb(
        new Error(
          `지원하지 않는 파일 형식입니다. 이미지 파일만 업로드 가능합니다.`
        )
      );
    }
  },
});

// YouTube 오디오 다운로드 함수
async function downloadYouTubeAudio(youtubeUrl, outputPath) {
  return new Promise((resolve) => {
    console.log(`🎵 YouTube 오디오 다운로드 시작: ${youtubeUrl}`);
    console.log(`📁 출력 경로: ${outputPath}`);

    const options = {
      format: "bestaudio[ext=m4a]/best[ext=mp4]/best",
      extractAudio: true,
      audioFormat: "wav",
      output: outputPath,
      noPlaylist: true,
    };

    youtubedl(youtubeUrl, options)
      .then(() => {
        console.log("✅ YouTube 오디오 다운로드 완료");

        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          console.log(
            `📊 다운로드된 파일 크기: ${(stats.size / 1024 / 1024).toFixed(
              2
            )} MB`
          );

          resolve({
            success: true,
            filePath: outputPath,
            fileSize: stats.size,
          });
        } else {
          console.error("❌ 다운로드된 파일을 찾을 수 없음");
          resolve({
            success: false,
            error: "다운로드된 파일을 찾을 수 없습니다.",
          });
        }
      })
      .catch((error) => {
        console.error("❌ YouTube 다운로드 오류:", error);
        resolve({
          success: false,
          error: error.message || "YouTube 다운로드 실패",
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
    const enhancedResult = await tryEnhancedMidiConversion(
      inputGuitarPath,
      outputMidiPath,
      pythonEnvPath
    );

    if (enhancedResult.success) {
      console.log("✅ 향상된 음악적 MIDI 변환 성공!");
      resolve({
        ...enhancedResult,
        conversion_type: "enhanced_musical",
      });
      return;
    }

    console.log("🔄 향상된 변환 실패, 기타 최적화 버전으로 재시도...");
    // 2차 시도: 기타 최적화 버전
    const optimizedResult = await tryOptimizedMidiConversion(
      inputGuitarPath,
      outputMidiPath,
      pythonEnvPath
    );

    if (optimizedResult.success) {
      console.log("✅ 기타 최적화 MIDI 변환 성공!");
      resolve({
        ...optimizedResult,
        conversion_type: "guitar_optimized",
      });
      return;
    }

    console.log("🔄 최적화 변환 실패, 기본 버전으로 재시도...");
    // 3차 시도: 기본 버전
    const basicResult = await tryBasicMidiConversion(
      inputGuitarPath,
      outputMidiPath,
      pythonEnvPath
    );

    resolve({
      ...basicResult,
      conversion_type: basicResult.success ? "basic" : "failed",
    });
  });
}

// Tabify 호환 MIDI 변환 시도
async function tryTabifyCompatibleMidiConversion(
  inputGuitarPath,
  outputMidiPath,
  pythonEnvPath
) {
  return new Promise((resolve) => {
    const scriptPath = path.join(
      __dirname,
      "../scripts/midi_conversion_tabify_compatible.py"
    );

    console.log(`🎸 Tabify 호환 MIDI 변환 실행: ${scriptPath}`);

    const pythonProcess = spawn(
      pythonEnvPath,
      [scriptPath, inputGuitarPath, outputMidiPath],
      {
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    let stdout = "";
    let stderr = "";

    pythonProcess.stdout.on("data", (data) => {
      const output = data.toString();
      stdout += output;
      console.log(`🎸 ${output.trim()}`);
    });

    pythonProcess.stderr.on("data", (data) => {
      const error = data.toString();
      stderr += error;
      console.error(`🎸 ERROR: ${error.trim()}`);
    });

    pythonProcess.on("close", (code) => {
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

// 향상된 음악적 MIDI 변환 시도
async function tryEnhancedMidiConversion(
  inputGuitarPath,
  outputMidiPath,
  pythonEnvPath
) {
  return new Promise((resolve) => {
    const scriptPath = path.join(
      __dirname,
      "../scripts/midi_conversion_enhanced_musical.py"
    );

    console.log(`🎵 향상된 음악적 MIDI 변환 실행: ${scriptPath}`);
    console.log(`📥 입력: ${inputGuitarPath}`);
    console.log(`📤 출력: ${outputMidiPath}`);

    const pythonProcess = spawn(
      pythonEnvPath,
      [scriptPath, inputGuitarPath, outputMidiPath],
      {
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    let stdout = "";
    let stderr = "";

    pythonProcess.stdout.on("data", (data) => {
      const output = data.toString();
      stdout += output;
      console.log(`🎵 ${output.trim()}`);
    });

    pythonProcess.stderr.on("data", (data) => {
      const error = data.toString();
      stderr += error;
      console.error(`🎵 ERROR: ${error.trim()}`);
    });

    pythonProcess.on("close", (code) => {
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
              quality: "enhanced_musical",
            });
          } else {
            resolve({
              success: false,
              error: "향상된 MIDI 파일이 생성되지 않음",
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
        console.error(`❌ 향상된 MIDI 변환 실패 코드: ${code}`);
        resolve({
          success: false,
          error: `향상된 MIDI 변환 실패 (코드: ${code})`,
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

// 기타 최적화 MIDI 변환 시도
async function tryOptimizedMidiConversion(
  inputGuitarPath,
  outputMidiPath,
  pythonEnvPath
) {
  return new Promise((resolve) => {
    const scriptPath = path.join(
      __dirname,
      "../scripts/midi_conversion_guitar_optimized.py"
    );

    console.log(`🎸 기타 최적화 MIDI 변환 실행: ${scriptPath}`);

    const pythonProcess = spawn(
      pythonEnvPath,
      [scriptPath, inputGuitarPath, outputMidiPath],
      {
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    let stdout = "";
    let stderr = "";

    pythonProcess.stdout.on("data", (data) => {
      const output = data.toString();
      stdout += output;
      console.log(`🎸 ${output.trim()}`);
    });

    pythonProcess.stderr.on("data", (data) => {
      const error = data.toString();
      stderr += error;
      console.error(`🎸 ERROR: ${error.trim()}`);
    });

    pythonProcess.on("close", (code) => {
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
              quality: "guitar_optimized",
            });
          } else {
            resolve({
              success: false,
              error: "최적화 MIDI 파일이 생성되지 않음",
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
        console.error(`❌ 최적화 MIDI 변환 실패 코드: ${code}`);
        resolve({
          success: false,
          error: `최적화 MIDI 변환 실패 (코드: ${code})`,
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

// 기본 MIDI 변환 시도
async function tryBasicMidiConversion(
  inputGuitarPath,
  outputMidiPath,
  pythonEnvPath
) {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, "../scripts/midi_conversion.py");

    console.log(`🐍 기본 MIDI 변환 실행: ${scriptPath}`);

    const pythonProcess = spawn(
      pythonEnvPath,
      [scriptPath, inputGuitarPath, outputMidiPath],
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
        console.log("✅ 기본 MIDI 변환 완료");

        try {
          if (fs.existsSync(outputMidiPath)) {
            const stats = fs.statSync(outputMidiPath);
            resolve({
              success: true,
              output_path: outputMidiPath,
              file_size_kb: (stats.size / 1024).toFixed(2),
              stdout: stdout,
              quality: "basic",
            });
          } else {
            resolve({
              success: false,
              error: "기본 MIDI 파일이 생성되지 않음",
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
        console.error(`❌ 기본 MIDI 변환 실패 코드: ${code}`);
        resolve({
          success: false,
          error: `기본 MIDI 변환 실패 (코드: ${code})`,
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

// 기타 스템 분리 함수 (향상된 버전 사용)
async function separateGuitarStem(
  inputAudioPath,
  outputGuitarPath,
  pythonEnvPath
) {
  return new Promise((resolve) => {
    const scriptPath = path.join(
      __dirname,
      "../scripts/guitar_separation_improved.py"
    );

    console.log(`🎸 기타 스템 분리 실행: ${scriptPath}`);
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
        console.log("✅ 기타 스템 분리 완료");

        try {
          if (fs.existsSync(outputGuitarPath)) {
            const stats = fs.statSync(outputGuitarPath);
            resolve({
              success: true,
              output_path: outputGuitarPath,
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
        console.error(`❌ 기타 스템 분리 실패 (종료 코드: ${code})`);
        resolve({
          success: false,
          error: `프로세스가 코드 ${code}로 종료되었습니다.`,
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

async function separateGuitarEnhanced(inputAudioPath, outputGuitarPath) {
  return new Promise((resolve) => {
    const pythonEnvPath = path.join(__dirname, "../audio_env_39/bin/python3");
    const scriptPath = path.join(
      __dirname,
      "../scripts/guitar_separation_improved.py"
    );

    console.log(`🎸 향상된 기타 분리 실행: ${scriptPath}`);
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
        console.log("✅ 향상된 기타 분리 완료");

        try {
          if (fs.existsSync(outputGuitarPath)) {
            const stats = fs.statSync(outputGuitarPath);
            resolve({
              success: true,
              output_path: outputGuitarPath,
              file_size_mb: (stats.size / (1024 * 1024)).toFixed(2),
              stdout: stdout,
              enhanced: true,
            });
          } else {
            resolve({
              success: false,
              error: "향상된 기타 파일이 생성되지 않음",
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
    const scriptPath = path.join(
      __dirname,
      "../scripts/midi_conversion_monophonic.py"
    );

    console.log(`🎵 모노포닉 MIDI 변환 실행: ${scriptPath}`);
    console.log(`📥 입력: ${inputGuitarPath}`);
    console.log(`📤 출력: ${outputMidiPath}`);

    const pythonProcess = spawn(
      pythonEnvPath,
      [scriptPath, inputGuitarPath, outputMidiPath],
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
        console.log("✅ 모노포닉 MIDI 변환 완료");

        try {
          if (fs.existsSync(outputMidiPath)) {
            const stats = fs.statSync(outputMidiPath);
            resolve({
              success: true,
              output_path: outputMidiPath,
              file_size_kb: (stats.size / 1024).toFixed(2),
              stdout: stdout,
              monophonic: true,
            });
          } else {
            resolve({
              success: false,
              error: "모노포닉 MIDI 파일이 생성되지 않음",
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
async function generateGuitarTab(
  inputMidiPath,
  outputTabImagePath,
  outputTabTextPath = null
) {
  return new Promise((resolve) => {
    const pythonEnvPath = path.join(__dirname, "../audio_env_39/bin/python3");
    const scriptPath = path.join(
      __dirname,
      "../scripts/guitar_tab_generator.py"
    );

    console.log(`🎸 기타 TAB 생성 실행: ${scriptPath}`);
    console.log(`📥 입력: ${inputMidiPath}`);
    console.log(`📤 출력: ${outputTabImagePath}`);

    const args = [scriptPath, inputMidiPath, outputTabImagePath];
    if (outputTabTextPath) {
      args.push(outputTabTextPath);
    }

    const pythonProcess = spawn(pythonEnvPath, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

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
async function generateGuitarTabWithTabify(
  inputMidiPath,
  outputTabImagePath,
  outputTabTextPath = null,
  pythonEnvPath
) {
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
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    pythonProcess.stdout.on("data", (data) => {
      const output = data.toString();
      stdout += output;
      console.log(`🔥 ${output.trim()}`);
    });

    pythonProcess.stderr.on("data", (data) => {
      const error = data.toString();
      stderr += error;
      console.error(`🔥 ERROR: ${error.trim()}`);
    });

    pythonProcess.on("close", (code) => {
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
              method: "Tabify (Professional)",
            });
          } else {
            resolve({
              success: false,
              error: "Tabify TAB 이미지 파일이 생성되지 않음",
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

    const guitarSeparationResult = await separateGuitarEnhanced(
      finalAudioPath,
      guitarFilePath
    );

    if (!guitarSeparationResult.success) {
      console.log("⚠️ 향상된 기타 분리 실패, 기본 방법으로 재시도...");
      const basicGuitarResult = await separateGuitar(
        finalAudioPath,
        guitarFilePath
      );
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

    const midiConversionResult = await convertToGuitarOptimizedMidi(
      guitarFilePath,
      midiFilePath
    );

    if (!midiConversionResult.success) {
      console.log("⚠️ 최적화 MIDI 변환 실패, 기본 모노포닉으로 재시도...");
      const basicMidiResult = await convertToMonophonicMidi(
        guitarFilePath,
        midiFilePath
      );
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

    const tabGenerationResult = await generateGuitarTab(
      midiFilePath,
      tabImagePath,
      tabTextPath
    );

    if (!tabGenerationResult.success) {
      console.log("⚠️ TAB 생성 실패, MIDI 파일은 유지됩니다.");
    } else {
      console.log("✅ 기타 TAB 생성 완료!");
    }

    // 5단계: Cloudinary에 파일 업로드 및 DB 저장
    console.log("☁️ Cloudinary에 파일 업로드 시작...");
    let newSong = null;
    try {
      let coverUrl = null;
      let tabSheetUrl = null;

      // 커버 이미지는 null로 설정 (프론트엔드에서 기본 이미지 처리)
      const defaultCoverUrl = null;

      // TAB 이미지가 성공적으로 생성된 경우 Cloudinary에 업로드
      if (tabGenerationResult.success && fs.existsSync(tabImagePath)) {
        console.log("📤 TAB 이미지 Cloudinary 업로드 중...");
        const tabUploadResult = await cloudinary.uploader.upload(tabImagePath, {
          folder: "grip/ai-generated-tabs",
          public_id: `ai_tab_${Date.now()}`,
          resource_type: "image",
        });
        tabSheetUrl = tabUploadResult.secure_url;
        console.log("✅ TAB 이미지 Cloudinary 업로드 완료");

        // 로컬 파일 삭제
        fs.unlinkSync(tabImagePath);
        if (fs.existsSync(tabTextPath)) {
          fs.unlinkSync(tabTextPath);
        }
      }

      // DB에 노래 정보 저장
      newSong = await Song.create({
        title: title,
        artist: author,
        genre: "AI",
        coverUrl: defaultCoverUrl, // 기본 커버 이미지
        tabSheetUrl: tabSheetUrl, // Cloudinary URL
        sheetUrl: tabSheetUrl, // 기존 호환성 유지
      });

      console.log(`✅ DB에 노래 정보 저장 완료 - ID: ${newSong.id}`);

      // 임시 로컬 파일들 정리
      try {
        if (fs.existsSync(finalAudioPath)) fs.unlinkSync(finalAudioPath);
        if (fs.existsSync(guitarFilePath)) fs.unlinkSync(guitarFilePath);
        if (fs.existsSync(midiFilePath)) fs.unlinkSync(midiFilePath);
        console.log("🧹 임시 파일들 정리 완료");
      } catch (cleanupError) {
        console.log("⚠️ 임시 파일 정리 중 오류:", cleanupError.message);
      }
    } catch (uploadError) {
      console.error("❌ Cloudinary 업로드 또는 DB 저장 실패:", uploadError);

      // 업로드 실패시에도 로컬 파일은 유지하고 DB에는 로컬 경로로 저장
      try {
        const localTabUrl = tabGenerationResult.success
          ? `/output/${tabImageFileName}`
          : null;
        newSong = await Song.create({
          title: title,
          artist: author,
          genre: "AI",
          coverUrl: null, // 프론트엔드에서 기본 이미지 처리
          tabSheetUrl: localTabUrl,
          sheetUrl: localTabUrl,
        });
        console.log("⚠️ Cloudinary 실패, 로컬 경로로 DB 저장 완료");
      } catch (dbError) {
        console.error("❌ DB 저장도 실패:", dbError.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: "AI 기타 TAB 생성 및 클라우드 저장 완료",
      data: {
        songId: newSong ? newSong.id : null,
        title: title,
        artist: author,
        genre: "AI",
        coverUrl: newSong ? newSong.coverUrl : null,
        tabSheetUrl: newSong ? newSong.tabSheetUrl : null,
        uploadedAt: newSong ? newSong.createdAt : new Date().toISOString(),
      },
      processing_info: {
        guitar_separation: {
          enhanced: guitarSeparationResult.enhanced || false,
          method: guitarSeparationResult.enhanced ? "향상된 분리" : "기본 분리",
          file_size_mb: guitarSeparationResult.file_size_mb,
        },
        midi_conversion: {
          optimized: midiConversionResult.optimized || false,
          method: midiConversionResult.optimized
            ? "기타 최적화 변환"
            : "기본 변환",
          file_size_kb: midiConversionResult.file_size_kb,
        },
        tab_generation: {
          success: tabGenerationResult.success,
          method: "A4 다중 라인 TAB 생성",
          file_size_kb: tabGenerationResult.file_size_kb,
          cloudinary_uploaded:
            newSong &&
            newSong.tabSheetUrl &&
            newSong.tabSheetUrl.includes("cloudinary"),
        },
        storage: {
          type:
            newSong &&
            newSong.tabSheetUrl &&
            newSong.tabSheetUrl.includes("cloudinary")
              ? "Cloudinary"
              : "Local",
          cleanup_completed: true,
        },
      },
      song_info: {
        title: title,
        artist: author,
        duration: duration,
        source: "YouTube",
      },
      pipeline_status: {
        "1_download": "✅ 완료",
        "2_guitar_separation": guitarSeparationResult.success
          ? "✅ 완료"
          : "⚠️ 기본으로 대체",
        "3_midi_conversion": midiConversionResult.success
          ? "✅ 완료"
          : "❌ 실패",
        "4_tab_generation": tabGenerationResult.success ? "✅ 완료" : "❌ 실패",
        "5_cloud_upload":
          newSong &&
          newSong.tabSheetUrl &&
          newSong.tabSheetUrl.includes("cloudinary")
            ? "✅ 완료"
            : "⚠️ 로컬 저장",
        "6_db_save": newSong ? "✅ 완료" : "❌ 실패",
      },
      musical_optimizations: [
        "🎸 15프렛 연주 범위 최적화",
        "🎵 음악적 멜로디 라인 추출",
        "🎼 자연스러운 다이나믹 처리",
        "🎯 기타 스위트 스팟 활용",
        "📱 Tabify 완벽 호환성",
        "🎶 듣기 좋은 소리 보장",
        "☁️ 클라우드 저장 및 관리",
      ],
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
    // 1. ongoing: 사용자가 즐겨찾기 추가한 곡 리스트
    const savedSongs = await SavedSong.findAll({
      where: { userId },
      include: [
        {
          model: Song,
          attributes: [
            "id",
            "title",
            "artist",
            "genre",
            "coverUrl",
            "noteSheetUrl",
            "tabSheetUrl",
            "sheetUrl",
          ],
        },
      ],
      order: [["savedAt", "DESC"]],
    });

    const ongoing = savedSongs.map((entry) => ({
      song_id: entry.Song.id,
      title: entry.Song.title,
      artist: entry.Song.artist,
      savedAt: entry.savedAt,
      coverUrl: entry.Song.coverUrl || null,
      noteSheetUrl: entry.Song.noteSheetUrl || null,
      tabSheetUrl: entry.Song.tabSheetUrl || null,
      sheetUrl: entry.Song.sheetUrl || null, // 기존 호환성
    }));

    // 2. recommend: 사용자가 즐겨찾기 추가하지 않은 곡 중 랜덤 추천
    const savedSongIds = await SavedSong.findAll({
      where: { userId },
      attributes: ["songId"],
      raw: true,
    }).then((records) => records.map((r) => r.songId));

    const recommendSongs = await Song.findAll({
      where: {
        id: { [Op.notIn]: savedSongIds },
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
      coverUrl: song.coverUrl || null,
      noteSheetUrl: song.noteSheetUrl || null,
      tabSheetUrl: song.tabSheetUrl || null,
      sheetUrl: song.sheetUrl || null, // 기존 호환성
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
      artist: song.artist,
      created_at: song.createdAt,
      coverUrl: song.coverUrl || null,
      noteSheetUrl: song.noteSheetUrl || null,
      tabSheetUrl: song.tabSheetUrl || null,
      sheetUrl: song.sheetUrl || null, // 기존 호환성
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

    // 악보 이미지 URL들 반환
    return res.status(200).json({
      song_id: song.id,
      title: song.title,
      artist: song.artist,
      genre: song.genre,
      coverUrl: song.coverUrl || null,
      noteSheetUrl: song.noteSheetUrl || null,
      tabSheetUrl: song.tabSheetUrl || null,
      sheetUrl: song.sheetUrl || null, // 기존 호환성
      // 기존 필드명도 유지 (하위 호환성)
      sheet_image_url: song.tabSheetUrl || song.sheetUrl || null,
    });
  } catch (error) {
    console.error("악보 조회 오류:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};

// 악보 업로드 함수
exports.uploadSheet = async (req, res) => {
  try {
    const { title, artist } = req.body;

    if (!title || !artist) {
      return res.status(400).json({
        success: false,
        message: "제목과 아티스트 정보가 필요합니다.",
      });
    }

    if (
      !req.files ||
      !req.files.cover ||
      !req.files.noteSheet ||
      !req.files.tabSheet
    ) {
      return res.status(400).json({
        success: false,
        message: "cover, noteSheet, tabSheet 파일이 모두 필요합니다.",
      });
    }

    console.log(`🎵 악보 업로드 시작: ${title} by ${artist}`);

    // 파일들 확인
    const coverFile = req.files.cover[0];
    const noteSheetFile = req.files.noteSheet[0];
    const tabSheetFile = req.files.tabSheet[0];

    console.log("📁 업로드된 파일들:", {
      cover: coverFile.originalname,
      noteSheet: noteSheetFile.originalname,
      tabSheet: tabSheetFile.originalname,
    });

    // Cloudinary에 파일들 업로드
    console.log("☁️ Cloudinary 업로드 시작...");

    const [coverResult, noteSheetResult, tabSheetResult] = await Promise.all([
      cloudinary.uploader.upload(coverFile.path, {
        folder: "grip/covers",
        public_id: `cover_${Date.now()}`,
        resource_type: "image",
      }),
      cloudinary.uploader.upload(noteSheetFile.path, {
        folder: "grip/note-sheets",
        public_id: `note_sheet_${Date.now()}`,
        resource_type: "image",
      }),
      cloudinary.uploader.upload(tabSheetFile.path, {
        folder: "grip/tab-sheets",
        public_id: `tab_sheet_${Date.now()}`,
        resource_type: "image",
      }),
    ]);

    // 임시 파일들 삭제
    [coverFile, noteSheetFile, tabSheetFile].forEach((file) => {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    });

    console.log("✅ Cloudinary 업로드 완료");

    // DB에 저장
    const newSong = await Song.create({
      title: title,
      artist: artist,
      genre: "Sheet", // 업로드된 악보로 구분
      coverUrl: coverResult.secure_url,
      noteSheetUrl: noteSheetResult.secure_url,
      tabSheetUrl: tabSheetResult.secure_url,
      sheetUrl: tabSheetResult.secure_url, // 기존 호환성을 위해 TAB을 기본으로
    });

    console.log(`✅ 악보 DB 저장 완료: ID ${newSong.id}`);

    res.status(200).json({
      success: true,
      message: "악보가 성공적으로 업로드되었습니다.",
      data: {
        songId: newSong.id,
        title: newSong.title,
        artist: newSong.artist,
        coverUrl: newSong.coverUrl,
        noteSheetUrl: newSong.noteSheetUrl,
        tabSheetUrl: newSong.tabSheetUrl,
        uploadedAt: newSong.createdAt,
      },
    });
  } catch (error) {
    // 오류 발생시 임시 파일들 정리
    if (req.files) {
      Object.values(req.files)
        .flat()
        .forEach((file) => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
    }

    console.error("악보 업로드 오류:", error);

    let errorMessage = "악보 업로드 중 오류가 발생했습니다.";

    if (error.message && error.message.includes("File size too large")) {
      errorMessage =
        "파일 크기가 너무 큽니다. 10MB 이하의 이미지를 업로드해주세요.";
    } else if (error.message && error.message.includes("Invalid")) {
      errorMessage = "유효하지 않은 이미지 파일입니다.";
    }

    res.status(500).json({
      success: false,
      message: errorMessage,
      error: error.message,
    });
  }
};

// Multer 미들웨어 export
exports.sheetUploadMiddleware = sheetUpload.fields([
  { name: "cover", maxCount: 1 },
  { name: "noteSheet", maxCount: 1 },
  { name: "tabSheet", maxCount: 1 },
]);

// 기타 최적화 MIDI 변환 함수 (듣기 좋은 소리)
async function convertToGuitarOptimizedMidi(inputGuitarPath, outputMidiPath) {
  return new Promise((resolve) => {
    const pythonEnvPath = path.join(__dirname, "../audio_env_39/bin/python3");
    const scriptPath = path.join(
      __dirname,
      "../scripts/midi_conversion_guitar_optimized.py"
    );

    console.log(`🎸 기타 최적화 MIDI 변환 실행: ${scriptPath}`);
    console.log(`📥 입력: ${inputGuitarPath}`);
    console.log(`📤 출력: ${outputMidiPath}`);

    const pythonProcess = spawn(
      pythonEnvPath,
      [scriptPath, inputGuitarPath, outputMidiPath],
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
                "Tabify 완벽 호환",
              ],
            });
          } else {
            resolve({
              success: false,
              error: "기타 최적화 MIDI 파일이 생성되지 않음",
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
        message: "YouTube URL이 필요합니다.",
      });
    }

    console.log(`🎥 YouTube-to-MIDI 변환 시작: ${youtubeUrl}`);
    console.log(
      `🎸 TAB 생성 방식: ${
        tabMethod === "tabify" ? "Tabify (Professional)" : "Custom (기존 방식)"
      }`
    );

    const outputDir = path.join(__dirname, "../output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = Date.now();
    const outputAudioPath = path.join(outputDir, `audio_${timestamp}.wav`);
    const outputGuitarPath = path.join(
      outputDir,
      `guitar_enhanced_${timestamp}.wav`
    );
    const outputMidiPath = path.join(
      outputDir,
      `guitar_optimized_${timestamp}.mid`
    );
    const outputTabImagePath = path.join(outputDir, `tab_${timestamp}.png`);
    const outputTabTextPath = path.join(outputDir, `tab_${timestamp}.txt`);

    // 1. YouTube 오디오 다운로드
    console.log("🎵 1단계: YouTube 오디오 다운로드");
    const downloadResult = await downloadYouTubeAudio(
      youtubeUrl,
      outputAudioPath
    );
    if (!downloadResult.success) {
      return res.status(500).json({
        success: false,
        message: "YouTube 오디오 다운로드 실패",
        error: downloadResult.error,
      });
    }

    // 2. 기타 스템 분리
    console.log("🎸 2단계: 기타 스템 분리");
    const pythonEnvPath =
      "/Users/choechiwon/madcamp/week2/GRIP_back/audio_env_39/bin/python";
    const separationResult = await separateGuitarStem(
      outputAudioPath,
      outputGuitarPath,
      pythonEnvPath
    );
    if (!separationResult.success) {
      return res.status(500).json({
        success: false,
        message: "기타 스템 분리 실패",
        error: separationResult.error,
      });
    }

    // 3. MIDI 변환 (Tabify 호환 → 향상된 → 최적화 → 기본 순으로 시도)
    console.log("🎹 3단계: MIDI 변환");
    let midiResult = await tryTabifyCompatibleMidiConversion(
      outputGuitarPath,
      outputMidiPath,
      pythonEnvPath
    );

    if (!midiResult.success) {
      console.log("⚠️ Tabify 호환 MIDI 변환 실패, 향상된 버전 시도");
      midiResult = await tryEnhancedMidiConversion(
        outputGuitarPath,
        outputMidiPath,
        pythonEnvPath
      );
    }

    if (!midiResult.success) {
      console.log("⚠️ 향상된 MIDI 변환 실패, 최적화 버전 시도");
      midiResult = await tryOptimizedMidiConversion(
        outputGuitarPath,
        outputMidiPath,
        pythonEnvPath
      );
    }

    if (!midiResult.success) {
      console.log("⚠️ 최적화 MIDI 변환 실패, 기본 버전 시도");
      midiResult = await tryBasicMidiConversion(
        outputGuitarPath,
        outputMidiPath,
        pythonEnvPath
      );
    }

    if (!midiResult.success) {
      return res.status(500).json({
        success: false,
        message: "MIDI 변환 실패",
        error: midiResult.error,
      });
    }

    // 4. 기타 TAB 생성 (방식 선택)
    console.log(
      `📄 4단계: 기타 TAB 생성 (${
        tabMethod === "tabify" ? "Tabify" : "Custom"
      })`
    );
    let tabResult;

    if (tabMethod === "tabify") {
      // Tabify 방식 우선 시도
      tabResult = await generateGuitarTabWithTabify(
        outputMidiPath,
        outputTabImagePath,
        outputTabTextPath,
        pythonEnvPath
      );

      if (!tabResult.success) {
        console.log("⚠️ Tabify 방식 실패, 기존 방식으로 대체");
        tabResult = await generateGuitarTab(
          outputMidiPath,
          outputTabImagePath,
          outputTabTextPath,
          pythonEnvPath
        );
        tabResult.method = "Custom (Fallback)";
      }
    } else {
      // 기존 방식 사용
      tabResult = await generateGuitarTab(
        outputMidiPath,
        outputTabImagePath,
        outputTabTextPath,
        pythonEnvPath
      );
      tabResult.method = "Custom (기존 방식)";
    }

    if (!tabResult.success) {
      return res.status(500).json({
        success: false,
        message: "기타 TAB 생성 실패",
        error: tabResult.error,
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
      midiRange: "40-60 (E2-C4)",
    };

    console.log("✅ YouTube-to-MIDI 변환 완료:", responseData);

    res.json({
      success: true,
      message: `YouTube-to-MIDI 변환이 성공적으로 완료되었습니다. (TAB: ${tabResult.method})`,
      data: responseData,
    });
  } catch (error) {
    console.error("❌ YouTube-to-MIDI 변환 오류:", error);
    res.status(500).json({
      success: false,
      message: "변환 중 오류가 발생했습니다.",
      error: error.message,
    });
  }
};

// 즐겨찾기 추가
exports.addToSavedSongs = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { songId } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "인증이 필요합니다." });
    }

    if (!songId) {
      return res.status(400).json({ message: "songId가 필요합니다." });
    }

    // 곡이 존재하는지 확인
    const song = await Song.findByPk(songId);
    if (!song) {
      return res.status(404).json({ message: "해당 곡을 찾을 수 없습니다." });
    }

    // 이미 즐겨찾기에 있는지 확인
    const existingSavedSong = await SavedSong.findOne({
      where: { userId, songId },
    });

    if (existingSavedSong) {
      return res
        .status(409)
        .json({ message: "이미 즐겨찾기에 추가된 곡입니다." });
    }

    // 즐겨찾기에 추가
    const savedSong = await SavedSong.create({ userId, songId });

    console.log(`✅ 즐겨찾기 추가: 사용자 ${userId}, 곡 ${songId}`);

    res.status(201).json({
      success: true,
      message: "즐겨찾기에 추가되었습니다.",
      data: {
        savedId: savedSong.id,
        songId: song.id,
        title: song.title,
        artist: song.artist,
        savedAt: savedSong.createdAt,
      },
    });
  } catch (error) {
    console.error("즐겨찾기 추가 오류:", error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
};

// 즐겨찾기 제거
exports.removeFromSavedSongs = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { songId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "인증이 필요합니다." });
    }

    if (!songId) {
      return res.status(400).json({ message: "songId가 필요합니다." });
    }

    // 즐겨찾기에서 제거
    const deletedCount = await SavedSong.destroy({
      where: { userId, songId: parseInt(songId) },
    });

    if (deletedCount === 0) {
      return res
        .status(404)
        .json({ message: "즐겨찾기에서 해당 곡을 찾을 수 없습니다." });
    }

    console.log(`✅ 즐겨찾기 제거: 사용자 ${userId}, 곡 ${songId}`);

    res.status(200).json({
      success: true,
      message: "즐겨찾기에서 제거되었습니다.",
    });
  } catch (error) {
    console.error("즐겨찾기 제거 오류:", error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
};

// 즐겨찾기 목록 조회
exports.getSavedSongs = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "인증이 필요합니다." });
    }

    const savedSongs = await SavedSong.findAll({
      where: { userId },
      include: [
        {
          model: Song,
          attributes: [
            "id",
            "title",
            "artist",
            "genre",
            "coverUrl",
            "noteSheetUrl",
            "tabSheetUrl",
            "sheetUrl",
          ],
        },
      ],
      order: [["savedAt", "DESC"]],
    });

    const songList = savedSongs.map((entry) => ({
      savedId: entry.id,
      savedAt: entry.savedAt,
      song_id: entry.Song.id,
      title: entry.Song.title,
      artist: entry.Song.artist,
      genre: entry.Song.genre,
      coverUrl: entry.Song.coverUrl || null,
      noteSheetUrl: entry.Song.noteSheetUrl || null,
      tabSheetUrl: entry.Song.tabSheetUrl || null,
      sheetUrl: entry.Song.sheetUrl || null,
    }));

    console.log(`✅ 즐겨찾기 조회: 사용자 ${userId}, ${songList.length}개 곡`);

    res.status(200).json({
      success: true,
      data: songList,
      count: songList.length,
    });
  } catch (error) {
    console.error("즐겨찾기 조회 오류:", error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
};

// 즐겨찾기 상태 확인
exports.checkSavedSongStatus = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { songId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "인증이 필요합니다." });
    }

    if (!songId) {
      return res.status(400).json({ message: "songId가 필요합니다." });
    }

    const savedSong = await SavedSong.findOne({
      where: { userId, songId: parseInt(songId) },
    });

    res.status(200).json({
      success: true,
      isSaved: !!savedSong,
      savedId: savedSong ? savedSong.id : null,
      savedAt: savedSong ? savedSong.createdAt : null,
    });
  } catch (error) {
    console.error("즐겨찾기 상태 확인 오류:", error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
};

// 노래 삭제 (Songs 및 SavedSongs에서 모두 삭제)
exports.deleteSong = async (req, res) => {
  try {
    const { songId } = req.params;

    if (!songId) {
      return res.status(400).json({ message: "songId가 필요합니다." });
    }

    // 곡이 존재하는지 확인
    const song = await Song.findByPk(songId);
    if (!song) {
      return res.status(404).json({ message: "해당 곡을 찾을 수 없습니다." });
    }

    console.log(`🗑️ 곡 삭제 시작: ID ${songId}, 제목: ${song.title}`);

    // SavedSongs에서 관련 레코드 먼저 삭제
    const deletedSavedCount = await SavedSong.destroy({
      where: { songId: parseInt(songId) },
    });

    console.log(`✅ SavedSongs에서 ${deletedSavedCount}개 레코드 삭제`);

    // Songs 테이블에서 곡 삭제
    await Song.destroy({
      where: { id: parseInt(songId) },
    });

    console.log(`✅ Songs에서 곡 삭제 완료: ID ${songId}`);

    res.status(200).json({
      success: true,
      message: "곡이 성공적으로 삭제되었습니다.",
      data: {
        deletedSongId: parseInt(songId),
        deletedSavedCount: deletedSavedCount,
        deletedSong: {
          id: song.id,
          title: song.title,
          artist: song.artist,
        },
      },
    });
  } catch (error) {
    console.error("곡 삭제 오류:", error);
    res.status(500).json({
      success: false,
      message: "곡 삭제 중 오류가 발생했습니다.",
      error: error.message,
    });
  }
};
