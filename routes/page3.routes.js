const express = require('express');
const router = express.Router();
const page3Controller = require('../controllers/page3.controller');

router.get('/practice/today', page3Controller.getTodayPractice);
router.get('/practice/history', page3Controller.getPracticeHistoryByDate);
router.get('/files/videos', page3Controller.getVideoFiles);
router.get('/files/by-song', page3Controller.getFilesBySong);

module.exports = router;
