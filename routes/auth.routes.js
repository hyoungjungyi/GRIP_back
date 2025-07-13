// routes/auth.routes.js

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authenticateToken = require('../middlewares/authMiddleware');

// 구글 로그인 → 자체 JWT 발급
router.post('/google', authController.googleLogin);

// JWT 유효성 검사
router.post('/verify', authController.verifyToken);

// 리프레시 토큰으로 액세스 토큰 재발급
router.post('/refresh', authController.refreshToken);

//로그인 후 프로필 불러오기
router.get('/profile',authenticateToken, async(req,res)=>{
    console.log('profile API 요청 옴');
    res.json({ 
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
    });
});

module.exports = router;
