// ✅ 운동/스트레스 기반 키워드 분석 (AI 기반 - 순차 질문 방식)
import { db } from "../server.js";
import { diseaseManager } from "./DiseaseDataManager.js";
import fetch from "node-fetch";
import { parseJsonResponse } from "../utils/parseJsonResponse.js";
import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL, GEMINI_API_KEY, generateContentWithFallback } from "../config/geminiConfig.js";

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// 운동과 스트레스관련 키워드
const EXERCISE_KEYWORDS = [
  "운동 습관","운동 부족","신체활동 부족",
  "격한 운동"
];

const STRESS_KEYWORDS = [
  "불안 성향","생활 스트레스","스트레스","불안","회피 행동",
  "직장 스트레스","정서적 스트레스","가족 스트레스","가족 갈등",
  "낮은 대처 능력","회복 탄력성 부족","사회적 고립","학대","학대 경험",
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

    // 각 질문 index별로 키워드 분리저장 로직
    let systemPrompt = "";
    let keywordList = [];
    let filterList = [];

    if (questionIndex === 0) {
      // 운동 관련 프롬프트
      // Question 1 (exercise): Prompt to extract only relevant exercise keywords
      systemPrompt = `
The following answer is to the question: "How much do you usually exercise or do physical activity in your daily life?"
Carefully read the answer and extract all keywords that best match the exercise-related keywords listed below, based on the report.
Return ONLY the relevant keywords from the following list, as many as appropriate, in a JSON array called "keywords".

Exercise keywords: ${EXERCISE_KEYWORDS.join(", ")}

Format: ["keyword1", "keyword2"]
Return only a JSON array as output.
`;
      keywordList = EXERCISE_KEYWORDS;
      filterList = EXERCISE_KEYWORDS;
    } else if (questionIndex === 1) {
      // Question 2 (stress experience): Extract relevant stress-related keywords
      systemPrompt = `
The following answer is to the question: "Have you had any stressful experiences recently? Could you describe them in detail?"
Analyze the response and, based on the content, select all keywords that correspond to the stress-related keywords below.
Return only a JSON array of all relevant keywords matching the list below. Multiple selections are possible.

Stress keywords: ${STRESS_KEYWORDS.join(", ")}

Format: ["keyword1", "keyword2"]
Return only a JSON array as output.
`;
      keywordList = STRESS_KEYWORDS;
      filterList = STRESS_KEYWORDS;
    }
    const response = await generateContentWithFallback({
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

    // 질문별 필터 리스트로만 필터
    const validKeywords = keywords.filter(kw => 
      filterList.includes(kw)
    );
    // 누적 저장 (합치기 위해 계속 저장)
    validKeywords.forEach(kw => diseaseManager.addKeyword(kw));

    console.log("☑️ 누적된 키워드:", diseaseManager.getAllKeywords());

    // 마지막 질문 index에서만 전체 대상 처리
    const LAST_INDEX = 0; // 예: 세 번째(2번 index) 질문 끝나면 최종 처리
    if (questionIndex === LAST_INDEX) {
      // 누적된 운동+스트레스 모두 합쳐진 키워드!
      const allKeywords = diseaseManager.getAllKeywords();
      console.log("🔥 최종 키워드(운동+스트레스 합친):", allKeywords);

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

      diseaseManager.clearKeywords(); // 🔥 다음 사용자 위해 리셋
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
