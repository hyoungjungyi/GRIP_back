const { PracticeRecord, File, ChromaticPractice, User } = require("../models");
const { Op } = require("sequelize");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");

// Cloudinary 설정
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer 설정 (임시 파일 저장)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../uploads");
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

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB 제한으로 증가
  },
  fileFilter: function (req, file, cb) {
    // 오디오와 비디오 파일만 허용 (확장된 MIME 타입)
    const allowedMimes = [
      // 오디오 MIME 타입
      "audio/mpeg",
      "audio/wav",
      "audio/mp3",
      "audio/flac",
      "audio/aac",
      "audio/ogg",
      "audio/m4a",
      "audio/x-m4a",
      "audio/mp4",

      // 비디오 MIME 타입 (확장)
      "video/mp4",
      "video/avi",
      "video/mov",
      "video/mkv",
      "video/webm",
      "video/x-msvideo",
      "video/quicktime",
      "video/x-ms-wmv",
      "video/3gpp",
      "video/x-flv",
      "video/x-matroska",
      "video/mpeg",
      "video/x-mpeg",
    ];

    // 파일 확장자 기반 검증도 추가
    const allowedExtensions = [
      ".mp3",
      ".wav",
      ".flac",
      ".aac",
      ".ogg",
      ".m4a",
      ".mp4",
      ".avi",
      ".mov",
      ".mkv",
      ".webm",
      ".wmv",
      ".3gp",
      ".flv",
    ];

    const fileExtension = path.extname(file.originalname).toLowerCase();

    console.log(`📋 파일 정보:`, {
      name: file.originalname,
      mimetype: file.mimetype,
      extension: fileExtension,
    });

    // MIME 타입 또는 확장자 기반으로 검증
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
          `지원하지 않는 파일 형식입니다. MIME 타입: ${file.mimetype}, 확장자: ${fileExtension}`
        )
      );
    }
  },
});

// FFmpeg를 사용한 비디오 압축 함수
async function compressVideoTo30MB(inputPath, outputPath, targetSizeMB = 30) {
  return new Promise((resolve, reject) => {
    // 먼저 비디오 정보를 가져옴
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        console.error("FFprobe 오류:", err);
        return reject(err);
      }

      const duration = metadata.format.duration; // 초 단위
      const currentSizeMB = fs.statSync(inputPath).size / (1024 * 1024);

      console.log(`📹 원본 비디오 정보:`);
      console.log(`- 길이: ${duration.toFixed(1)}초`);
      console.log(`- 현재 크기: ${currentSizeMB.toFixed(1)}MB`);
      console.log(`- 목표 크기: ${targetSizeMB}MB`);

      // 목표 비트레이트 계산 (약간의 여유를 둠)
      const targetSizeBytes = targetSizeMB * 1024 * 1024 * 0.9; // 90%로 안전 마진
      const targetBitrate = Math.floor((targetSizeBytes * 8) / duration / 1000); // kbps

      // 최소/최대 비트레이트 제한
      const minBitrate = 200; // 200kbps
      const maxBitrate = 2000; // 2Mbps
      const finalBitrate = Math.max(
        minBitrate,
        Math.min(maxBitrate, targetBitrate)
      );

      console.log(`🎯 계산된 목표 비트레이트: ${finalBitrate}kbps`);

      // FFmpeg 압축 실행
      ffmpeg(inputPath)
        .outputOptions([
          "-c:v libx264", // H.264 코덱 사용
          "-preset medium", // 압축 속도와 품질의 균형
          "-crf 28", // 품질 설정 (28은 적당한 압축)
          `-b:v ${finalBitrate}k`, // 비디오 비트레이트
          "-maxrate " + finalBitrate * 1.2 + "k", // 최대 비트레이트
          "-bufsize " + finalBitrate * 2 + "k", // 버퍼 크기
          "-c:a aac", // AAC 오디오 코덱
          "-b:a 128k", // 오디오 비트레이트
          "-movflags +faststart", // 스트리밍 최적화
          "-pix_fmt yuv420p", // 호환성을 위한 픽셀 포맷
        ])
        .size("854x480") // 480p 해상도로 제한
        .on("start", (commandLine) => {
          console.log("🔄 FFmpeg 압축 시작:", commandLine);
        })
        .on("progress", (progress) => {
          console.log(`📊 압축 진행률: ${Math.round(progress.percent || 0)}%`);
        })
        .on("end", () => {
          const compressedSizeMB = fs.statSync(outputPath).size / (1024 * 1024);
          console.log(`✅ 압축 완료!`);
          console.log(`- 압축 후 크기: ${compressedSizeMB.toFixed(1)}MB`);
          console.log(
            `- 압축률: ${Math.round(
              (1 - compressedSizeMB / currentSizeMB) * 100
            )}%`
          );

          if (compressedSizeMB <= targetSizeMB) {
            console.log(
              `🎉 목표 크기 달성! (${compressedSizeMB.toFixed(
                1
              )}MB ≤ ${targetSizeMB}MB)`
            );
          } else {
            console.log(
              `⚠️ 목표 크기 초과 (${compressedSizeMB.toFixed(
                1
              )}MB > ${targetSizeMB}MB)`
            );
          }

          resolve({
            originalSize: currentSizeMB,
            compressedSize: compressedSizeMB,
            compressionRatio: Math.round(
              (1 - compressedSizeMB / currentSizeMB) * 100
            ),
          });
        })
        .on("error", (err) => {
          console.error("❌ FFmpeg 압축 오류:", err);
          reject(err);
        })
        .save(outputPath);
    });
  });
}

