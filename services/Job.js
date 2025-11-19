// ✅ 직업 기반 키워드 분석 (AI 기반 - 순차 질문 방식)
import { db } from "../server.js";
import { diseaseManager } from "./DiseaseDataManager.js";
import fetch from "node-fetch";
import { parseJsonResponse } from "../utils/parseJsonResponse.js";
import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL, GEMINI_API_KEY, generateContentWithFallback } from "../config/geminiConfig.js";


const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });


// 직업 관련 전체 추출 가능한 키워드 목록 (통합)
const JOB_KEYWORDS = [
    "사무직","육체 노동","무거운 물건 들기",
    "직업적 노출","야외 노동","무거운 물건을 드는 직업",
    "팔을 많이 쓰는 직업","앉아 있는 직업","운동선수 활동",
    "바이오매스 노출","감염 노출","감염자 접촉",
];

export async function analyzeJob(req, res) {
  try {
    const { question, answer, questionIndex } = req.body;

    console.log("➡️ 요청 수신: POST /api/analyze/job", {
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
User will input their job. Extract the keywords related to the job.
Keywords are from ${JOB_KEYWORDS.join(", ")}. Select one or more keywords.
Extract all keywords related to the job.
You can assume that the user's job is related to the keywords.
Please extract all keywords related to the job.
Please ONLY extract keywords from ${JOB_KEYWORDS.join(", ")}.
`;

const response = await generateContentWithFallback({
    model: GEMINI_MODEL,
    contents: [{ parts: [{ text: answer }] }],
    config: {
      // systemInstruction는 문자열로 줘도 됩니다 (공식 예제랑 동일하게)
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


    
    // 유효한 키워드만 필터링 (JOB_KEYWORDS 목록에 있는 것만)
    const validKeywords = keywords.filter(kw => 
      JOB_KEYWORDS.includes(kw)
    );
    // 🔥 키워드 누적 저장
    validKeywords.forEach(kw => diseaseManager.addKeyword(kw));

    console.log("☑️ 누적된 키워드:", diseaseManager.getAllKeywords());

    const LAST_INDEX = 1; // TODO: UI에 맞게 변경해야함
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
    console.error("❌ 직업 분석 오류:", error);
    return res.status(500).json({ error: "분석 실패", details: error.message });
  }
}

