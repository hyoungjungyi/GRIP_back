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
router.get("/sheets/:id", authenticateToken, songsController.getSheetImage);

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

module.exports = router;