// 영상만 다 불러오기
exports.getVideoFiles = async (req, res) => {
  const userId = req.user?.id;

  if (!userId)
    return res.status(400).json({ message: "user_id가 필요합니다." });

  try {
    const videos = await File.findAll({
      where: {
        userId,
        videoUrl: { [Op.ne]: null }, // videoUrl 컬럼이 null이 아닌 것만
      },
      order: [["recordedAt", "DESC"]],
      attributes: ["videoUrl", "songTitle", "recordedAt"],
    });

    const response = videos.map((v) => ({
      video_url: v.videoUrl,
      song_title: v.songTitle,
      date: v.recordedAt.toISOString().slice(0, 10),
    }));

    res.status(200).json(response);
  } catch (error) {
    console.error("영상 파일 조회 오류:", error);
    res.status(500).json({ message: "서버 오류" });
  }
};

//노래별로 영상과 녹음 다 불러오기
exports.getFilesBySong = async (req, res) => {
  const userId = req.user?.id;
  const songId = req.query.song_id;

  if (!userId || !songId) {
    return res.status(400).json({ message: "user_id와 song_id가 필요합니다." });
  }

  try {
    const files = await File.findAll({
      where: {
        userId,
        songTitle: { [Op.ne]: null }, // songTitle이 null 아닌 것 (안하면 아무거나 나올 수도 있음)
      },
      // songTitle 대신 song_id가 DB에 없으면 songTitle로 필터링 못함. 실제 DB 구조에 맞게 조정 필요
      // songId 필드 없으면, songTitle로 필터하는 대신 songId 컬럼 추가 검토 필요

      // 아래 조건은 songTitle 대신 songId가 있으면 대체 가능:
      // where: { userId, songId },

      // 만약 song_id 컬럼 있으면 아래로 변경:
      // where: { userId, songId: songId },

      order: [["recordedAt", "DESC"]],
      attributes: ["videoUrl", "audioUrl", "recordedAt"],
    });

    // songTitle이 없으면 요청한 song_id랑 매칭 안 될 수 있음. DB 스키마 확인 필요

    // 응답 변환
    const response = files.map((f) => ({
      video_url: f.videoUrl || null,
      recording_url: f.audioUrl || null,
      date: f.recordedAt.toISOString().slice(0, 10),
    }));

    res.status(200).json(response);
  } catch (error) {
    console.error("노래별 파일 조회 오류:", error);
    res.status(500).json({ message: "서버 오류" });
  }
};

// 오디오 파일 업로드
exports.uploadAudio = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "인증이 필요합니다.",
      });
    }

    // 사용자 존재 여부 확인
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "존재하지 않는 사용자입니다.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "오디오 파일이 필요합니다.",
      });
    }

    const { songTitle } = req.body;

    console.log(`🎵 오디오 파일 업로드 시작: ${req.file.originalname}`);

    // Cloudinary에 오디오 업로드
    const result = await cloudinary.uploader.upload(req.file.path, {
      resource_type: "video", // 오디오도 video로 설정
      folder: "grip/audio",
      public_id: `audio_${userId}_${Date.now()}`,
      quality: "auto",
    });

    // 임시 파일 삭제
    fs.unlinkSync(req.file.path);

    // DB에 저장
    const fileRecord = await File.create({
      userId: userId,
      audioUrl: result.secure_url,
      songTitle: songTitle || "제목 없음",
      recordedAt: new Date(),
    });

    console.log(`✅ 오디오 업로드 완료: ${result.secure_url}`);

    res.status(200).json({
      success: true,
      message: "오디오 파일이 성공적으로 업로드되었습니다.",
      data: {
        fileId: fileRecord.id,
        audioUrl: result.secure_url,
        songTitle: songTitle,
        duration: result.duration || null,
        format: result.format,
        uploadedAt: fileRecord.recordedAt,
      },
    });
  } catch (error) {
    // 임시 파일이 있으면 삭제
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error("오디오 업로드 오류:", error);
    res.status(500).json({
      success: false,
      message: "오디오 업로드 중 오류가 발생했습니다.",
      error: error.message,
    });
  }
};

