// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import analyzeRoutes from "./routes/analyzeRoutes.js"; // ✅ 라우터 불러오기


// ✅ 1. .env 로드
dotenv.config();
console.log("✅ GEMINI_API_KEY:", process.env.GEMINI_API_KEY);

// ✅ 2. Express 앱 설정"type": "module"
const app = express();
app.use(cors());
app.use(express.json());

// ✅ 3. Firebase Admin 초기화
try {
  const serviceAccountPath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);

  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`❌ 서비스 계정 파일이 존재하지 않습니다: ${serviceAccountPath}`);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log("✅ Firebase Admin 초기화 성공");
} catch (error) {
  console.error("💥 Firebase 초기화 실패:", error);
  process.exit(1); // 실행 중단
}

// ✅ 4. Firestore 인스턴스 및 Gemini API 키
export const db = admin.firestore();
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ✅ 5. 기본 라우트
app.get("/", (req, res) => {
  console.log("📨 루트 경로 요청 수신");
  res.send("✅ Medical Backend Server Running!");
});

// ✅ 6. 분석 라우트 연결
app.use((req, res, next) => {
  console.log(`➡️ 요청 수신: ${req.method} ${req.originalUrl}`);
  next();
});
app.use("/api/analyze", analyzeRoutes);

// ✅ 7. 서버 실행
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
});

// ✅ 8. 예외 처리
process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled Rejection:", promise, "이유:", reason);
});
