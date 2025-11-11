export function parseJsonResponse(text) {
  if (typeof text !== "string") return null;

  try {
    let cleanText = text.trim();

    // ✅ 코드블록(```json ... ````) 완전 제거
    const fencedMatch = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fencedMatch) {
      cleanText = fencedMatch[1].trim();
    } else {
      cleanText = cleanText.replace(/```/g, "").trim();
    }

    // ✅ JSON 객체({ ... }) 전체를 줄바꿈 포함해서 정확히 추출
    // 이전: const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    const jsonMatch = cleanText.match(/\{[\s\S]*?\}/m); // <-- 수정된 부분

    if (jsonMatch) {
      cleanText = jsonMatch[0]
        .replace(/\n/g, "") // 개행 제거
        .replace(/\r/g, "")
        .replace(/\t/g, "")
        .trim();
    }

    // ✅ JSON 파싱
    return JSON.parse(cleanText);
  } catch (error) {
    console.error("❌ JSON 파싱 실패:", error.message);
    console.error("원본 텍스트:", text);
    return null;
  }
}
