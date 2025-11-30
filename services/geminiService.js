import { parseJsonResponse } from "../utils/parseJsonResponse.js";
import { db } from "../server.js";
import { GEMINI_MODEL, generateContentWithFallback } from "../config/geminiConfig.js";

// ✅ 점수 상위 질병 2개 반환
export async function getTopDiseases(req, res) {
  try {
    const diseaseManager = req.diseaseManager;
    const top = diseaseManager.getTopDiseases(2); // [{ diseaseName, score }]
    return res.json({
      top: top.map((t) => ({ diseaseName: t.diseaseName, score: t.score })),
    });
  } catch (error) {
    console.error("❌ 상위 질병 조회 오류:", error);
    return res.status(500).json({ error: "상위 질병 조회 실패" });
  }
}

// ✅ 진단 데이터 초기화
export async function resetDiagnosis(req, res) {
  try {
    const diseaseManager = req.diseaseManager;
    diseaseManager.reset();
    diseaseManager.clearKeywords();
    return res.json({ ok: true });
  } catch (error) {
    console.error("❌ 초기화 오류:", error);
    return res.status(500).json({ ok: false });
  }
}

// ✅ 전체 질병(점수 순 정렬) 반환
export async function getAllDiseases(req, res) {
  try {
    const diseaseManager = req.diseaseManager;
    const ranked = diseaseManager.getRankedScores(); // [{ diseaseName, score }, ...]
    return res.json({ all: ranked });
  } catch (error) {
    console.error("❌ 전체 질병 조회 오류:", error);
    return res.status(500).json({ error: "전체 질병 조회 실패" });
  }
}

// ✅ Gemini를 사용해 질병 정보 요약
export async function getDiseaseInfo(req, res) {
  try {
    const { diseaseName } = req.body;
    console.log("➡️ 요청 수신: POST /api/analyze/disease-info", { diseaseName });
    if (!diseaseName || diseaseName.trim() === "") {
      return res.status(400).json({ error: "질병명이 비어 있습니다." });
    }

    // 🔹 AI에게 보낼 프롬프트
    const systemPrompt = `
다음 질병명에 대해:
1. 질병에 대한 정보를 2줄로 간결하게 요약해 설명해 주세요.
2. 해당 질병의 예후 정보를 2줄로 요약해 설명해 주세요.
질병명: ${diseaseName}
아래와 같은 JSON 형식으로 답변해 주세요:
{
  "description": "[2줄 설명]",
  "prognosis": "[2줄 예후]"
}
`;

    // Gemini로 질병 정보 요약 응답 받기
    const response = await generateContentWithFallback({
      model: GEMINI_MODEL,
      contents: [{ parts: [{ text: diseaseName }] }],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            description: { type: "string" },
            prognosis: { type: "string" }
          },
          required: ["description", "prognosis"],
        },
      },
    });

    const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    console.log("🤖 Gemini Raw Response:", rawText);

    let parsed = parseJsonResponse(rawText);
    if (!parsed || typeof parsed !== "object") {
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = {};
      }
    }

    parsed.description ||= "정보를 가져올 수 없습니다.";
    parsed.prognosis ||= "예후 정보를 가져올 수 없습니다.";

    console.log("✅ 질병 정보:", diseaseName, parsed);
    return res.json(parsed);
  } catch (error) {
    console.error("❌ 질병 정보 분석 오류:", error);
    return res.status(500).json({ error: "질병 정보 분석 실패" });
  }
}
