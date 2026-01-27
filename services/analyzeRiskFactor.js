// ✅ 위험 인자(사회력) 기반 키워드 분석 (AI 기반 - 순차 질문 방식)
import { db } from "../server.js";
import { GEMINI_MODEL, generateContentWithFallback } from "../config/geminiConfig.js";

// 위험 인자(사회력) 전체 추출 가능한 키워드 목록 (통합)
const RISK_FACTOR_KEYWORDS = [
  "고용량 5-FU", "심독성 항암제", "당뇨", "담도 폐쇄", "B형/C형 간염", "간경변",
  "가족력", "알코올", "비알코올성 지방간질환", "고령", "PMR", "여성",
  "건강 공포", "과거 질환", "경추증", "추간판 탈출", "젊은 연령", "민감한 성격",
  "스트레스", "불안", "공황 발작", "잘못된 인체공학", "반복 동작", "과사용",
  "컨디션 저하", "흡연", "공기오염", "바이러스 감염", "면역결핍", "과거 감염",
  "풍토지역", "덜 익힌 고기", "폐질환", "기계환기", "대상포진", "격투기",
  "낙상", "육체 노동", "나쁜 자세", "담석", "감염", "비만",
  "급격한 체중 감소", "임신", "고혈압", "마판증후군", "엘러스-단로스증후군", "남성",
  "고지혈증", "50세 이상", "면역저하", "유전적 소인", "환경적 요인", "폐색전증 병력",
  "혈액응고장애", "암", "카테터 삽입", "방사선 치료", "심낭 손상", "구토",
  "알코올 중독", "이상지질혈증", "나이", "유전자 돌연변이", "젊은 나이", "햇빛 부족",
  "신경총 외상", "수술", "외상", "기능성 장애", "NSAID 사용", "헬리코박터 감염",
  "식도 운동장애", "GERD", "바렛 식도", "학대 경험", "연령", "바이러스",
  "자가면역질환", "심근경색 후", "카니 증후군", "관상동맥질환", "결합조직질환", "항응고제 치료",
  "고온 환경", "냉각 부족", "PTSD", "전쟁", "폭력", "정신질환",
  "만성질환", "염분 많은 식단", "BRCA 유전자", "에스트로겐 노출", "선천성 기형", "관상동맥 이상 가족력",
  "혈관 과민성", "자궁근종", "다낭성 난소증후군", "저혈당", "허약", "HLA 유전자",
  "자외선", "암 병력", "전환 성향", "아동기 외상", "퇴행성 디스크 질환", "알레르기",
  "도시 생활", "코카인", "젊은 남성", "유전", "HIV", "영양실조",
  "흡인", "문맥고혈압", "HIV 감염", "고령/소아", "혈전성향", "정맥혈전증 과거력",
  "부동", "방사선", "석면", "절제술 후", "선천성 이상", "심장 수술 병력",
  "흉부 수술", "척추 퇴행성 변화", "잘못된 자세", "노화", "척추측만증"
];

export async function analyzeRiskFactor(req, res) {
  try {
    const { question, answer, questionIndex } = req.body;

    console.log("➡️ 요청 수신: POST /api/analyze/risk-factor", {
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
User will input their risk factor. Extract the keywords related to the risk factor.
Keywords are from ${RISK_FACTOR_KEYWORDS.join(", ")}. Select one or more keywords.
Extract all keywords related to the risk factor.
You can assume that the user's risk factor is related to the keywords.
Please extract all keywords related to the risk factor.
Please ONLY extract keywords from ${RISK_FACTOR_KEYWORDS.join(", ")}.
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
    const { keywords = [] } = JSON.parse(rawText);

    // 유효한 키워드만 필터링 (RISK_FACTOR_KEYWORDS 목록에 있는 것만)
    const validKeywords = keywords.filter(kw =>
      RISK_FACTOR_KEYWORDS.includes(kw)
    );
    // 🔥 키워드 누적 저장
    const diseaseManager = req.diseaseManager;
    validKeywords.forEach(kw => diseaseManager.addKeyword(kw));

    console.log("☑️ 누적된 키워드:", diseaseManager.getAllKeywords());

    const LAST_INDEX = 0; // TODO: UI에 맞게 변경해야함
    if (questionIndex === LAST_INDEX) {
      const allKeywords = diseaseManager.getAllKeywords();
      console.log("🔥 최종 위험 인자 키워드:", allKeywords);

      for (const keyword of allKeywords) {
        const snapshot = await db
          .collection("diseases_ko")
          .where("위험 요인", "array-contains", keyword)
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
    console.error("❌ 위험 인자(사회력) 분석 오류:", error);
    return res.status(500).json({ error: "분석 실패", details: error.message });
  }
}
