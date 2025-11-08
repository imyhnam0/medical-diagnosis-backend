import express from "express";
import {
  analyzePastDiseases,
  analyzeSocialHistory,
  analyzeAggravation,
  analyzeRiskFactor,
  analyzeChestPain,
  analyzeSymptoms,
  getDiseaseInfo,
} from "../services/geminiService.js";

const router = express.Router();

router.post("/past-diseases", analyzePastDiseases);
router.post("/social-history", analyzeSocialHistory);
router.post("/aggravation", analyzeAggravation);
router.post("/riskfactor", analyzeRiskFactor);
router.post("/chestpain", analyzeChestPain);
router.post("/symptoms", analyzeSymptoms);
router.post("/disease-info", getDiseaseInfo);
export default router;
