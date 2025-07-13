const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET_KEY = process.env.JWT_SECRET;

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>" → token만 추출
  console.log("📌 토큰:", token); 
  if (!token) return res.status(401).json({ message: 'No token provided' });

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      console.log("❌ JWT 검증 실패:", err);
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = {
      id:decoded.id,
      googleId:decoded.googleId,
      username:decoded.username,
    }; // { id, username } 형태
    next(); // 다음 미들웨어 또는 컨트롤러로 이동
  });
};

module.exports = authenticateToken;
