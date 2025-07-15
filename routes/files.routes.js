const express = require("express");
const router = express.Router();
const filesController = require("../controllers/files.controller");
const authenticateToken = require("../middlewares/authMiddleware");
/**
 * @swagger
 * /api/files/videos:
 *   get:
 *     summary: 사용자의 영상 파일 리스트 반환
 *     tags: [files]
 *     parameters:
 *       - in: query
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 영상 파일 리스트 반환
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   video_url:
 *                     type: string
 *                   song_title:
 *                     type: string
 *                   date:
 *                     type: string
 *       400:
 *         description: user_id 누락
 *       500:
 *         description: 서버 오류
 */
router.get("/videos", authenticateToken, filesController.getVideoFiles);
/**
 * @swagger
 * /api/files/by-song:
 *   get:
 *     summary: 특정 노래의 영상 및 녹음 파일 조회
 *     tags: [files]
 *     parameters:
 *       - in: query
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: song_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 해당 노래의 영상 및 녹음 파일 리스트 반환
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   video_url:
 *                     type: string
 *                     nullable: true
 *                   recording_url:
 *                     type: string
 *                     nullable: true
 *                   date:
 *                     type: string
 *       400:
 *         description: user_id 또는 song_id 누락
 *       500:
 *         description: 서버 오류
 */

router.get("/by-song", authenticateToken, filesController.getFilesBySong);

/**
 * @swagger
 * /api/files/upload-audio:
 *   post:
 *     summary: 오디오 파일을 Cloudinary에 업로드
 *     tags: [files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - audio
 *             properties:
 *               audio:
 *                 type: string
 *                 format: binary
 *                 description: 업로드할 오디오 파일
 *               songTitle:
 *                 type: string
 *                 description: 곡 제목
 *     responses:
 *       200:
 *         description: 오디오 업로드 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     fileId:
 *                       type: integer
 *                     audioUrl:
 *                       type: string
 *                     songTitle:
 *                       type: string
 *                     duration:
 *                       type: number
 *                     format:
 *                       type: string
 *       400:
 *         description: 파일이 누락되거나 잘못된 형식
 *       401:
 *         description: 인증 필요
 *       500:
 *         description: 서버 오류
 */
router.post(
  "/upload-audio",
  authenticateToken,
  filesController.uploadMiddleware.single("audio"),
  filesController.uploadAudio
);

/**
 * @swagger
 * /api/files/upload-video:
 *   post:
 *     summary: 스마트 비디오 파일 업로드 (크기별 자동 최적화)
 *     tags: [files]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       파일 크기에 따라 자동으로 최적화된 업로드 방식을 선택합니다:
 *       - 50MB 이하: 고품질 (1080p)
 *       - 50-100MB: 중간 품질 (720p)
 *       - 100-150MB: 고압축 (480p)
 *       - 150MB 이상: 스트리밍 업로드 (360p)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - video
 *             properties:
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: 업로드할 비디오 파일 (최대 200MB)
 *               songTitle:
 *                 type: string
 *                 description: 곡 제목
 *     responses:
 *       200:
 *         description: 비디오 업로드 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     fileId:
 *                       type: integer
 *                     videoUrl:
 *                       type: string
 *                     songTitle:
 *                       type: string
 *                     duration:
 *                       type: number
 *                     format:
 *                       type: string
 *                     width:
 *                       type: integer
 *                     height:
 *                       type: integer
 *                     fileSize:
 *                       type: integer
 *                     originalSize:
 *                       type: string
 *                       description: 원본 파일 크기 (예- "120.5MB")
 *                     uploadMethod:
 *                       type: string
 *                       description: 사용된 업로드 방식 (예- "표준", "압축", "고압축", "스트리밍")
 *       400:
 *         description: 파일이 누락되거나 잘못된 형식
 *       401:
 *         description: 인증 필요
 *       500:
 *         description: 서버 오류
 */
router.post(
  "/upload-video",
  authenticateToken,
  filesController.uploadMiddleware.single("video"),
  filesController.uploadVideo
);

/**
 * @swagger
 * /api/files/upload-large-video:
 *   post:
 *     summary: 대용량 비디오 직접 스트리밍 업로드 (수동 선택용)
 *     tags: [files]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       ⚠️ 일반적으로는 /upload-video 엔드포인트를 사용하세요.
 *       이 엔드포인트는 특별히 대용량 파일을 강제로 스트리밍 업로드하고 싶을 때만 사용합니다.
 *       /upload-video 엔드포인트가 자동으로 최적화된 업로드 방식을 선택합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - video
 *             properties:
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: 업로드할 대용량 비디오 파일 (최대 200MB)
 *               songTitle:
 *                 type: string
 *                 description: 곡 제목
 *     responses:
 *       200:
 *         description: 대용량 비디오 업로드 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     fileId:
 *                       type: integer
 *                     videoUrl:
 *                       type: string
 *                     songTitle:
 *                       type: string
 *                     duration:
 *                       type: number
 *                     format:
 *                       type: string
 *                     width:
 *                       type: integer
 *                     height:
 *                       type: integer
 *                     fileSize:
 *                       type: integer
 *       400:
 *         description: 파일이 누락되거나 잘못된 형식
 *       401:
 *         description: 인증 필요
 *       500:
 *         description: 서버 오류
 */
router.post(
  "/upload-large-video",
  authenticateToken,
  filesController.uploadMiddleware.single("video"),
  filesController.uploadLargeVideo
);

/**
 * @swagger
 * /api/files/titles:
 *   get:
 *     summary: 저장된 파일의 고유 제목 리스트 반환 (중복 제거)
 *     tags: [files]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 고유 제목 리스트 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalUniqueTitles:
 *                       type: integer
 *                       description: 고유 제목 개수
 *                     titles:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: 간단한 제목 배열
 *                     detailedTitles:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           title:
 *                             type: string
 *                           latestRecordedAt:
 *                             type: string
 *                             format: date-time
 *                           totalFiles:
 *                             type: integer
 *       401:
 *         description: 인증 필요
 *       500:
 *         description: 서버 오류
 */
router.get("/titles", authenticateToken, filesController.getUniqueFileTitles);

/**
 * @swagger
 * /api/files/by-title:
 *   get:
 *     summary: 특정 제목의 모든 파일 조회 (음원 + 영상)
 *     tags: [files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: title
 *         required: true
 *         schema:
 *           type: string
 *         description: 조회할 파일 제목
 *     responses:
 *       200:
 *         description: 제목별 파일 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *                     totalFiles:
 *                       type: integer
 *                     audioFiles:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           fileId:
 *                             type: integer
 *                           audioUrl:
 *                             type: string
 *                           recordedAt:
 *                             type: string
 *                             format: date-time
 *                           date:
 *                             type: string
 *                     videoFiles:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           fileId:
 *                             type: integer
 *                           videoUrl:
 *                             type: string
 *                           recordedAt:
 *                             type: string
 *                             format: date-time
 *                           date:
 *                             type: string
 *                     audioCount:
 *                       type: integer
 *                     videoCount:
 *                       type: integer
 *       400:
 *         description: title 파라미터 누락
 *       401:
 *         description: 인증 필요
 *       500:
 *         description: 서버 오류
 */
router.get("/by-title", authenticateToken, filesController.getFilesByTitle);

module.exports = router;
