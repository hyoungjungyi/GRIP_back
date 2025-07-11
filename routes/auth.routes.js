// routes/auth.routes.js

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// 구글 로그인 → 자체 JWT 발급
router.post('/google', authController.googleLogin);

// JWT 유효성 검사
router.post('/verify', authController.verifyToken);

// 리프레시 토큰으로 액세스 토큰 재발급
router.post('/refresh', authController.refreshToken);

module.exports = router;
