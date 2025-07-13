const express = require('express');
const router = express.Router();


const authRoutes = require('./auth.routes');
const filesRoutes = require('./files.routes');
const metronomeRoutes = require('./metronome.routes');
const practiceRoutes = require('./practice.routes');
const songsRoutes = require('./songs.routes');
const userRoutes = require('./userRoutes');

router.use('/users', userRoutes);
router.use('/metronome', metronomeRoutes);
router.use('/songs', songsRoutes);
router.use('/api/auth', authRoutes);
router.use('/files', filesRoutes);
router.use('/practice', practiceRoutes);
module.exports = router;



