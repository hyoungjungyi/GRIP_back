require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const { sequelize } = require("./models");
const { swaggerUi, specs } = require("./routes/swagger");

const app = express();
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

app.get("/swagger.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(specs);
});

const apiRouter = require("./routes");
app.use("/api", apiRouter);

const PORT = process.env.PORT || 5500;
app.get("/", (req, res) => {
  res.send("서버가 잘 작동 중입니다!");
});

sequelize
  .sync({ force: false }) // 개발 중에는 alter:true, 배포 땐 false or migration 권장
  .then(() => {
    console.log("✅ DB 연결 및 테이블 생성 성공!");
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Swagger UI: http://localhost:${PORT}/api-docs`);
    console.log(`Swagger JSON: http://localhost:${PORT}/swagger.json`);
  })
  .catch((err) => console.error("❌ DB 연결 실패:", err));

//google 로그인 구현
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET;

app.post("/auth/google", async (req, res) => {
  const { id_token } = req.body;

  try {
    // 1. 구글 서버에 토큰 검증 요청
    const response = await axios.get(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${id_token}`
    );

    const payload = response.data;

    // 2. 클라이언트 ID 검증 (보안 체크)
    if (payload.aud !== GOOGLE_CLIENT_ID) {
      return res.status(401).json({ error: "Invalid client ID" });
    }

    // 3. 사용자 정보 추출
    const user = {
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      sub: payload.sub, // 유저 고유 식별자
    };

    // 4. 우리 서버용 JWT 발급
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: "1h" });

    res.json({ token, user });
  } catch (err) {
    console.error("Token verification failed", err.message);
    res.status(401).json({ error: "Invalid ID token" });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server listening on http://localhost:${PORT}`);
  console.log(`🐳 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📚 Swagger UI: http://localhost:${PORT}/api-docs`);
});
