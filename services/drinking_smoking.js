// ✅ 음주/흡연 기반 키워드 분석 (AI 기반 - 순차 질문 방식)
import { db } from "../server.js";
import { GEMINI_MODEL, generateContentWithFallback } from "../config/geminiConfig.js";

// 음주/흡연 관련 전체 추출 가능한 키워드 목록 (통합)
const DRINKING_KEYWORDS = [
  "음주", "알코올 중독"
];
const SMOKING_KEYWORDS = [
  "흡연", "간접흡연"
];


export async function analyzeDrinkingSmoking(req, res) {
  try {
    const { question, answer, questionIndex } = req.body;

    console.log("➡️ 요청 수신: POST /api/analyze/drinking-smoking", {
      question,
      answer,
      questionIndex
    });

    if (question === undefined || answer === undefined || questionIndex === undefined) {
      return res.status(400).json({
        error: "필수 파라미터 누락 (question, answer, questionIndex 필요)"
      });
    }

    // 질문 index별로 맞는 프롬프트 및 키워드/판단
    let systemPrompt = "";
    let filterList = [];
    if (questionIndex === 0) {
      // Drinking question: "How often do you usually drink alcohol?"
      systemPrompt = `
This is an answer to the question: "How often do you usually drink alcohol? (e.g. how many times a week, how much at a time, etc)"
Read the answer carefully and, if there is an indication that the person drinks (consumes alcohol) or is related to alcohol, extract all relevant drinking-related keywords (such as ["음주"], ["음주", "알코올 중독"]) from the keyword list below.
If the person states that they do not drink at all, or gives an unrelated answer (such as "I don't drink," "I quit drinking a long time ago," etc), return an empty array ([]).

Drinking-related keywords: ${DRINKING_KEYWORDS.join(", ")}
`;
      filterList = DRINKING_KEYWORDS;
    } else if (questionIndex === 1) {
      // Smoking question: "Do you smoke? Or is there anyone around you who smokes?"
      systemPrompt = `
This is an answer to the question: "Do you smoke? Or is there anyone around you who smokes?"
If the answer confirms smoking by self or by people around them (including second-hand smoke), extract all relevant smoking-related keywords (such as ["흡연"], ["간접흡연"], ["흡연", "간접흡연"]) from the list below and return them as { "keywords": [ ... ] }.
If it is stated that the person does not smoke at all and is not exposed to second-hand smoke, return { "keywords": [] }.

Smoking-related keywords: ${SMOKING_KEYWORDS.join(", ")}
`;
      filterList = SMOKING_KEYWORDS;
    }

    const response = await generateContentWithFallback({
      model: GEMINI_MODEL,
      contents: [
        {
          parts: [
            {
              text: answer
            }
          ]
        }
      ],
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
    const { keywords = [] } = JSON.parse(rawText);

    // 유효한 키워드만 필터
    const validKeywords = keywords.filter(kw => filterList.includes(kw));

    // 🔥 키워드 누적 저장
    const diseaseManager = req.diseaseManager;
    validKeywords.forEach(kw => diseaseManager.addKeyword(kw));

    console.log("☑️ 누적된 키워드:", diseaseManager.getAllKeywords());

    const LAST_INDEX = 1; // 질문 개수 2개: 0(음주), 1(흡연)
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

      diseaseManager.clearKeywords(); // 🔥 다음 사용자 위해 리셋
    }

    // 🔹 Flutter로 응답
    return res.json({
      keywords: validKeywords,
    });

  } catch (error) {
    console.error("❌ 음주/흡연 분석 오류:", error);
    return res.status(500).json({ error: "분석 실패", details: error.message });
  }
}
