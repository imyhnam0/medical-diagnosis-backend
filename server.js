// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import analyzeRoutes from "./routes/analyzeRoutes.js"; // ✅ 라우터 불러오기
import { saveDemoRequest } from "./services/demoRequestService.js"; // ✅ 데모 요청 서비스 불러오기
import { sessionDiseaseManager } from "./services/SessionDiseaseManager.js"; // ✅ 세션별 DiseaseManager


// ✅ 1. .env 로드
dotenv.config();

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

// 서버가 떠있는지 확인하기 위함
app.get("/", (req, res) => {
  console.log("📨 루트 경로 요청 수신");
  res.send("✅ Medical Backend Server Running!");
});

// ✅ 6. 세션별 DiseaseManager 미들웨어
app.use((req, res, next) => {
  // 세션 ID를 헤더에서 가져오거나 새로 생성
  // 프론트엔드에서 'X-Session-Id' 헤더로 세션 ID를 보낼 수 있음
  let sessionId = req.headers['x-session-id'];
  
  if (!sessionId) {
    // 세션 ID가 없으면 새로 생성
    sessionId = randomUUID();
    console.log(`🆕 새 세션 ID 생성: ${sessionId}`);
  }
  
  // req에 세션 ID와 diseaseManager 붙이기
  req.sessionId = sessionId;
  req.diseaseManager = sessionDiseaseManager.getManager(sessionId);
  
  next();
});

// ✅ 7. 분석 라우트 연결
app.use((req, res, next) => {
  console.log(`➡️ 요청 수신: ${req.method} ${req.originalUrl} [세션: ${req.sessionId}]`);
  next();
});
app.use("/api/analyze", analyzeRoutes);

// ✅ 데모 요청 라우트
app.post("/api/demo-request", saveDemoRequest);

// ✅ 8. 로컬서버 실행
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
});
// import serverless from "@vendia/serverless-express";
// export const handler = serverless({ app });
// ✅ 9. 예외 처리
process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled Rejection:", promise, "이유:", reason);
});
