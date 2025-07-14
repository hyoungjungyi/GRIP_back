const { Song, PracticeRecord, SavedSong } = require("../models");
const { Op, Sequelize } = require("sequelize");
const youtubedl = require("youtube-dl-exec");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

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

// MIDI 변환 함수
async function convertToMidi(inputGuitarPath, outputMidiPath) {
  return new Promise((resolve) => {
    const pythonEnvPath = path.join(__dirname, "../audio_env_39/bin/python3");
    const scriptPath = path.join(__dirname, "../scripts/midi_conversion.py");

    console.log(`🐍 MIDI 변환 Python 스크립트 실행: ${scriptPath}`);
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
        console.log("✅ MIDI 변환 Python 스크립트 완료");

        try {
          // 출력 파일 확인
          if (fs.existsSync(outputMidiPath)) {
            const stats = fs.statSync(outputMidiPath);
            resolve({
              success: true,
              output_path: outputMidiPath,
              file_size_kb: (stats.size / 1024).toFixed(2),
              stdout: stdout,
            });
          } else {
            resolve({
              success: false,
              error: "MIDI 파일이 생성되지 않음",
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
        console.error(`❌ Python 스크립트 종료 코드: ${code}`);
        resolve({
          success: false,
          error: `Python 스크립트 실행 실패 (코드: ${code})`,
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

// 향상된 기타 음원 분리 함수
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

    // 🎼 3단계: 모노포닉 MIDI 변환
    console.log("🎼 모노포닉 기타 MIDI 변환 시작...");
    const midiFileName = `guitar_mono_${Date.now()}.mid`;
    const midiFilePath = path.join(outputDir, midiFileName);
    
    const midiConversionResult = await convertToMonophonicMidi(guitarFilePath, midiFilePath);
    
    if (!midiConversionResult.success) {
      console.log("⚠️ 모노포닉 MIDI 변환 실패, 기본 방법으로 재시도...");
      const basicMidiResult = await convertToMidi(guitarFilePath, midiFilePath);
      if (!basicMidiResult.success) {
        throw new Error(`MIDI 변환 실패: ${basicMidiResult.error}`);
      }
      console.log("✅ 기본 MIDI 변환 완료!");
    } else {
      console.log("✅ 모노포닉 MIDI 변환 완료!");
    }

    // DB에 노래 정보 저장 (DB 연결이 실패해도 계속 진행)
    let newSong = null;
    try {
      newSong = await Song.create({
        title: title,
        artist: author,
        genre: "AI",
        tabImageUrl: `temp_tab_${Date.now()}.png`, // 아직 악보 생성 전이므로 임시값
      });
      console.log("✅ DB에 노래 정보 저장 완료");
    } catch (dbError) {
      console.log("⚠️ DB 저장 실패, 로컬 파일만 보관:", dbError.message);
    }

    return res.status(200).json({
      success: true,
      message: "향상된 오디오 다운로드, 기타 분리 및 모노포닉 MIDI 변환 완료",
      original_audio_path: finalAudioPath,
      guitar_audio_path: guitarFilePath,
      midi_file_path: midiFilePath,
      processing_info: {
        guitar_separation: {
          enhanced: guitarSeparationResult.enhanced || false,
          method: guitarSeparationResult.enhanced ? "향상된 분리" : "기본 분리",
          ...guitarSeparationResult
        },
        midi_conversion: {
          monophonic: midiConversionResult.monophonic || false,
          method: midiConversionResult.monophonic ? "모노포닉 변환" : "기본 변환",
          ...midiConversionResult
        }
      },
      song_info: {
        title: title,
        artist: author,
        duration: duration,
      },
      song_id: newSong ? newSong.id : null,
      next_step: "tab_generation",
      improvements: [
        "향상된 기타 주파수 필터링",
        "드럼/베이스 성분 제거",
        "모노포닉 멜로디 추출",
        "기타 튜닝 최적화"
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