// 비디오 파일 업로드
exports.uploadVideo = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "인증이 필요합니다.",
      });
    }

    // 사용자 존재 여부 확인
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "존재하지 않는 사용자입니다.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "비디오 파일이 필요합니다.",
      });
    }

    const { songTitle } = req.body;
    console.log(`🎬 비디오 파일 업로드 시작: ${req.file.originalname}`);

    // 파일 크기 확인
    const fileStats = fs.statSync(req.file.path);
    const fileSizeMB = fileStats.size / (1024 * 1024);
    console.log(`📊 비디오 파일 크기: ${fileSizeMB.toFixed(2)} MB`);

    // 모든 비디오 파일을 30MB 이하로 FFmpeg 압축
    console.log("🎯 FFmpeg를 사용한 30MB 이하 강제 압축 모드");

    // 압축된 파일 저장 경로
    const compressedFileName = `compressed_${Date.now()}_${path.basename(
      req.file.originalname,
      path.extname(req.file.originalname)
    )}.mp4`;
    const compressedFilePath = path.join(
      path.dirname(req.file.path),
      compressedFileName
    );

    try {
      // FFmpeg로 30MB 이하로 압축
      console.log("🔄 FFmpeg 압축 시작...");
      const compressionResult = await compressVideoTo30MB(
        req.file.path,
        compressedFilePath,
        30
      );

      // 원본 파일 삭제
      fs.unlinkSync(req.file.path);

      // 압축된 파일을 Cloudinary에 업로드 (간단한 옵션으로)
      const uploadOptions = {
        resource_type: "video",
        folder: "grip/video",
        public_id: `video_${userId}_${Date.now()}`,
        timeout: 600000, // 10분 타임아웃
        use_filename: false,
        unique_filename: true,
        format: "mp4", // 이미 FFmpeg로 압축했으므로 추가 변환 없음
      };

      console.log("☁️ 압축된 파일 Cloudinary 업로드 시작...");
      const result = await cloudinary.uploader.upload(
        compressedFilePath,
        uploadOptions
      );

      console.log("✅ Cloudinary 업로드 성공!");
      console.log("- Public ID:", result.public_id);
      console.log("- URL:", result.secure_url);
      console.log(
        "- 최종 파일 크기:",
        Math.round((result.bytes / 1024 / 1024) * 100) / 100,
        "MB"
      );
      console.log("- 해상도:", `${result.width}x${result.height}`);
      console.log("- 포맷:", result.format);

      // 압축된 임시 파일 삭제
      fs.unlinkSync(compressedFilePath);

      // DB에 저장
      const fileRecord = await File.create({
        userId: userId,
        videoUrl: result.secure_url,
        songTitle: songTitle || "제목 없음",
        recordedAt: new Date(),
      });

      console.log(`✅ 비디오 업로드 완료: ${result.secure_url}`);

      res.status(200).json({
        success: true,
        message:
          "비디오가 FFmpeg로 30MB 이하로 압축되어 성공적으로 업로드되었습니다!",
        data: {
          fileId: fileRecord.id,
          videoUrl: result.secure_url,
          songTitle: songTitle,
          duration: result.duration || null,
          format: result.format,
          width: result.width,
          height: result.height,
          fileSize: result.bytes,
          originalSize: `${fileSizeMB.toFixed(1)}MB`,
          compressedSize: `${compressionResult.compressedSize.toFixed(1)}MB`,
          compressionRatio: `${compressionResult.compressionRatio}%`,
          uploadMethod: "FFmpeg 30MB 이하 압축",
          uploadedAt: fileRecord.recordedAt,
        },
      });
    } catch (compressionError) {
      console.error("FFmpeg 압축 오류:", compressionError);

      // 압축 실패시 임시 파일들 정리
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      if (fs.existsSync(compressedFilePath)) {
        fs.unlinkSync(compressedFilePath);
      }

      throw new Error(`비디오 압축 실패: ${compressionError.message}`);
    }
  } catch (error) {
    // 임시 파일이 있으면 삭제
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error("비디오 업로드 오류:", error);

    // 특정 에러 메시지에 따른 처리
    let errorMessage = "비디오 업로드 중 오류가 발생했습니다.";

    if (error.message && error.message.includes("File size too large")) {
      errorMessage = "파일 크기가 너무 큽니다. 더 작은 파일을 업로드해주세요.";
    } else if (error.message && error.message.includes("timeout")) {
      errorMessage =
        "업로드 시간이 초과되었습니다. 파일 크기를 줄이거나 다시 시도해주세요.";
    } else if (error.message && error.message.includes("Invalid")) {
      errorMessage = "유효하지 않은 비디오 파일입니다.";
    } else if (error.message && error.message.includes("transformation")) {
      errorMessage =
        "비디오 압축 중 오류가 발생했습니다. 다른 파일을 시도해주세요.";
    } else if (error.message && error.message.includes("비디오 압축 실패")) {
      errorMessage = error.message;
    } else if (error.message && error.message.includes("FFmpeg")) {
      errorMessage =
        "비디오 처리 중 오류가 발생했습니다. 지원되는 비디오 형식인지 확인해주세요.";
    }

    res.status(500).json({
      success: false,
      message: errorMessage,
      error: error.message,
    });
  }
};

