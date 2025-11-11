import dotenv from "dotenv";
dotenv.config();

import fetch from "node-fetch";
import { parseJsonResponse } from "../utils/parseJsonResponse.js";
import { db } from "../server.js";


const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
console.log("GEMINI_API_KEY:", GEMINI_API_KEY);
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;




//429 에러시 재시도하도록
async function callGeminiWithRetry(prompt, { retries = 3, baseDelayMs = 3000 } = {}) {
  console.log("GEMINI_ENDPOINT:", GEMINI_API_KEY);
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
// ✅ 사회적 이력 분석
export async function analyzeSocialHistory(req, res) {
  try {
    const personalInfo = req.body;

    const socialInfo = {
      age: personalInfo.age?.toString() || "",
      bmi: personalInfo.bmi?.toString() || "",
      gender: personalInfo.gender || "",
      drinking: personalInfo.drinking || "",
      smoking: personalInfo.smoking || "",
      job: personalInfo.job || "",
      exercise: personalInfo.exercise || "",
    };

    const socialHistoryMapping = [
      "항암 치료 경험", "여행력", "음주", "흡연", "곰팡이 독소 노출", "간염 위험 인자",
      "50세 이상", "여성", "잦은 병원 방문", "안심 추구 행동", "사무직", "육체 노동", "불안 성향",
      "생활 스트레스", "스트레스", "불안", "회피 행동", "직장 스트레스", "잘못된 자세",
      "무거운 물건 들기", "직업적 노출", "열악한 주거환경", "위생 불량", "여행",
      "키 크고 마른 체형 남성", "최근 질환", "격한 운동", "사고", "운동 습관",
      "불량한 식습관", "운동 부족", "고지방 식이", "고지방 식습관", "코카인 사용", "좌식 생활",
      "고령", "면역저하", "바이오매스 노출", "장기간 부동", "호르몬 요법", "암 치료",
      "신경성 폭식증", "회복 탄력성 부족", "가족 스트레스", "신체활동 부족", "운동선수 활동",
      "건강검진 미흡", "햇빛 노출 부족", "팔을 많이 쓰는 직업", "수면 부족", "정서적 스트레스",
      "식습관", "찬 환경 노출", "뜨거운 음료 섭취", "비만", "야식", "가족 갈등",
      "낮은 대처 능력", "감염자 접촉", "감염 노출", "특별한 요인 없음", "야외 노동",
      "수분 부족", "전쟁 경험", "학대", "실직", "사회적 고립", "영양 불량", "늦은 출산",
      "심혈관 검진 부족", "부인과 병력", "호르몬 치료", "노숙", "알코올 중독", "학대 경험",
      "이차적 이득", "무거운 물건을 드는 직업", "알레르겐 노출", "간접흡연", "불법 약물 사용",
      "55세 이상", "가족력", "풍토지역 거주", "과밀한 생활", "허약 상태", "식욕억제제",
      "메탐페타민 사용", "최근 여행", "장거리 여행", "특별한 위험 요인 없음", "앉아 있는 직업"
    ];

    // 🔹 프롬프트 구성 (추론 강화 버전)
  const prompt = `
  당신은 의료 전문가로서 이력에서 **연관된 요인을 논리적으로 추론해 선택하는 AI**입니다.

  ⚙️ 분석 대상 (입력 데이터):
  ${JSON.stringify(socialInfo, null, 2)}

  📘 이력 리스트 (이 중에서만 선택 가능):
  ${socialHistoryMapping.join(", ")}

  1️⃣ 위 "이력 리스트"는 참고 가능한 선택지입니다.  
   그러나 당신은 의료 전문가로서, **사용자의 연령·성별·생활습관을 바탕으로 가장 합리적이고 상식적인 요인들을 스스로 판단**해야 합니다.  
   선택은 반드시 리스트 내 항목 중에서만 하되,  
   **직접적인 단서뿐 아니라 상식적·의학적 추론으로 연관될 수 있는 항목도 자유롭게 포함**하세요.

  2️⃣ 예를 들어:
   - 나이가 매우 높다면 → ["고령", "50세 이상", "55세 이상", "면역저하"]처럼 여러 연령 관련 요인을 포함할 수 있습니다.
   - 운동을 거의 하지 않는다면 → ["운동 부족", "신체활동 부족"]
   - 비만(BMI ≥ 30)이면 → ["비만", "고지방 식습관"]
   - “비흡연”처럼 부정 표현이 있으면 → 관련 요인은 제외합니다.

  📤 출력 형식 (이 형식 외 텍스트는 절대 포함하지 마세요):
  {
    "matchedKeywords": ["키워드1", "키워드2", ...]
  }
  `;


    const data = await callGeminiWithRetry(prompt);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = parseJsonResponse(text);
    const matched = Array.isArray(parsed.matchedKeywords) ? parsed.matchedKeywords : [];

    if (matched.length === 0) {
      console.log("사회적이력 키워드가 없습니다.");
      return res.json({ matchedKeywords: [], diseases: [] });
    }

    // 🔹 Firestore 검색 (함수 내부)
    const diseases = [];
    for (const keyword of matched) {
      const snapshot = await db
        .collection("diseases_ko")
        .where("사회적 이력", "array-contains", keyword)
        .get();
      snapshot.forEach((doc) => diseases.push({ id: doc.id, ...doc.data() }));
    }

    // 중복 제거
    const unique = [
      ...new Map(diseases.map((d) => [d["질환명"], d])).values(),
    ];

    console.log("사회적이력 키워드:", matched, "개수:", matched.length);
    // id와 사회적 이력만 추출해서 출력
    const conciseList = unique.map(d => ({
      id: d.id,
      socialHistory: d["사회적 이력"]
    }));
    console.log("사회적이력(id & 이력):", conciseList, "개수:", conciseList.length);

    return res.json({ matchedKeywords: matched, diseases: unique });
  } catch (error) {
    console.error("❌ 사회적 이력 분석 오류:", error);
    return res.status(500).json({ error: "사회적 이력 분석 실패" });
  }
}
// ✅ 과거 질환 분석
export async function analyzePastDiseases(req, res) {
  const { pastDiseasesInput } = req.body;

  const pastDiseaseMapping = [
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

  // 🔹 Gemini 프롬프트 구성
  const prompt = `
  당신은 의료 전문가로서 사용자의 과거 질환 이력에서 연관된 키워드를 찾는 AI입니다.

  규칙:
  1️⃣ 사용자 입력에서 언급된 질병, 증상, 상태를 모두 찾아내세요.
  2️⃣ 주어진 "과거 질환 이력 매핑" 리스트에서 사용자 입력과 연관이 있다고 생각하는 키워드들을 찾아주세요.
  3️⃣ 결과는 JSON 형태로 출력하세요.

  사용자 입력: "${pastDiseasesInput}"

  과거 질환 이력 매핑 리스트:
  ${pastDiseaseMapping.join(", ")}

  출력 형식:
  {
    "matchedKeywords": ["매칭된 키워드1", "매칭된 키워드2"]
  }
  `;

  try {
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

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = parseJsonResponse(text);
    const matched = parsed.matchedKeywords || [];

    if (matched.length === 0) {
      console.log("과거질환이력 키워드가 없습니다.");
      return res.json({ matchedKeywords: [], diseases: [] });
    }

    // 🔹 Firestore 검색 (함수 내부)
    const diseases = [];
    for (const keyword of matched) {
      const snapshot = await db
        .collection("diseases_ko")
        .where("과거 질환 이력", "array-contains", keyword)
        .get();
      snapshot.forEach((doc) => diseases.push({ id: doc.id, ...doc.data() }));
    }

    // 중복 제거
    const unique = [
      ...new Map(diseases.map((d) => [d["질환명"], d])).values(),
    ];

    // 키워드와 나온 질병들 log로 출력
    console.log("과거질환이력 키워드:", matched, "개수:", matched.length);
    console.log(
      "과거질환이력 질병 id, 과거 질환 이력 목록:",
      unique.map((d) => ({
        id: d.id,
        "과거 질환 이력": d["과거 질환 이력"],
      })),
      "개수:",
      unique.length
    );

    return res.json({ matchedKeywords: matched, diseases: unique });
  } catch (error) {
    console.error("❌ 과거 질환 분석 오류:", error);
    return res.status(500).json({ error: "과거 질환 분석 실패" });
  }
}
// ✅ 흉통인지 아닌지 분석 
export async function analyzeChestPain(req, res) {
  const { userInput } = req.body;

  if (!userInput || userInput.trim() === "") {
    return res.status(400).json({ error: "userInput이 비어 있습니다." });
  }

  const prompt = `
  당신은 의료 데이터 분석 AI입니다.  

  아래는 흉통(가슴 통증) 관련 증상 예시 문장들입니다.

  예시:
  가슴이 아파요
  가슴이 짓눌리는 느낌이에요
  가슴이 쿡쿡 쑤셔요
  가슴이 무거워요
  가슴이 조여요
  가슴이 터질 것 같아요
  가슴이 타는 것 같아요
  가슴이 찢어질 것 같아요
  가슴이 따가워요
  바늘로 찌르는 느낌이에요
  쥐어짜는 듯해요
  가슴이 화끈거려요
  가슴이 얼얼해요
  가슴이 벌어질 것 같아요
  가슴이 뜨거워요
  심장이 쿵쿵 뛰어요
  가슴이 벌렁거려요
  심장이 불규칙해요
  숨 쉴 때 가슴이 아파요
  기침하면 가슴이 아파요
  운동하고 나면 아파요
  스트레스 받으면 아파요
  식사 후에 아파요
  가슴이 조여서 숨이 안 쉬어져요
  가슴이 울렁거려요
  가슴이 답답해요
  심장이 멎을 것 같아요
  숨이 막혀요
  가슴이 무언가 걸린 것 같아요
  계단 오르면 가슴이 아파요
  가만히 있어도 아파요
  누우면 아파요
  앉아있기 힘들어요
  왼쪽 가슴이 아파요
  오른쪽 가슴이 아파요
  중앙이 아파요
  팔로 통증이 퍼져요
  턱까지 아파요
  등까지 아파요
  숨 쉴 때 통증이 심해져요
  심장 쪽이 욱신거려요
  기운이 없어요
  어지러워요
  토할 것 같아요
  메스꺼워요
  식은땀이 나요
  숨이 가빠요
  숨을 크게 쉬기 어려워요
  날카로운 통증이에요
  찌릿한 통증이에요
  화끈거려요
  심장이 덜컥 내려앉는 느낌이에요
  심장 박동이 느껴져요
  맥이 빨라요
  맥이 느려요
  피곤해요
  죽을 것 같아요
  생명 위협 느껴요
  병원 가야 할 것 같아요
  차가운 땀이 나요
  공기가 안 통해요
  한숨 쉬고 싶어요
  심장이 조여요
  계속 뭔가 불편해요
  불쾌감이 있어요
  움직이기 힘들어요
  숨이 차요
  눌리는 느낌이에요
  압박감이 있어요
  밤에 통증이 심해져요
  아침에 더 아파요
  몸을 구부리면 아파요
  긴장하면 아파요
  감기 후에 아파요
  깜짝 놀랄 만큼 아파요
  증상이 반복돼요
  통증이 오락가락해요
  약을 먹어도 안 나아요
  가슴이 먹먹해요
  가슴에 무언가 눌린 느낌
  가슴이 전기가 오는 것 같아요
  심장 부위에 통증이 있어요
  숨을 참고 있어야 해요
  가슴에 맥이 튀어요
  화나면 아파요
  무서울 때 가슴이 아파요
  불안하면 아파요
  식도가 아픈 것 같아요
  삼킬 때 아파요
  등 쪽으로 퍼지는 통증

  ---

  사용자가 입력한 문장이 위 예시들과 **의미적으로 유사한지** 판단하세요.  
  만약 흉통 관련이라면 **의학적으로 자연스러운 후속 질문을 제안**하세요. 
    - 예시:  
      - "가슴이 답답해요" → "가슴이 어떻게 답답한가요? 쥐어짜는 듯한가요, 눌리는 듯한가요?"  
      - "가슴이 아파요" → "통증은 언제 시작되었고, 얼마나 오래 지속되나요?"  
      - "가슴이 조여요" → "조일 때 숨쉬기가 힘든가요, 혹은 운동할 때 심해지나요?"
  
  다음 JSON 형식으로만 출력하세요:
  {
    "result": "TRUE",
    "similar": "<가장 유사한 예시 문장>",
    "followUpQuestion": "<사용자에게 던질 후속 질문>"
  }

  흉통과 무관하다면:
  {"result":"FALSE"}

  그 외의 말은 절대 하지 마세요.
  사용자 입력: "${userInput}"
  `;

  try {
    // ✅ Gemini API 호출
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

    // ✅ Flutter의 statusCode == 200 로직과 동일
    if (response.status === 200) {
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "{}";

      console.log("🤖 AI 응답:", text);

      const parsed = parseJsonResponse(text);
      if (parsed && typeof parsed === "object" && "result" in parsed) {
        console.log("📊 파싱된 JSON:", parsed);
        return res.json(parsed);
      }

      console.warn("⚠️ Gemini 응답 파싱 실패:", text);
      return res.json({ result: "FALSE" });
    } else {
      const errorText = await response.text();
      console.warn("⚠️ API Error:", errorText);
      return res.json({ result: "FALSE" });
    }
  } catch (error) {
    console.error("💥 흉통 분석 오류:", error);
    return res.status(500).json({ error: "서버 내부 오류" });
  }
}
// ✅ 증상 추출 API
export async function analyzeSymptoms(req, res) {
  try {
    const {
      question,
      answer,
      symptomCategories,
      previousSymptoms = [],
    } = req.body;

    const effectiveAnswer = (answer ?? "").trim();
    if (!effectiveAnswer) {
      return res.status(400).json({ error: "answer가 비어 있습니다." });
    }

    const effectiveQuestion = (question ?? req.body.currentQuestion ?? "")
      .toString()
      .trim();

    const allSymptoms = Object.values(symptomCategories || {}).flat();
    const history = Array.isArray(previousSymptoms)
      ? previousSymptoms.filter((s) => typeof s === "string" && s.trim().length > 0)
      : [];

    const prompt = `
당신은 환자를 상담하는 의학 전문의입니다.
아래 질문과 환자의 답변을 읽고, 의학적으로 의미 있는 증상을 모두 찾아 주세요.

🩺 현재 질문: "${effectiveQuestion}"
💬 환자 답변: "${effectiveAnswer}"
📁 지금까지 확보된 증상: ${history.length > 0 ? history.join(", ") : "없음"}

📚 참고 증상 리스트 (반드시 리스트에 있는 것만 선택해주세요):
${allSymptoms.join(", ")}

규칙:
1️⃣ 환자의 답변에서 추론 가능한 모든 증상을 JSON의 "matchedSymptoms" 배열에 담으세요. 
2️⃣ 이미 확보된 증상(history)은 포함하지 않습니다.
3️⃣ 증상명은 한국어로 간결하게 작성하세요. (예: "가슴 통증", "호흡곤란")
4️⃣ 환자가 입력한 답변을 보고 추가적인 질문을 "nextQuestion"에 의학적으로 자연스러운 한국어 질문을 작성하세요.
5️⃣ 추가 설명이나 마크다운 없이 아래 JSON 형식만 반환하세요.

출력 형식:
{
  "matchedSymptoms": ["증상1", "증상2"],
  "nextQuestion": "의학적으로 필요한 다음 질문 혹은 빈 문자열"
}
⚠️ 주의: 결과를 코드블록(\`\`\`json ... \`\`\`)으로 감싸지 마세요.
`;

    const data = await callGeminiWithRetry(prompt);
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "{}";

    const parsed = parseJsonResponse(text) || {};
    let matchedSymptoms = Array.isArray(parsed.matchedSymptoms)
      ? parsed.matchedSymptoms
      : [];

    // 모델이 규격을 지키지 않았을 때 대비
    if (matchedSymptoms.length === 0 && typeof text === "string") {
      const matchedBlock = text.match(/"matchedSymptoms"\s*:\s*\[([\s\S]*?)\]/);
      if (matchedBlock?.[1]) {
        matchedSymptoms = matchedBlock[1]
          .split(",")
          .map((s) => s.replace(/["\n\r]/g, "").trim())
          .filter((s) => s.length > 0);
      } else {
        matchedSymptoms = [];
      }
    }

    const uniqueSymptoms = [
      ...new Set(
        matchedSymptoms
          .map((s) => s.toString().trim())
          .filter((s) => s.length > 0)
      ),
    ];

    const nextQuestion =
      typeof parsed.nextQuestion === "string"
        ? parsed.nextQuestion.trim()
        : "";

    console.log("🩺 추출된 증상:", uniqueSymptoms);
    console.log("🧠 다음 질문:", nextQuestion);
    // Firestore 검색
    const diseases = [];
    for (const symptom of uniqueSymptoms) {
      const snapshot = await db
        .collection("diseases_ko")
        .where("증상", "array-contains", symptom)
        .get();

      snapshot.forEach((doc) => {
        diseases.push({ id: doc.id, ...doc.data() });
      });
    }
    // ✅ Firestore 중복 제거
    const uniqueDiseases = [
      ...new Map(diseases.map((d) => [d["질환명"], d])).values(),
    ];

    console.log("🧬 관련 질병 수:", uniqueDiseases.length);


    return res.json({
      matchedSymptoms: uniqueSymptoms,
      nextQuestion,
      diseases: uniqueDiseases,
    });
  } catch (error) {
    console.error("💥 analyzeSymptoms 오류:", error);
    return res.status(500).json({ error: "서버 내부 오류" });
  }
}  
// ✅ 악화 요인 분석 및 Firestore 검색
export async function analyzeAggravation(req, res) {
    try {
      const { aggravateDiseaseInput } = req.body;
      if (!aggravateDiseaseInput || aggravateDiseaseInput.trim() === "") {
        return res.status(400).json({ error: "입력값이 없습니다." });
      }
      const aggravateDiseaseMapping = [
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
        "누운 자세", "허리 신전", "회전", "보행", "기립"];
  
      // 🔹 Gemini 프롬프트 구성
      const prompt = `
      당신은 의료 전문가입니다. 사용자의 문장에서 흉통이 더 심해지는(악화되는) 상황 키워드를 찾아주세요.
      
      규칙:
      1️⃣ 사용자의 문장에서 의학적으로 의미 있는 '악화 요인'을 모두 추출
      2️⃣ 아래 '악화 요인 매핑 리스트'에 존재하는 항목과 가장 가까운 표현으로 정규화
      3️⃣ 결과는 JSON 형식으로만, 설명 없이
      
      사용자 입력: "${aggravateDiseaseInput}"
      악화 요인 매핑 리스트: ${aggravateDiseaseMapping.join(", ")}
      
      출력 형식:
      {
        "matchedKeywords": ["키워드1", "키워드2"]
      }
      `;
  
      // 🔸 Gemini 호출
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
  
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const parsed = parseJsonResponse(text);
      const matched = (parsed.matchedKeywords || []).filter((k) =>
        aggravateDiseaseMapping.includes(k)
      );
  
      if (matched.length === 0) {
        console.log("악화 요인 키워드가 없습니다.");
        return res.json({ matchedKeywords: [], diseases: [] });
      }
  
      // 🔹 Firestore 검색
      const diseases = [];
      for (const keyword of matched) {
        const snapshot = await db
          .collection("diseases_ko")
          .where("악화 요인", "array-contains", keyword)
          .get();
  
        snapshot.forEach((doc) =>
          diseases.push({ id: doc.id, ...doc.data() })
        );
      }
  
      // 중복 제거
      const unique = [
        ...new Map(diseases.map((d) => [d["질환명"], d])).values(),
      ];
  
      console.log("악화 요인 키워드:", matched, "개수:", matched.length);
      console.log("악화 요인 질병 목록:", unique, "개수:", unique.length);
  
      // ✅ 응답
      return res.json({
        matchedKeywords: matched,
        diseases: unique,
      });
    } catch (error) {
      console.error("❌ 악화 요인 분석 오류:", error);
      return res.status(500).json({ error: "악화 요인 분석 실패" });
    }
  }

// ✅ 위험 요인 분석 및 Firestore 검색
export async function analyzeRiskFactor(req, res) {
    try {
      const { riskFactorInput } = req.body;
  
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
      console.log("위험 요인 질병 목록:", unique, "개수:", unique.length);
  
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
