// ✅ 운동/스트레스 기반 키워드 분석 (AI 기반 - 순차 질문 방식)
import { db } from "../server.js";
import { diseaseManager } from "./DiseaseDataManager.js";
import fetch from "node-fetch";
import { parseJsonResponse } from "../utils/parseJsonResponse.js";
import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL } from "../config/geminiConfig.js";
import { GEMINI_API_KEY } from "../config/geminiConfig.js";

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// 운동과 스트레스관련 키워드
const EXERCISE_STRESS_KEYWORDS = [
  "운동 습관","운동 부족","신체활동 부족",
  "격한 운동","불안 성향","생활 스트레스",
  "스트레스","불안","회피 행동","최근 운동",
  "직장 스트레스","정서적 스트레스","가족 스트레스",
  "가족 갈등","낮은 대처 능력","회복 탄력성 부족",
  "사회적 고립","학대","학대 경험",
  "실직","전쟁 경험","노숙",
];

export async function analyzeExerciseStress(req, res) {
  try {
    const { question, answer, questionIndex } = req.body;

    console.log("➡️ 요청 수신: POST /api/analyze/exercise_stress", {
      question,
      answer,
      questionIndex
    });

    if (question === undefined || answer === undefined || questionIndex === undefined) {
      return res.status(400).json({
        error: "필수 파라미터 누락 (question, answer, questionIndex 필요)"
      });
    }

    // 🔹 AI에게 보낼 프롬프트
    const systemPrompt = `
User will input their daily exercise and stress. Extract the keywords related to the exercise and stress.
Keywords are from ${EXERCISE_STRESS_KEYWORDS.join(", ")}. Select one or more keywords.
Extract all keywords related to the exercise and stress.
You can assume that the user's exercise and stress is related to the keywords.
Please extract all keywords related to the exercise and stress.
Please ONLY extract keywords from ${EXERCISE_STRESS_KEYWORDS.join(", ")}.
`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ parts: [{ text: answer }] }],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            keywords: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["keywords"],
        },
      },
    });

    console.log("🤖 AI 응답:", response.candidates?.[0]?.content?.parts?.[0]?.text);
    const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const { keywords = [] } = parseJsonResponse(rawText);

    // 유효한 키워드만 필터링 (EXERCISE_STRESS_KEYWORDS 목록에 있는 것만)
    const validKeywords = keywords.filter(kw => 
      EXERCISE_STRESS_KEYWORDS.includes(kw)
    );
    // 🔥 키워드 누적 저장
    validKeywords.forEach(kw => diseaseManager.addKeyword(kw));

    console.log("☑️ 누적된 키워드:", diseaseManager.getAllKeywords());

    // TODO: 질문 개수에 맞게 LAST_INDEX를 맞추세요
    const LAST_INDEX = 2; // 예: 세 번째(2번 index) 질문 끝나면 최종 처리
    if (questionIndex === LAST_INDEX) {
      const allKeywords = diseaseManager.getAllKeywords();
      console.log("🔥 최종 키워드:", allKeywords);

      for (const keyword of allKeywords) {
        const snapshot = await db
          .collection("diseases_ko")
          .where("사회적 이력", "array-contains", keyword)
          .get();

        snapshot.forEach(doc => {
          const diseaseName = doc.data()?.["질환명"];
          if (diseaseName) {
            diseaseManager.addScore(diseaseName, 1);
          }
        });
      }

      const rawScores = diseaseManager.getRawScores();
      console.log("질환별 rawScores:", rawScores);

      diseaseManager.clearKeywords(); // 🔥 Reset for next user
    }

    // 🔹 Flutter로 응답
    return res.json({
      keywords: validKeywords,
    });

  } catch (error) {
    console.error("❌ 운동/스트레스 분석 오류:", error);
    return res.status(500).json({ error: "분석 실패", details: error.message });
  }
}