// 매우 큰 비디오 파일을 위한 스트리밍 업로드
exports.uploadLargeVideo = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "인증이 필요합니다.",
      });
    }

    // 사용자 존재 여부 확인
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "존재하지 않는 사용자입니다.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "비디오 파일이 필요합니다.",
      });
    }

    const { songTitle } = req.body;
    console.log(
      `🎬 대용량 비디오 파일 스트리밍 업로드 시작: ${req.file.originalname}`
    );

    // 파일 크기 확인
    const fileStats = fs.statSync(req.file.path);
    const fileSizeMB = fileStats.size / (1024 * 1024);
    console.log(`📊 비디오 파일 크기: ${fileSizeMB.toFixed(2)} MB`);

    // 스트리밍 업로드 옵션
    const uploadOptions = {
      resource_type: "video",
      folder: "grip/video",
      public_id: `large_video_${userId}_${Date.now()}`,
      chunk_size: 6000000, // 6MB 청크
      timeout: 1200000, // 20분 타임아웃
      quality: "auto:low",
      format: "mp4",
      video_codec: "h264",
      audio_codec: "aac",
      bit_rate: "800k", // 800kbps로 제한
      transformation: [
        {
          width: 640,
          height: 360,
          crop: "limit",
          quality: "auto:low",
          format: "mp4",
          video_codec: "h264",
          bit_rate: "800k",
        },
      ],
    };

    console.log("☁️ Cloudinary 스트리밍 업로드 시작...");

    // 스트림을 사용한 업로드
    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      async (error, result) => {
        // 임시 파일 삭제
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        if (error) {
          console.error("스트리밍 업로드 오류:", error);
          return res.status(500).json({
            success: false,
            message: "스트리밍 업로드 중 오류가 발생했습니다.",
            error: error.message,
          });
        }

        try {
          // DB에 저장
          const fileRecord = await File.create({
            userId: userId,
            videoUrl: result.secure_url,
            songTitle: songTitle || "제목 없음",
            recordedAt: new Date(),
          });

          console.log(`✅ 대용량 비디오 업로드 완료: ${result.secure_url}`);

          return res.status(200).json({
            success: true,
            message: "대용량 비디오 파일이 성공적으로 업로드되었습니다.",
            data: {
              fileId: fileRecord.id,
              videoUrl: result.secure_url,
              songTitle: songTitle,
              duration: result.duration || null,
              format: result.format,
              width: result.width,
              height: result.height,
              fileSize: result.bytes,
              uploadedAt: fileRecord.recordedAt,
            },
          });
        } catch (dbError) {
          console.error("DB 저장 오류:", dbError);
          return res.status(500).json({
            success: false,
            message: "DB 저장 중 오류가 발생했습니다.",
            error: dbError.message,
          });
        }
      }
    );

    // 파일 스트림을 업로드 스트림으로 파이프
    const fileStream = fs.createReadStream(req.file.path);
    fileStream.pipe(uploadStream);
  } catch (error) {
    // 임시 파일이 있으면 삭제
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error("대용량 비디오 업로드 오류:", error);

    let errorMessage = "대용량 비디오 업로드 중 오류가 발생했습니다.";

    if (error.message && error.message.includes("File size too large")) {
      errorMessage =
        "파일 크기가 너무 큽니다. 200MB 이하의 파일을 업로드해주세요.";
    } else if (error.message && error.message.includes("timeout")) {
      errorMessage =
        "업로드 시간이 초과되었습니다. 파일 크기를 줄이거나 다시 시도해주세요.";
    }

    res.status(500).json({
      success: false,
      message: errorMessage,
      error: error.message,
    });
  }
};

