// ✅ 나이, BMI, 성별 기반 키워드 분석
import { db } from "../server.js";
import { diseaseManager } from "./DiseaseDataManager.js";

export async function analyzeAgeBmiGender(req, res) {
  try {
    const { age, bmi, gender, height } = req.body;
    console.log("➡️ 요청 수신: POST /api/analyze/age-bmi-gender", {
      age,
      bmi,
      gender,
      height,
    });

    const matchedKeywords = [];

    // 🔸 연령 체크
    const ageNum = parseFloat(age);
    if (!isNaN(ageNum)) {
      if (ageNum >= 65) {
        matchedKeywords.push("고령");
        matchedKeywords.push("55세 이상");
        matchedKeywords.push("50세 이상");
      } else if (ageNum >= 55) {
        matchedKeywords.push("55세 이상");
        matchedKeywords.push("50세 이상");
      } else if (ageNum >= 50) {
        matchedKeywords.push("50세 이상");
      }
    }

    // 🔸 BMI 체크
    const bmiNum = parseFloat(bmi);
    if (!isNaN(bmiNum)) {
      if (bmiNum >= 30) {
        matchedKeywords.push("비만");
      }
    }

    // 🔸 키 크고 마른 남성 체크
    const heightNum = parseFloat(height);
    const genderStr = String(gender || "").toLowerCase().trim();
    
    // 여성일 때 "여성" 키워드 추가
    if (
      genderStr === "여성"
    ) {
      matchedKeywords.push("여성");
    }
    if (
      genderStr === "남성"
    ) {
      if (
        !isNaN(heightNum) &&
        heightNum >= 180 &&
        !isNaN(bmiNum) &&
        (bmiNum <= 20)
      ) {
        matchedKeywords.push("키 크고 마른 체형 남성");
      }
    }

    // 중복 제거
    const uniqueKeywords = [...new Set(matchedKeywords)];
    console.log("🔍 추출된 키워드:", uniqueKeywords);

    // 🔹 Firestore 검색 + DiseaseDataManager에 저장
    for (const keyword of uniqueKeywords) {
      const snapshot = await db
        .collection("diseases_ko")
        .where("사회적 이력", "array-contains", keyword)
        .get();

      snapshot.forEach((doc) => {
        const data = doc.data();
        const diseaseName = data["질환명"];

        if (!diseaseName) return;

        // 키워드 1개 매칭될 때마다 점수 1 추가
        diseaseManager.addScore(diseaseName, 1);
      });
    }
    
    console.log("📊 점수 분포:", diseaseManager.getRawScores());

    return res.json({
      matchedKeywords: uniqueKeywords,
    });
  } catch (error) {
    console.error("❌ 나이/BMI/성별 분석 오류:", error);
    return res.status(500).json({ error: "나이/BMI/성별 분석 실패" });
  }
}

