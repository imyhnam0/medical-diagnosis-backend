// ✅ 가슴 통증 기반 키워드 분석 (AI 기반 - 순차 질문 방식)
import { GEMINI_MODEL, generateContentWithFallback } from "../config/geminiConfig.js";

// 가슴 통증 관련 전체 추출 가능한 키워드 목록
const CHEST_PAIN_KEYWORDS = [
  "가슴이 아파요", "가슴이 짓눌리는 느낌이에요", "가슴이 쿡쿡 쑤셔요", "가슴이 무거워요", "가슴이 조여요",
  "가슴이 터질 것 같아요", "가슴이 타는 것 같아요", "가슴이 찢어질 것 같아요", "가슴이 따가워요", "바늘로 찌르는 느낌이에요",
  "쥐어짜는 듯해요", "가슴이 화끈거려요", "가슴이 얼얼해요", "가슴이 벌어질 것 같아요", "가슴이 뜨거워요",
  "심장이 쿵쿵 뛰어요", "가슴이 벌렁거려요", "심장이 불규칙해요", "숨 쉴 때 가슴이 아파요", "기침하면 가슴이 아파요",
  "운동하고 나면 아파요", "스트레스 받으면 아파요", "식사 후에 아파요", "가슴이 조여서 숨이 안 쉬어져요", "가슴이 울렁거려요",
  "가슴이 답답해요", "심장이 멎을 것 같아요", "숨이 막혀요", "가슴이 무언가 걸린 것 같아요", "계단 오르면 가슴이 아파요",
  "가만히 있어도 아파요", "누우면 아파요", "앉아있기 힘들어요", "왼쪽 가슴이 아파요", "오른쪽 가슴이 아파요",
  "중앙이 아파요", "팔로 통증이 퍼져요", "턱까지 아파요", "등까지 아파요", "숨 쉴 때 통증이 심해져요",
  "심장 쪽이 욱신거려요", "기운이 없어요", "어지러워요", "토할 것 같아요", "메스꺼워요",
  "식은땀이 나요", "숨이 가빠요", "숨을 크게 쉬기 어려워요", "날카로운 통증이에요", "찌릿한 통증이에요",
  "화끈거려요", "심장이 덜컥 내려앉는 느낌이에요", "심장 박동이 느껴져요", "맥이 빨라요", "맥이 느려요",
  "피곤해요", "죽을 것 같아요", "생명 위협 느껴요", "병원 가야 할 것 같아요", "차가운 땀이 나요",
  "공기가 안 통해요", "한숨 쉬고 싶어요", "심장이 조여요", "계속 뭔가 불편해요", "불쾌감이 있어요",
  "움직이기 힘들어요", "숨이 차요", "눌리는 느낌이에요", "압박감이 있어요", "밤에 통증이 심해져요",
  "아침에 더 아파요", "몸을 구부리면 아파요", "긴장하면 아파요", "감기 후에 아파요", "깜짝 놀랄 만큼 아파요",
  "증상이 반복돼요", "통증이 오락가락해요", "약을 먹어도 안 나아요", "가슴이 먹먹해요", "가슴에 무언가 눌린 느낌",
  "가슴이 전기가 오는 것 같아요", "심장 부위에 통증이 있어요", "숨을 참고 있어야 해요", "가슴에 맥이 튀어요", "화나면 아파요",
  "무서울 때 가슴이 아파요", "불안하면 아파요", "식도가 아픈 것 같아요", "삼킬 때 아파요", "등 쪽으로 퍼지는 통증"
];

export async function analyzeChestPain(req, res) {
  try {
    // 프론트에서 userInput 가져오기(변경)
    const { userInput } = req.body;

    console.log("➡️ 요청 수신: POST /api/analyze/chestpain", {
      userInput,
    });

    if (!userInput) {
      return res.status(400).json({
        error: "필수 파라미터 누락 (userInput 필요)"
      });
    }

    // 🔹 AI에게 보낼 프롬프트 - 키워드 판단, 유사 문장 return
    const systemPrompt = `
You are a chest pain symptom analyzer
user will input their chest pain description. Find out whether the user's answer is similar to the keywords.
Keywords are from ${CHEST_PAIN_KEYWORDS.join(", ")}. 
if the user's answer is similar to the keywords, return TRUE and the similar keyword and follow up question.
if the user's answer is not similar to the keywords, return FALSE.
if the user's answer is not related to chest pain, return FALSE.
Please ONLY return TRUE, FALSE, similar keyword and follow up question.
Please ONLY extract keywords from ${CHEST_PAIN_KEYWORDS.join(", ")}.
`;

    // AI 호출
    const response = await generateContentWithFallback({
      model: GEMINI_MODEL,
      contents: [{ parts: [{ text: userInput }] }],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            result: { type: "string" },
            similar: { type: "string" },
            followUpQuestion: { type: "string" },
          },
          required: ["result", "similar", "followUpQuestion"],
        },
      },
    });

    console.log("🤖 AI 응답:", response.candidates?.[0]?.content?.parts?.[0]?.text);
    const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const parsed = JSON.parse(rawText);

    return res.json(parsed);

  } catch (error) {
    console.error("❌ 가슴통증 분석 오류:", error);
    return res.status(500).json({ error: "분석 실패", details: error.message });
  }
}
