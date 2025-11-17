// DiseaseDataManager.js

class DiseaseDataManager {
    constructor() {
      // 질병명: 점수
      this.scoreMap = {};
      this.collectedKeywords = [];
    }
    addKeyword(keyword) {
      if (!this.collectedKeywords.includes(keyword)) {
        this.collectedKeywords.push(keyword);
      }
    }
  
    getAllKeywords() {
      return [...this.collectedKeywords];
    }
  
    clearKeywords() {
      this.collectedKeywords = [];
    }
  
    // 🔹 점수 누적
    addScore(diseaseName, value = 1) {
      if (!this.scoreMap[diseaseName]) {
        this.scoreMap[diseaseName] = 0;
      }
      this.scoreMap[diseaseName] += value;
    }
  
    // 🔹 점수 높은 순으로 정렬해서 반환
    getRankedScores() {
      return Object.entries(this.scoreMap)  // [ ["고혈압", 3], ["당뇨병", 1] ]
        .map(([name, score]) => ({ diseaseName: name, score }))
        .sort((a, b) => b.score - a.score);
    }
  
    // 🔹 가장 점수 높은 질병 2개 반환
    getTopDiseases(count = 2) {
      const ranked = this.getRankedScores();
      return ranked.slice(0, count);
    }
  
    // 🔹 점수 디버깅용
    getRawScores() {
      return this.scoreMap;
    }
  
    // 🔹 초기화
    reset() {
      this.scoreMap = {};
    }
  }
  
  // 싱글톤 객체로 export
  export const diseaseManager = new DiseaseDataManager();
  