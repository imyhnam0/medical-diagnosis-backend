// utils/parseJsonResponse.js

// JSON 파싱 함수
export function parseJsonResponse(text) {
    try {
      let cleanText = text;
      // 마크다운 코드블록 제거
      if (cleanText.includes("```json")) {
        cleanText = cleanText.replace(/```json/g, "").replace(/```/g, "").trim();
      }
  
      // JSON 객체만 추출 (정규식)
      const jsonPattern = /\{[\s\S]*\}/m;
      const match = cleanText.match(jsonPattern);
  
      if (match) {
        return JSON.parse(match[0]);
      }
  
      // 정규식으로 못 찾으면 전체 문자열 파싱 시도
      return JSON.parse(cleanText);
    } catch (e) {
      console.error("❌ JSON 파싱 실패:", e.message);
      console.error("원본 텍스트:", text);
      return { matchedKeywords: [], analysis: "JSON 파싱 실패" };
    }
  }
  