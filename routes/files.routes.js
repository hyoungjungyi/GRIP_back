const express = require('express');
const router = express.Router();
const filesController = require('../controllers/files.controller');
const authenticateToken = require('../middlewares/authMiddleware');
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
router.get('/videos', authenticateToken,filesController.getVideoFiles);
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

router.get('/by-song', authenticateToken,filesController.getFilesBySong);

module.exports = router;