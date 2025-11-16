import { db } from "../server.js";

export async function searchDiseases(fieldName, keywords) {
  const result = [];

  for (const keyword of keywords) {
    const snapshot = await db
      .collection("diseases_ko")
      .where(fieldName, "array-contains", keyword)
      .get();

    snapshot.forEach((doc) =>
      result.push({ id: doc.id, ...doc.data() })
    );
  }

  // 중복 제거 (질환명 기준)
  const unique = [
    ...new Map(result.map((item) => [item["질환명"], item])).values(),
  ];

  return unique;
}
