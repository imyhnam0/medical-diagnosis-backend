// ✅ 흉통 악화 요인 분석 페이지 (analzeAggravaion)
import { db } from "../server.js";
import { diseaseManager } from "./DiseaseDataManager.js";
import fetch from "node-fetch";
import { parseJsonResponse } from "../utils/parseJsonResponse.js";
import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL, GEMINI_API_KEY } from "../config/geminiConfig.js";

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// 흉통 악화 관련 전체 추출 가능한 키워드 목록
const AGGRAVATION_KEYWORDS = [
    "5-FU 주입", "고용량 투여", "간담도 감염", "면역저하", "종양 성장", "피막 팽창",
    "염분 섭취", "체액 저류", "추위", "고혈압", "염증", "건강 관련 미디어", "질병 신호",
    "목 움직임", "자세", "스트레스", "군중", "특정 상황", "특정 음식", "밀폐 공간",
    "활동", "압통점 압박", "과사용", "긴장", "차가운 공기", "대기오염", "흡연",
    "감염", "찬 공기", "유충 이동", "면역 반응", "운동", "양압환기", "외상",
    "호흡", "몸 비틀기", "압박", "움직임", "깊은 흡기", "기름진 음식", "고지방 식사",
    "음주", "무거운 물건 들기", "탈수", "빈맥성 부정맥", "접촉", "약물 중단",
    "반복적 색전", "고지대", "최근 방사선 치료", "눕기", "구토", "내시경", "성과 압박",
    "대인 갈등", "정서적 스트레스", "혈관확장제", "햇빛 부족", "영양 불량",
    "팔 들어올리기", "과로", "NSAIDs", "공복", "찬 음료", "음식 삼킴", "고형식 섭취",
    "과식", "심리적 스트레스", "바이러스 감염", "자가면역질환", "바로 누움", "깊은 호흡",
    "기침", "체위 변화", "과도한 수분 섭취", "약물 불순응", "부정맥", "심낭삼출",
    "항응고제 사용", "고온 환경", "격렬한 활동", "외상 기억", "큰 소음", "부정적 생활 사건",
    "고립", "카페인", "고령", "직접적 종양 침범", "휴식", "새벽", "생리", "호르몬 변화",
    "한랭 노출", "바람", "움직임 제한", "햇빛", "골 전이", "외상 신호", "정서적 갈등",
    "허리 하중", "알레르겐", "코카인 사용", "기계적 하중", "밀집된 환경", "흡인",
    "임신", "추운 날씨", "장기 침상", "수술", "암", "종양 진행", "체액 과부하",
    "누운 자세", "허리 신전", "회전", "보행", "기립"
];

// 흉통 악화 요인 분석 메인 함수
export async function analyzeAggravation(req, res) {
  try {
    const { question, answer, questionIndex } = req.body;

    console.log("➡️ 요청 수신: POST /api/analyze/aggravation", {
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
User will input situations that aggravate chest pain. Extract the aggravation keywords.
Keywords are from ${AGGRAVATION_KEYWORDS.join(", ")}. Select one or more keywords.
Extract all keywords related to aggravation factors only.
Please ONLY extract keywords from ${AGGRAVATION_KEYWORDS.join(", ")}.
`;

const response = await ai.models.generateContent({
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


    
    // 유효한 키워드만 필터링 (AGGRAVATION_KEYWORDS 목록에 있는 것만)
    const validKeywords = keywords.filter(kw => 
      AGGRAVATION_KEYWORDS.includes(kw)
    );
    // 🔥 키워드 누적 저장
    validKeywords.forEach(kw => diseaseManager.addKeyword(kw));

    console.log("☑️ 누적된 키워드:", diseaseManager.getAllKeywords());

    const LAST_INDEX = 2; // TODO: UI에 맞게 변경해야함
    if (questionIndex === LAST_INDEX) {
      const allKeywords = diseaseManager.getAllKeywords();
      console.log("🔥 최종 키워드:", allKeywords);

    // Firestore에서 해당 키워드로 질환 검색
    for (const keyword of allKeywords) {
      const snapshot = await db
        .collection("diseases_ko")
        .where("악화 요인", "array-contains", keyword)
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
    console.error("❌ 흉통 악화 요인 분석 오류:", error);
    return res.status(500).json({ error: "분석 실패", details: error.message });
  }
}
