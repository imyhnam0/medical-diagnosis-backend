import fetch from "node-fetch";
import { parseJsonResponse } from "../utils/parseJsonResponse.js";
import { db } from "../server.js";
import { GEMINI_API_KEY } from "../config/geminiConfig.js";

//429 에러시 재시도하도록
export async function callGeminiWithRetry(prompt, { retries = 3, baseDelayMs = 3000 } = {}) {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API 키가 설정되어 있지 않습니다.");
  }
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (response.status === 429 && attempt < retries) {
      const wait = baseDelayMs * Math.pow(2, attempt);
      console.warn(`⏳ Gemini 429 응답. ${wait}ms 후 재시도합니다. (시도 ${attempt + 1}/${retries + 1})`);
      await new Promise((resolve) => setTimeout(resolve, wait));
      continue;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Gemini API 오류: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  throw new Error("Gemini API 재시도가 모두 실패했습니다.");
}
// ✅ 위험 요인 분석 및 Firestore 검색
export async function analyzeRiskFactor(req, res) {
    try {
      const { riskFactorInput } = req.body;
      console.log("➡️ 요청 수신: POST /api/analyze/riskfactor", {
        riskFactorInput,
      });
  
      if (!riskFactorInput || riskFactorInput.trim() === "") {
        return res.status(400).json({ error: "입력값이 없습니다." });
      }
  
      const riskFactorMapping = [
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
  
      // 🔹 Gemini 프롬프트 구성
      const prompt = `
      당신은 의료 전문가입니다. 사용자의 문장에서 현재 앓고 있는 질병이나 위험 요인을 찾아주세요.
      
      규칙:
      1️⃣ 사용자의 문장에서 의학적으로 의미 있는 '질병명'이나 '위험 요인'을 모두 추출
      2️⃣ 아래 '위험 요인 매핑 리스트'에 존재하는 항목과 가장 가까운 표현으로 정규화
      3️⃣ 결과는 JSON 형식으로만, 설명 없이
      
      사용자 입력: "${riskFactorInput}"
      위험 요인 매핑 리스트: ${riskFactorMapping.join(", ")}
      
      출력 형식:
      {
        "matchedKeywords": ["키워드1", "키워드2"]
      }
      `;
  
      // 🔸 Gemini API 호출
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );
  
      if (!response.ok) {
        console.error("❌ Gemini 호출 실패:", response.status);
        return res.status(500).json({ error: "Gemini API 호출 실패" });
      }
  
      // 🔹 Gemini 응답 파싱
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const parsed = parseJsonResponse(text);
      const matched = (parsed.matchedKeywords || []).filter((k) =>
        riskFactorMapping.includes(k)
      );
  
      console.log("위험 요인 키워드:", matched);
  
      if (matched.length === 0) {
        return res.json({ matchedKeywords: [], diseases: [] });
      }
  
      // 🔹 Firestore 검색
      const diseases = [];
      for (const keyword of matched) {
        const snapshot = await db
          .collection("diseases_ko")
          .where("위험 요인", "array-contains", keyword)
          .get();
  
        snapshot.forEach((doc) => diseases.push({ id: doc.id, ...doc.data() }));
      }
  
      // 🔹 중복 제거
      const unique = [
        ...new Map(diseases.map((d) => [d["질환명"], d])).values(),
      ];
  
      // 🔹 로그 출력
      
      console.log("위험 요인 키워드:", matched, "개수:", matched.length);
      const conciseList = unique.map(d => ({
        id: d.id,
        riskFactors: d["위험 요인"]
      }));
      console.log("위험 요인(id & 요인):", conciseList, "개수:", conciseList.length);
  
      // ✅ 응답 반환
      return res.json({
        matchedKeywords: matched,
        diseases: unique,
      });
    } catch (error) {
      console.error("❌ 위험 요인 분석 오류:", error);
      return res.status(500).json({ error: "위험 요인 분석 실패" });
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

    const prompt = `
당신은 의료 전문가입니다. 다음 질병에 대해 간단하고 정확한 정보를 제공해주세요.

질병명: ${diseaseName}

다음 JSON 형식으로만 응답해주세요:
{
  "description": "질병에 대한 간단한 설명 (2줄 이내)",
  "prognosis": "예후 및 주의사항에 대한 설명 (3줄 이내)"
}

의료적 정확성을 유지하면서 일반인이 이해하기 쉽게 작성해주세요.
`;

    const data = await callGeminiWithRetry(prompt);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    // 🔹 JSON 파싱 (여유 처리)
    let parsed = parseJsonResponse(text);
    if (!parsed || typeof parsed !== "object") {
      try {
        parsed = JSON.parse(text);
      } catch (error) {
        console.warn("⚠️ Gemini 질병 정보 JSON 파싱 실패:", error.message);
        console.warn("📄 원본 응답 텍스트:", text);
        parsed = {
          description: "정보를 가져올 수 없습니다.",
          prognosis: "예후 정보를 가져올 수 없습니다.",
        };
      }
    }

    parsed.description =
      typeof parsed.description === "string" && parsed.description.trim() !== ""
        ? parsed.description.trim()
        : "정보를 가져올 수 없습니다.";
    parsed.prognosis =
      typeof parsed.prognosis === "string" && parsed.prognosis.trim() !== ""
        ? parsed.prognosis.trim()
        : "예후 정보를 가져올 수 없습니다.";

    console.log("✅ 질병 정보:", diseaseName, parsed);

    return res.json(parsed);
  } catch (error) {
    console.error("❌ 질병 정보 분석 오류:", error);
    return res.status(500).json({ error: "질병 정보 분석 실패" });
  }
}
