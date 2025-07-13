const express = require('express');
const router = express.Router();
const practiceController = require('../controllers/practice.controller');
const authenticateToken = require('../middlewares/authMiddleware')

/**
 * @swagger
 * /api/practice/chromatic/{id}:
 *   delete:
 *     tags:
 *     - [practice]
 *     summary: 크로매틱 연습 기록 삭제
 *     description: 주어진 ID의 크로매틱 연습 항목을 삭제합니다.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 삭제할 크로매틱 연습 ID
 *     responses:
 *       200:
 *         description: 삭제 성공
 *       400:
 *         description: ID 누락
 *       404:
 *         description: 항목 없음
 *       500:
 *         description: 서버 오류
 */
router.delete('/chromatic/:id', authenticateToken , practiceController.deleteChromaticPractice);

module.exports = router;


/**
 * @swagger
 * /api/practice/today:
 *   get:
 *     summary: 오늘의 연습 요약 정보 조회
 *     tags: [practice]
 *     parameters:
 *       - in: query
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 사용자 ID
 *     responses:
 *       200:
 *         description: 오늘 연습 요약 반환
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 date:
 *                   type: string
 *                 total_time:
 *                   type: integer
 *                 daily_goal_time:
 *                   type: integer
 *                 recording_uploaded:
 *                   type: boolean
 *                 chromatic_practice:
 *                   type: object
 *                   properties:
 *                     total_duration:
 *                       type: integer
 *                     fingering:
 *                       type: array
 *                       items:
 *                         type: string
 *                     bpms:
 *                       type: array
 *                       items:
 *                         type: integer
 *       400:
 *         description: user_id 누락
 *       500:
 *         description: 서버 오류
 */
router.get('/practice/today', practiceController.getTodayPractice);

/**
 * @swagger
 * /api/practice/history:
 *   get:
 *     summary: 특정 날짜의 연습 히스토리 조회
 *     tags: [practice]
 *     parameters:
 *       - in: query
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: 연습 히스토리 반환
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 date:
 *                   type: string
 *                 total_time:
 *                   type: integer
 *                 achieved:
 *                   type: boolean
 *                 recording_url:
 *                   type: string
 *                   nullable: true
 *                 chromatic:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       fingering:
 *                         type: string
 *                       bpm:
 *                         type: integer
 *                       duration:
 *                         type: integer
 *       400:
 *         description: user_id 또는 date 누락
 *       500:
 *         description: 서버 오류
 */
router.get('/practice/history', practiceController.getPracticeHistoryByDate);

/**
 * @swagger
 * /practice/goal:
 *   get:
 *     tags: [practice]
 *     summary: 유저의 목표 설정 정보 조회
 *     description: 설정된 목표 연습 시간, 오늘 녹음 유무, 크로매틱 연습 유무 반환
 *     parameters:
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: integer
 *         required: true
 *         description: 유저의 ID
 *     responses:
 *       200:
 *         description: 목표 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 daily_goal_time:
 *                   type: integer
 *                 has_recording_today:
 *                   type: boolean
 *                 has_chromatic_today:
 *                   type: boolean
 */
router.get('/practice/goal', practiceController.getUserGoalInfo);

/**
 * @swagger
 * /api/practice/achieve/check:
 *   post:
 *     summary: 하루 달성 여부 판단 및 저장
 *     tags: [practice]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               user_id:
 *                 type: integer
 *               date:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: 달성 여부 반환
 *       400:
 *         description: 입력값 누락
 *       500:
 *         description: 서버 오류
 */
router.post('/achieve/check', practiceController.checkDailyAchievement);

/**
 * @swagger
 * /api/practice/achieve/monthly:
 *   get:
 *     summary: 월별 성공/실패 날짜 리스트 반환
 *     tags: [practice]
 *     parameters:
 *       - in: query
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: year
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 날짜 리스트 반환
 *       400:
 *         description: 입력값 누락
 *       500:
 *         description: 서버 오류
 */
router.get('/achieve/monthly', practiceController.getMonthlyAchievements);




module.exports = router;