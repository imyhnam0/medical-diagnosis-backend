import { db } from "../server.js";
import { diseaseManager } from "./DiseaseDataManager.js";
import fetch from "node-fetch";
import { parseJsonResponse } from "../utils/parseJsonResponse.js";
import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL } from "../config/geminiConfig.js";
import { GEMINI_API_KEY } from "../config/geminiConfig.js";

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// 증상 관련 전체 추출 가능한 키워드 목록 (예시)
const SYMPTOM_KEYWORDS = [
  "흉통", "협심증 유사 흉통", "갑작스러운 흉통", "설명되지 않는 흉통", "안정 시 흉통", "작열성 흉통", "흉골 뒤 압박감",
  "흉부 불편감", "흉부 압박감", "흉벽 통증", "흉벽 불편감", "늑골 압통", "방사통", "방사성 흉통",
  "호흡곤란", "가벼운 호흡곤란", "운동 시 호흡곤란", "야간 발작성 호흡곤란", "기침", "가래", "객혈", "마른기침", 
  "흉막성 통증", "천명음", "발열", "야간 발한", "피로", "전신 권태", "체중 감소", "두근거림", "실신", 
  "어지럼증", "다리 부종", "오심", "구토", "설사", "소화기 증상", "속쓰림", "역류", "연하곤란", 
  "상복부 불편감", "명치 통증", "복부 불편감", "복부 팽만", "목 통증", "등 통증", "등통증", "등/허리 통증",
  "관절통", "국소 근육통", "국소 통증", "근육통", "골통", "이질통", "작열통", "압통", "움직임 제한", 
  "근력 약화", "팔 약화", "감각 이상", "저림", "전신 통증", "두개골/흉부 변형", "뻣뻣함", "통증",
  "발진", "작열감", "가려움", "유방 멍울", "멍", "시각 증상", "수면 문제", "건강 불안", 
  "신체 증상에 대한 집착", "걱정", "플래시백", "골반 통증", "생리 문제", "우상복부 통증", "측두부 통증", 
  "설명되지 않는 다발성 증상", "추위 불내성"
];

export async function analyzeSymptoms(req, res) {
  try {
    const { question, answer, questionIndex } = req.body;

    console.log("➡️ 요청 수신: POST /api/analyze/symptoms", {
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
You are a chest pain symptom analyzer.
User will answer question about their symptoms. Extract the keywords related to the symptoms.
Keywords are from ${SYMPTOM_KEYWORDS.join(", ")}. Select one or more keywords.
Extract all keywords related to the symptoms.
You can assume that the user's symptoms is related to the keywords.
Please extract all keywords related to the symptoms.
Please ONLY extract keywords from ${SYMPTOM_KEYWORDS.join(", ")}.
`;
const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ parts: [{ text: JSON.stringify({ question, answer }) }] }],
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
          }
        },
        required: ["keywords"],
      },
    },
  });
  

    console.log("🤖 AI 응답:", response.candidates?.[0]?.content?.parts?.[0]?.text);
    const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const { keywords = [] } = parseJsonResponse(rawText);

    // 유효한 키워드만 필터링 (SYMPTOM_KEYWORDS 목록에 있는 것만)
    const validKeywords = keywords.filter(kw =>
      SYMPTOM_KEYWORDS.includes(kw)
    );
    // 🔥 키워드 누적 저장
    validKeywords.forEach(kw => diseaseManager.addKeyword(kw));

    console.log("☑️ 누적된 증상 키워드:", diseaseManager.getAllKeywords());

    // (증상 기반 결과 계산 로직이 필요한 경우, 여기에 추가)
    // 예시: 증상 키워드 기반 질환 도출 등

    // 🔹 응답 반환
    return res.json({
      keywords: validKeywords,
    });
  } catch (error) {
    console.error("❌ 증상 분석 오류:", error);
    return res.status(500).json({ error: "분석 실패", details: error.message });
  }
}
