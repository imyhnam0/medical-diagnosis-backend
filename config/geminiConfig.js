import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

export const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
export const GEMINI_API_KEY_SECOND = process.env.GEMINI_API_KEY_SECOND;
export const GEMINI_API_KEY_THIRD = process.env.GEMINI_API_KEY_THIRD;

export const GEMINI_MODEL = "gemini-2.0-flash";

/**
 * Gemini API 호출 시 첫 번째 키 실패 시 두 번째 키로 재시도하는 헬퍼 함수
 * @param {Object} params - generateContent에 전달할 파라미터
 * @returns {Promise} - API 응답
 */
export async function generateContentWithFallback(params) {
  const apiKeys = [GEMINI_API_KEY, GEMINI_API_KEY_SECOND, GEMINI_API_KEY_THIRD].filter(Boolean);
  
  if (apiKeys.length === 0) {
    throw new Error("Gemini API 키가 설정되어 있지 않습니다.");
  }

  let lastError = null;

  for (let i = 0; i < apiKeys.length; i++) {
    try {
      const ai = new GoogleGenAI({ apiKey: apiKeys[i] });
      const response = await ai.models.generateContent(params);
      return response;
    } catch (error) {
      lastError = error;
      console.warn(`⚠️ Gemini API 키 ${i + 1}번째 시도 실패:`, error.message);
      if (i < apiKeys.length - 1) {
        console.log(`🔄 ${i + 2}번째 API 키로 재시도합니다...`);
      }
    }
  }

  // 모든 키 실패 시 마지막 에러를 throw
  throw lastError || new Error("Gemini API 호출이 모두 실패했습니다.");
}
