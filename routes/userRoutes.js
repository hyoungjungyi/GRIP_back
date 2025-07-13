const express = require('express');
const router = express.Router();
const { User } = require('../models');
const authenticateToken = require('../middlewares/authMiddleware');

router.get('/profile', authenticateToken, async (req, res) => {
  const userId = req.user.id; // 미들웨어에서 붙여준 값

  const user = await User.findByPk(userId, {
    attributes: ['id', 'username', 'email', 'goalTime', 'chromaticEnabled', 'recordingEnabled'],
  });

  if (!user) return res.status(404).json({ message: 'User not found' });

  res.json(user);
});

module.exports = router;
