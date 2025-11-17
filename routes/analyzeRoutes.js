import express from "express";
import {
  getDiseaseInfo,
  getTopDiseases,
  getAllDiseases,
  resetDiagnosis,
} from "../services/geminiService.js";
import { analyzeAgeBmiGender } from "../services/age_bmi_gender.js";
import { analyzeDrinkingSmoking } from "../services/drinking_smoking.js";
import { analyzeJob } from "../services/Job.js";
import { analyzeExerciseStress } from "../services/exercise_stress.js";
import { analyzePastDisease } from "../services/PastDisease.js";
import { analyzeChestPain } from "../services/analzeChestPain.js";
import { analyzeSymptoms } from "../services/analysisSymtoms.js";
import { analyzeAggravation } from "../services/analyzeAggravation.js";
import { analyzeRiskFactor } from "../services/analyzeRiskFactor.js";

const router = express.Router();

router.post("/aggravation", analyzeAggravation);
router.post("/riskfactor", analyzeRiskFactor);
router.post("/chestpain", analyzeChestPain);
router.post("/symptoms", analyzeSymptoms);
router.post("/disease-info", getDiseaseInfo);
router.get("/top-diseases", getTopDiseases);
router.get("/all-diseases", getAllDiseases);
router.post("/reset-diagnosis", resetDiagnosis);
router.post("/age-bmi-gender", analyzeAgeBmiGender);
router.post("/drinking-smoking", analyzeDrinkingSmoking);
router.post("/job", analyzeJob);
router.post("/exercise-stress", analyzeExerciseStress);
router.post("/past-disease", analyzePastDisease);
export default router;
