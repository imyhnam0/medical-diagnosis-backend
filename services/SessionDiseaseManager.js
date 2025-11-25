// SessionDiseaseManager.js
// 세션별로 DiseaseDataManager 인스턴스를 관리하는 클래스
//설계도를 가져옴 
import { DiseaseDataManager } from "./DiseaseDataManager.js";

class SessionDiseaseManager {
  constructor() {
    // 세션 ID: { manager: DiseaseDataManager, lastUsed: timestamp }
    this.sessions = new Map();
    
    // 오래된 세션 정리 (30분 이상 사용되지 않은 세션 삭제)
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 30 * 60 * 1000); // 30분마다 정리
  }

  // 세션별 DiseaseDataManager 인스턴스 가져오기 (없으면 생성)
  getManager(sessionId) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        manager: new DiseaseDataManager(),
        lastUsed: Date.now()
      });
      console.log(`✅ 새로운 세션 생성: ${sessionId}`);
    } else {
      // 마지막 사용 시간 업데이트
      this.sessions.get(sessionId).lastUsed = Date.now();
    }
    return this.sessions.get(sessionId).manager;
  }

  // 세션 삭제
  deleteSession(sessionId) {
    if (this.sessions.has(sessionId)) {
      this.sessions.delete(sessionId);
      console.log(`🗑️ 세션 삭제: ${sessionId}`);
    }
  }

  // 오래된 세션 정리 (30분 이상 사용되지 않은 세션)
  cleanup() {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30분
    
    for (const [sessionId, data] of this.sessions.entries()) {
      if (now - data.lastUsed > maxAge) {
        this.sessions.delete(sessionId);
        console.log(`🧹 오래된 세션 정리: ${sessionId}`);
      }
    }
  }

  // 모든 세션 삭제 (테스트용)
  clearAll() {
    this.sessions.clear();
  }

  // 정리 작업 중지
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// 싱글톤 인스턴스 export
export const sessionDiseaseManager = new SessionDiseaseManager();

