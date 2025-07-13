const express = require('express');
const router = express.Router();

const userRoutes = require('./userRoutes');
const metronomeRoutes = require('./page1.routes');
const songsRoutes = require('./page1.routes');
const authRoutes = require('./auth.routes');
const page2Routes = require('./page2.routes');
const page3Routes = require('./page3.routes');

router.use('/users', userRoutes);
router.use('/metronome', metronomeRoutes);
router.use('/songs', songsRoutes);
router.use('/api/auth', authRoutes);
router.use('/', page2Routes); 
router.use('/', page3Routes);

module.exports = router;