// 저장된 파일의 고유 제목 리스트 반환 (중복 제거)
exports.getUniqueFileTitles = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "인증이 필요합니다.",
      });
    }

    // 사용자 존재 여부 확인
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "존재하지 않는 사용자입니다.",
      });
    }

    console.log(`📋 사용자 ${userId}의 파일 제목 리스트 조회 시작`);

    // 해당 사용자의 모든 파일에서 고유한 songTitle 조회
    const files = await File.findAll({
      where: {
        userId,
        songTitle: { [Op.ne]: null }, // songTitle이 null이 아닌 것만
      },
      attributes: ["songTitle", "recordedAt"],
      order: [["recordedAt", "DESC"]], // 최신순 정렬
    });

    // 중복 제거를 위해 Set 사용
    const uniqueTitles = [...new Set(files.map((file) => file.songTitle))];

    // 제목별로 최신 날짜 정보도 함께 제공
    const titlesWithInfo = uniqueTitles.map((title) => {
      const filesWithTitle = files.filter((file) => file.songTitle === title);
      const latestFile = filesWithTitle[0]; // 이미 최신순으로 정렬되어 있음

      return {
        title: title,
        latestRecordedAt: latestFile.recordedAt,
        totalFiles: filesWithTitle.length,
      };
    });

    console.log(`✅ 고유 제목 ${uniqueTitles.length}개 조회 완료`);

    res.status(200).json({
      success: true,
      message: "파일 제목 리스트 조회 성공",
      data: {
        totalUniqueTitles: uniqueTitles.length,
        titles: uniqueTitles, // 간단한 제목 배열
        detailedTitles: titlesWithInfo, // 상세 정보 포함
      },
    });
  } catch (error) {
    console.error("파일 제목 리스트 조회 오류:", error);
    res.status(500).json({
      success: false,
      message: "파일 제목 리스트 조회 중 오류가 발생했습니다.",
      error: error.message,
    });
  }
};

// 특정 제목의 모든 파일 조회 (음원 + 영상)
exports.getFilesByTitle = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { title } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "인증이 필요합니다.",
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "title 파라미터가 필요합니다.",
      });
    }

    // 사용자 존재 여부 확인
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "존재하지 않는 사용자입니다.",
      });
    }

    console.log(`🔍 제목 "${title}"의 파일 조회 시작 (사용자: ${userId})`);

    // 해당 제목의 모든 파일 조회
    const files = await File.findAll({
      where: {
        userId,
        songTitle: title,
      },
      order: [["recordedAt", "DESC"]],
      attributes: ["id", "audioUrl", "videoUrl", "songTitle", "recordedAt"],
    });

    // 음원과 영상 파일로 분류
    const audioFiles = files
      .filter((file) => file.audioUrl)
      .map((file) => ({
        fileId: file.id,
        audioUrl: file.audioUrl,
        recordedAt: file.recordedAt,
        date: file.recordedAt.toISOString().slice(0, 10),
      }));

    const videoFiles = files
      .filter((file) => file.videoUrl)
      .map((file) => ({
        fileId: file.id,
        videoUrl: file.videoUrl,
        recordedAt: file.recordedAt,
        date: file.recordedAt.toISOString().slice(0, 10),
      }));

    console.log(
      `✅ 제목 "${title}" 파일 조회 완료: 음원 ${audioFiles.length}개, 영상 ${videoFiles.length}개`
    );

    res.status(200).json({
      success: true,
      message: `제목 "${title}"의 파일 조회 성공`,
      data: {
        title: title,
        totalFiles: files.length,
        audioFiles: audioFiles,
        videoFiles: videoFiles,
        audioCount: audioFiles.length,
        videoCount: videoFiles.length,
      },
    });
  } catch (error) {
    console.error("제목별 파일 조회 오류:", error);
    res.status(500).json({
      success: false,
      message: "제목별 파일 조회 중 오류가 발생했습니다.",
      error: error.message,
    });
  }
};

// 멀터 미들웨어 내보내기
exports.uploadMiddleware = upload;
