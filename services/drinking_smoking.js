// ✅ 음주/흡연 기반 키워드 분석 (AI 기반 - 순차 질문 방식)
import { db } from "../server.js";
import { diseaseManager } from "./DiseaseDataManager.js";
import fetch from "node-fetch";
import { parseJsonResponse } from "../utils/parseJsonResponse.js";
// ⭐ analyzeDrinkingSmoking — 질문/답변 기반 단일 키워드 판단 API
export async function analyzeDrinkingSmoking(req, res) {
    try {
      const { question, answer, targetKeyword } = req.body;
  
      console.log("➡️ 요청 수신: POST /api/analyze/drinking-smoking", {
        question,
        answer,
        targetKeyword
      });
  
      if (!question || !answer || !targetKeyword) {
        return res.status(400).json({
          error: "필수 파라미터 누락 (question, answer, targetKeyword 필요)"
        });
      }
  
      const analysisPrompt = `
Analyze the following question and the user's answer to determine whether the user engages in the behavior mentioned in the question.

Question: "${question}"
Answer: "${answer}"

Behavior types:
- If the question is about drinking, determine whether the user drinks alcohol.
- If the question is about smoking, determine whether the user smokes.

Return format (JSON only):
{
  "hasKeyword": true/false
}

Rules:
- "hasKeyword": true → The user's answer clearly indicates they drink/smoke.
- "hasKeyword": false → The user's answer indicates they do not, or the answer is unclear or ambiguous.

Treat the following expressions as NOT engaging in the behavior ("hasKeyword": false):
- “I quit”
- “I stopped”
- “I haven’t smoked/drank for over a year”
- “I stopped a long time ago”
- “I don’t smoke/drink anymore”
`;

  
      // 🔹 AI 호출
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            contents: [{ parts: [{ text: analysisPrompt }] }]
          })
        }
      ).then(r => r.json());
  
      const analysisText = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const analysis = parseJsonResponse(analysisText);
  
      const hasKeyword = analysis?.hasKeyword === true;
  
      console.log("🤖 AI 분석:", {
        targetKeyword,
        hasKeyword,
      });
  
      // 🔹 질병 점수 처리 (hasKeyword == true일 때만)
      if (hasKeyword) {
        const snapshot = await db
          .collection("diseases_ko")
          .where("사회적 이력", "array-contains", targetKeyword)
          .get();
  
        snapshot.forEach(doc => {
          const data = doc.data();
          diseaseManager.addScore(data["질환명"], 1);
        });
        // getRawScores()는 점수 합계를 가져오는 메서드이므로, forEach 안이 아닌 바깥에서 호출해야 값을 정상적으로 출력할 수 있습니다.
        const rawScores = diseaseManager.getRawScores();
        console.log("질환별 rawScores:", rawScores);
      }
  
      // 🔹 Flutter로 응답
      return res.json({
        keyword: targetKeyword,
        hasKeyword,
      });
  
    } catch (error) {
      console.error("❌ 음주/흡연 분석 오류:", error);
      return res.status(500).json({ error: "분석 실패", details: error.message });
    }
  }
  