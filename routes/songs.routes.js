const express = require("express");
const router = express.Router();
const songsController = require("../controllers/songs.controller");
const authenticateToken = require("../middlewares/authMiddleware");

/**
 * @swagger
 * /api/songs/tab-generator:
 *   post:
 *     summary: AI로부터 악보를 생성하고 이미지 URL 반환
 *     tags: [songs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - audio_url
 *             properties:
 *               audio_url:
 *                 type: string
 *                 description: S3에 업로드된 오디오 파일 URL
 *     responses:
 *       200:
 *         description: 악보 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 tab_image_url:
 *                   type: string
 *                 song_id:
 *                   type: integer
 *       400:
 *         description: audio_url 누락
 *       500:
 *         description: 서버 오류
 */
router.post("/tab-generator", songsController.generateTabFromAudio);
/**
 * @swagger
 * /api/songs/sheets/all-lists:
 *   get:
 *     summary: 사용자의 연습곡/추천곡/AI 생성곡 리스트 조회
 *     tags: [songs]
 *     parameters:
 *       - in: query
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 사용자 ID
 *     responses:
 *       200:
 *         description: 곡 리스트 반환
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ongoing:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       song_id:
 *                         type: integer
 *                       title:
 *                         type: string
 *                       artist:
 *                         type: string
 *                       progress:
 *                         type: integer
 *                 recommend:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       song_id:
 *                         type: integer
 *                       title:
 *                         type: string
 *                       artist:
 *                         type: string
 *                       genre:
 *                         type: string
 *                 generated:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       song_id:
 *                         type: integer
 *                       title:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *       400:
 *         description: user_id 누락
 *       500:
 *         description: 서버 오류
 */

router.get("/all-lists", authenticateToken, songsController.getAllSongLists);
/**
 * @swagger
 * /api/songs/{id}:
 *   get:
 *     summary: 악보 이미지 URL 조회
 *     tags: [songs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 악보(song)의 ID
 *     responses:
 *       200:
 *         description: 악보 이미지 반환
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sheet_image_url:
 *                   type: string
 *                   description: 악보 이미지 URL
 *       400:
 *         description: 악보 ID 누락
 *       404:
 *         description: 해당 악보 없음
 *       500:
 *         description: 서버 오류
 */
router.get("/sheet/:id", authenticateToken, songsController.getSheetImage);

/**
 * @swagger
 * /api/songs/convert-youtube:
 *   post:
 *     summary: Convert YouTube video to MIDI and guitar tabs with method selection
 *     tags: [songs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - youtubeUrl
 *             properties:
 *               youtubeUrl:
 *                 type: string
 *                 description: YouTube video URL to convert
 *               tabMethod:
 *                 type: string
 *                 enum: [tabify, custom]
 *                 default: tabify
 *                 description: TAB generation method (tabify = Professional Tabify tool, custom = Custom generator)
 *     responses:
 *       200:
 *         description: Conversion successful
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
 *                     audioFile:
 *                       type: string
 *                     guitarStemFile:
 *                       type: string
 *                     midiFile:
 *                       type: string
 *                     tabImageFile:
 *                       type: string
 *                     tabTextFile:
 *                       type: string
 *                     tabMethod:
 *                       type: string
 *                       description: Actual TAB generation method used
 *                     midiRange:
 *                       type: string
 *                       description: MIDI note range used
 *       400:
 *         description: Invalid YouTube URL
 *       500:
 *         description: Server error
 */
router.post("/convert-youtube", songsController.convertYouTube);

/**
 * @swagger
 * /api/songs/upload-sheet:
 *   post:
 *     summary: 악보 업로드 (커버, 오선보, TAB)
 *     tags: [songs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - artist
 *               - cover
 *               - noteSheet
 *               - tabSheet
 *             properties:
 *               title:
 *                 type: string
 *                 description: 곡 제목
 *               artist:
 *                 type: string
 *                 description: 아티스트명
 *               cover:
 *                 type: string
 *                 format: binary
 *                 description: 앨범 커버 이미지
 *               noteSheet:
 *                 type: string
 *                 format: binary
 *                 description: 오선보 이미지
 *               tabSheet:
 *                 type: string
 *                 format: binary
 *                 description: TAB 악보 이미지
 *     responses:
 *       200:
 *         description: 악보 업로드 성공
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
 *                     songId:
 *                       type: integer
 *                     title:
 *                       type: string
 *                     artist:
 *                       type: string
 *                     coverUrl:
 *                       type: string
 *                     noteSheetUrl:
 *                       type: string
 *                     tabSheetUrl:
 *                       type: string
 *                     uploadedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: 필수 필드 누락
 *       401:
 *         description: 인증 필요
 *       500:
 *         description: 서버 오류
 */
router.post(
  "/upload-sheet",
  authenticateToken,
  songsController.sheetUploadMiddleware,
  songsController.uploadSheet
);

/**
 * @swagger
 * /api/songs/saved:
 *   get:
 *     summary: 즐겨찾기 목록 조회
 *     tags: [songs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 즐겨찾기 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       savedId:
 *                         type: integer
 *                       savedAt:
 *                         type: string
 *                         format: date-time
 *                       song_id:
 *                         type: integer
 *                       title:
 *                         type: string
 *                       artist:
 *                         type: string
 *                       genre:
 *                         type: string
 *                       coverUrl:
 *                         type: string
 *                       noteSheetUrl:
 *                         type: string
 *                       tabSheetUrl:
 *                         type: string
 *                       sheetUrl:
 *                         type: string
 *                 count:
 *                   type: integer
 *       401:
 *         description: 인증 필요
 *       500:
 *         description: 서버 오류
 *   post:
 *     summary: 즐겨찾기 추가
 *     tags: [songs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - songId
 *             properties:
 *               songId:
 *                 type: integer
 *                 description: 즐겨찾기에 추가할 곡 ID
 *     responses:
 *       201:
 *         description: 즐겨찾기 추가 성공
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
 *                     savedId:
 *                       type: integer
 *                     songId:
 *                       type: integer
 *                     title:
 *                       type: string
 *                     artist:
 *                       type: string
 *                     savedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: songId 누락
 *       401:
 *         description: 인증 필요
 *       404:
 *         description: 곡을 찾을 수 없음
 *       409:
 *         description: 이미 즐겨찾기에 추가됨
 *       500:
 *         description: 서버 오류
 */
router.get("/saved", authenticateToken, songsController.getSavedSongs);
router.post("/saved", authenticateToken, songsController.addToSavedSongs);

/**
 * @swagger
 * /api/songs/saved/{songId}:
 *   delete:
 *     summary: 즐겨찾기 제거
 *     tags: [songs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: songId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 즐겨찾기에서 제거할 곡 ID
 *     responses:
 *       200:
 *         description: 즐겨찾기 제거 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: 인증 필요
 *       404:
 *         description: 즐겨찾기에서 곡을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 *   get:
 *     summary: 즐겨찾기 상태 확인
 *     tags: [songs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: songId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 확인할 곡 ID
 *     responses:
 *       200:
 *         description: 즐겨찾기 상태 확인 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 isSaved:
 *                   type: boolean
 *                 savedId:
 *                   type: integer
 *                   nullable: true
 *                 savedAt:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *       401:
 *         description: 인증 필요
 *       500:
 *         description: 서버 오류
 */
router.delete(
  "/saved/:songId",
  authenticateToken,
  songsController.removeFromSavedSongs
);
router.get(
  "/saved/:songId",
  authenticateToken,
  songsController.checkSavedSongStatus
);

module.exports = router;
