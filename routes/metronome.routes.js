const express = require('express');
const router = express.Router();
const metronomeController  = require('../controllers/metronome.controller');
const authenticateToken = require('../middlewares/authMiddleware')

/**
 * @swagger
 * /api/metronome/last:
 *   get:
 *     tags:
 *     - [metronome]
 *     summary: 최근 크로매틱 연습 프리셋 조회
 *     description: 사용자의 마지막 크로매틱 연습 기록에서 bpm과 운지법, 날짜를 반환합니다.
 *     parameters:
 *       - in: query
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 유저 ID
 *     responses:
 *       200:
 *         description: 성공적으로 프리셋 반환
 *       400:
 *         description: user_id 누락
 *       404:
 *         description: 해당 유저의 기록 없음
 */
router.get('/last', metronomeController.getLastChromaticPractice);
/**
 * @swagger
 * /api/metronome/chromatic/total:
 *   post:
 *     tags:
 *     - [metronome]
 *     summary: 오늘의 크로매틱 연습 총량 저장
 *     description: 유저의 운지법별 마지막 연습 기록을 저장하거나 갱신합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: integer
 *               date:
 *                 type: string
 *                 format: date
 *               totalPracticeTime:
 *                 type: integer
 *               details:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     fingering:
 *                       type: string
 *                     bpm:
 *                       type: integer
 *                     practiceTime:
 *                       type: integer
 *     responses:
 *       200:
 *         description: 저장 성공
 *       400:
 *         description: 요청값 누락
 *       500:
 *         description: 서버 오류
 */
router.post('/chromatic/total', metronomeController.saveTotalPracticeTime);
module.exports = router;




