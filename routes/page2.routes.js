const express = require('express');
const router = express.Router();
const page2Controller = require('../controllers/page2.controller');

router.post('/', page2Controller.generateTabFromAudio);
router.get('/songs/all-lists', page2Controller.getAllSongLists);
router.get('/sheet/:id', page2Controller.getSheetImage);

module.exports = router;

