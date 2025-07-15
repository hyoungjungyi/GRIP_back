const { PracticeRecord, File, ChromaticPractice, User } = require("../models");
const { Op } = require("sequelize");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const fs = require("fs");
const path = require("path");

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
    
    // 기본 업로드 옵션
    let uploadOptions = {
      resource_type: "video",
      folder: "grip/video", 
      public_id: `video_${userId}_${Date.now()}`,
      timeout: 600000, // 10분 타임아웃
      use_filename: false,
      unique_filename: true,
    };
    
    // 파일 크기에 따른 업로드 전략
    if (fileSizeMB > 100) {
      // 100MB 이상: 매우 큰 파일
      console.log("🚀 매우 큰 파일 감지 - 최적화 업로드 모드");
      uploadOptions = {
        ...uploadOptions,
        chunk_size: 6000000, // 6MB 청크로 업로드
        quality: "auto:low",
        format: "mp4",
        video_codec: "h264",
        audio_codec: "aac",
        bit_rate: "1m", // 1Mbps로 제한
        transformation: [
          { 
            width: 854, 
            height: 480, 
            crop: "limit",
            quality: "auto:low",
            format: "mp4",
            video_codec: "h264",
            bit_rate: "1m"
          }
        ]
      };
    } else if (fileSizeMB > 50) {
      // 50-100MB: 큰 파일
      console.log("📹 큰 파일 감지 - 압축 업로드 모드");
      uploadOptions = {
        ...uploadOptions,
        chunk_size: 8000000, // 8MB 청크
        quality: "auto",
        format: "mp4",
        video_codec: "h264",
        transformation: [
          { 
            width: 1280, 
            height: 720, 
            crop: "limit",
            quality: "auto",
            format: "mp4"
          }
        ]
      };
    } else {
      // 50MB 이하: 일반 파일
      console.log("📱 일반 파일 - 표준 업로드 모드");
      uploadOptions = {
        ...uploadOptions,
        quality: "auto",
        format: "mp4",
        transformation: [
          { 
            width: 1920, 
            height: 1080, 
            crop: "limit",
            quality: "auto:good",
            format: "mp4"
          }
        ]
      };
    }

    // Cloudinary에 비디오 업로드
    console.log("☁️ Cloudinary 업로드 시작...");
    const result = await cloudinary.uploader.upload(req.file.path, uploadOptions);

    console.log("📤 업로드 결과:", {
      url: result.secure_url,
      format: result.format,
      duration: result.duration,
      bytes: result.bytes,
      width: result.width,
      height: result.height
    });

    // 임시 파일 삭제
    fs.unlinkSync(req.file.path);

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
      message: "비디오 파일이 성공적으로 업로드되었습니다.",
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
  } catch (error) {
    // 임시 파일이 있으면 삭제
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error("비디오 업로드 오류:", error);
    
    // 특정 에러 메시지에 따른 처리
    let errorMessage = "비디오 업로드 중 오류가 발생했습니다.";
    
    if (error.message && error.message.includes("File size too large")) {
      errorMessage = "파일 크기가 너무 큽니다. 100MB 이하의 파일을 업로드해주세요.";
    } else if (error.message && error.message.includes("timeout")) {
      errorMessage = "업로드 시간이 초과되었습니다. 파일 크기를 줄이거나 다시 시도해주세요.";
    } else if (error.message && error.message.includes("Invalid")) {
      errorMessage = "유효하지 않은 비디오 파일입니다.";
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
    console.log(`🎬 대용량 비디오 파일 스트리밍 업로드 시작: ${req.file.originalname}`);
    
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
          bit_rate: "800k"
        }
      ]
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
      errorMessage = "파일 크기가 너무 큽니다. 200MB 이하의 파일을 업로드해주세요.";
    } else if (error.message && error.message.includes("timeout")) {
      errorMessage = "업로드 시간이 초과되었습니다. 파일 크기를 줄이거나 다시 시도해주세요.";
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
      attributes: ['songTitle', 'recordedAt'],
      order: [['recordedAt', 'DESC']], // 최신순 정렬
    });

    // 중복 제거를 위해 Set 사용
    const uniqueTitles = [...new Set(files.map(file => file.songTitle))];
    
    // 제목별로 최신 날짜 정보도 함께 제공
    const titlesWithInfo = uniqueTitles.map(title => {
      const filesWithTitle = files.filter(file => file.songTitle === title);
      const latestFile = filesWithTitle[0]; // 이미 최신순으로 정렬되어 있음
      
      return {
        title: title,
        latestRecordedAt: latestFile.recordedAt,
        totalFiles: filesWithTitle.length
      };
    });

    console.log(`✅ 고유 제목 ${uniqueTitles.length}개 조회 완료`);

    res.status(200).json({
      success: true,
      message: "파일 제목 리스트 조회 성공",
      data: {
        totalUniqueTitles: uniqueTitles.length,
        titles: uniqueTitles, // 간단한 제목 배열
        detailedTitles: titlesWithInfo // 상세 정보 포함
      }
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
      order: [['recordedAt', 'DESC']],
      attributes: ['id', 'audioUrl', 'videoUrl', 'songTitle', 'recordedAt'],
    });

    // 음원과 영상 파일로 분류
    const audioFiles = files.filter(file => file.audioUrl).map(file => ({
      fileId: file.id,
      audioUrl: file.audioUrl,
      recordedAt: file.recordedAt,
      date: file.recordedAt.toISOString().slice(0, 10)
    }));

    const videoFiles = files.filter(file => file.videoUrl).map(file => ({
      fileId: file.id,
      videoUrl: file.videoUrl,
      recordedAt: file.recordedAt,
      date: file.recordedAt.toISOString().slice(0, 10)
    }));

    console.log(`✅ 제목 "${title}" 파일 조회 완료: 음원 ${audioFiles.length}개, 영상 ${videoFiles.length}개`);

    res.status(200).json({
      success: true,
      message: `제목 "${title}"의 파일 조회 성공`,
      data: {
        title: title,
        totalFiles: files.length,
        audioFiles: audioFiles,
        videoFiles: videoFiles,
        audioCount: audioFiles.length,
        videoCount: videoFiles.length
      }
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
