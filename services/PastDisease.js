// ✅ 과거 질환 이력 기반 키워드 분석 (AI 기반 - 순차 질문 방식)
import { db } from "../server.js";
import { GEMINI_MODEL, generateContentWithFallback } from "../config/geminiConfig.js";

// 과거 질환 이력 기반 전체 추출 가능한 키워드 목록
const PAST_DISEASE_KEYWORDS = [
  "암", "항암 치료", "담도질환", "최근 위장관 감염", "B형/C형 간염", "알코올성 간질환", "만성 간염",
  "알코올 중독", "다발성 근육통", "정신과 병력", "과잉 진료 경험", "경추 디스크 질환",
  "이전 공황 발작", "기능성 위장관 증상", "불안장애", "반복적 긴장", "손상", "최근 운동", "바이러스 감염",
  "반복적인 호흡기 감염", "COPD", "반복 감염", "소아 폐렴", "날음식 섭취", "풍토지역 여행", "천식",
  "기흉 병력", "흉부 외상", "대상포진 후 신경통", "최근 과격한 운동", "외상", "담석", "이전 담도 산통",
  "담석증", "비만", "만성 고혈압", "결합조직질환", "이엽성 대동맥판", "동맥류", "선천성 이엽성 판막",
  "류머티즘 열", "고지혈증", "고혈압", "수두", "면역저하", "대상포진", "RA", "가족력", "만성 기관지염",
  "흡연", "폐색전증", "심부정맥혈전증", "혈전성향", "유방암/폐암/림프종 방사선 치료", "위장관 시술",
  "범불안장애", "당뇨", "협심증", "가족력 (HCM, 급사, 부정맥)", "골연화증", "저칼슘혈증",
  "방사선 치료", "우울증", "만성 피로 증후군", "기능성 위장장애", "헬리코박터 감염", "NSAID 사용",
  "GERD", "불안", "바렛 식도", "만성 불안", "가족 스트레스", "최근 바이러스 감염", "자가면역질환",
  "심근경색 후 증후군", "색전증 병력", "심장종양 가족력", "관상동맥질환", "심근경색", "판막질환",
  "심낭염", "심장수술", "열 노출", "탈수", "심각한 외상 경험", "주요 우울 삽화", "식도열공 탈장",
  "위축성 위염", "BRCA 유전자 변이", "호르몬 노출", "선천성 심장질환", "급사 가족력", "혈관연축 성향",
  "자궁내막증", "자궁근종", "야외 노출", "영양실조", "악성 종양", "최근 암 치료", "정신과 질환",
  "선천성 척추 기형", "소아기 천식", "아토피", "알레르기 비염", "약물중독", "다른 부위의 파제트병",
  "잠복결핵", "HIV", "밀접 접촉", "장기간 흡연", "폐렴", "흡인", "구강 위생 불량", "선천성 심질환",
  "최근 상기도 감염", "만성 폐질환", "최근 수술", "폐 결절", "심방세동 고주파 절제술", "폐정맥 폐쇄",
  "호흡기 감염", "결핵", "추간판 질환", "척추 퇴행성 질환"
];

// 과거 질환 이력 분석 함수
export async function analyzePastDisease(req, res) {
  try {
    const { question, answer, questionIndex } = req.body;

    console.log("➡️ 요청 수신: POST /api/analyze/past-disease", {
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
User will input their past diseases. Extract the keywords related to the past diseases.
Keywords are from ${PAST_DISEASE_KEYWORDS.join(", ")}. Select one or more keywords.
Extract all keywords related to the past diseases.
You can assume that the user's past diseases is related to the keywords.
Please extract all keywords related to the past diseases.
Please ONLY extract keywords from ${PAST_DISEASE_KEYWORDS.join(", ")}.
`;

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
    const { keywords = [] } = JSON.parse(rawText);

    // 유효한 키워드만 필터링 (PAST_DISEASE_KEYWORDS 목록에 있는 것만)
    const validKeywords = keywords.filter(kw => PAST_DISEASE_KEYWORDS.includes(kw));
    // 🔥 키워드 누적 저장
    const diseaseManager = req.diseaseManager;
    validKeywords.forEach(kw => diseaseManager.addKeyword(kw));

    console.log("☑️ 누적된 (과거 질환) 키워드:", diseaseManager.getAllKeywords());

    const LAST_INDEX = 0; // TODO: UI에 맞게 변경
    if (questionIndex === LAST_INDEX) {
      const allKeywords = diseaseManager.getAllKeywords();
      console.log("🔥 최종 과거 질환 키워드:", allKeywords);

      for (const keyword of allKeywords) {
        const snapshot = await db
          .collection("diseases_ko")
          .where("과거 질환 이력", "array-contains", keyword)
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
    console.error("❌ 과거 질환 분석 오류:", error);
    return res.status(500).json({ error: "분석 실패", details: error.message });
  }
}
