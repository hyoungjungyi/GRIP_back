const express = require('express');
const router = express.Router();
const page1Controller  = require('../controllers/page1.controller');
const authenticateToken = require('../middlewares/authenticateToken')


router.get('/last', page1Controller.getLastChromaticPractice);
router.post('/chromatic/total', page1Controller.saveTotalPracticeTime);
router.delete('/chromatic/:id', authenticateToken , page1Controller.deleteChromaticPractice);

module.exports = router;



// 테스트
const express = require('express');
const songsController = require('../controllers/songs.controller');

router.get('/all-lists', songsController.getAllSavedSongs);

module.exports = router;

