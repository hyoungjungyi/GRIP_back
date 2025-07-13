const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
require('dotenv').config();
const axios = require('axios');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const SECRET_KEY = process.env.JWT_SECRET;
const REFRESH_SECRET_KEY = process.env.JWT_REFRESH_SECRET;

const refreshTokens = new Set(); // 간단하게 저장 (실제론 Redis/DB 추천)

// 1. 구글 로그인 → JWT 발급
exports.googleLogin = async (req, res) => {
  const { token:idToken } = req.body;
  console.log('[googleLogin] 요청 받음, idToken:', idToken);
  if (!idToken) return res.status(400).json({ message: 'idToken missing' });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;
    console.log('[googleLogin] 구글 토큰 검증 성공:', { googleId, email, name });

    // 유저 DB 확인 or 생성
    let user = await User.findOne({ where: { googleId } });
    if (!user) {
      user = await User.create({
        googleId,
        email,
        username: name,
      });
      console.log("New user created:", user.toJSON());
    } else {
        console.log("Existing user logged in:", user.toJSON());
    }

    const accessToken = jwt.sign({ id: user.id, gogleId: user.googleId, username: user.username }, SECRET_KEY, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ id: user.id }, REFRESH_SECRET_KEY, { expiresIn: '7d' });

    refreshTokens.add(refreshToken);
    console.log('[googleLogin] JWT 토큰 발급 완료');

    res.json({
      token: accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        profileImage: user.profileImage,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(401).json({ message: 'Invalid Google token' });
  }
};

// 2. JWT 유효성 검증
exports.verifyToken = (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ valid: false, message: 'No token provided' });

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(401).json({ valid: false, message: 'Invalid or expired token' });
    res.json({ valid: true, user: decoded });
  });
};

// 3. 리프레시 토큰 → 새로운 액세스 토큰
exports.refreshToken = (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ message: 'Missing refresh token' });
  if (!refreshTokens.has(refreshToken)) {
    return res.status(403).json({ message: 'Invalid refresh token' });
  }

  jwt.verify(refreshToken, REFRESH_SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid refresh token' });

    const newToken = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ token: newToken });
  });
};
 