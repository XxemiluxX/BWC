// Reglas compartidas del catálogo de retos ecológicos de ECRA.
// El mismo cálculo se usa en la página pública y al aprobar evidencias.
import { CHALLENGES } from "./app.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
// 1 de enero de 2024 fue lunes: ancla estable para rotar el reto semanal.
const ANCHOR_MONDAY_UTC = Date.UTC(2024, 0, 1);

function pad(value) {
  return String(value).padStart(2, "0");
}

function mondayOfWeek(value = new Date()) {
  const source = value instanceof Date ? value : new Date(value);
  const validSource = Number.isNaN(source.getTime()) ? new Date() : source;
  const monday = new Date(validSource.getFullYear(), validSource.getMonth(), validSource.getDate());
  const daysSinceMonday = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - daysSinceMonday);
  return monday;
}

export function getWeeklyChallengeInfo(value = new Date()) {
  const weekStart = mondayOfWeek(value);
  const weekStartUTC = Date.UTC(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
  const weeksSinceAnchor = Math.floor((weekStartUTC - ANCHOR_MONDAY_UTC) / WEEK_MS);
  const index = ((weeksSinceAnchor % CHALLENGES.length) + CHALLENGES.length) % CHALLENGES.length;
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  return {
    challenge: CHALLENGES[index],
    weekStart,
    weekEnd,
    weekKey: `${weekStart.getFullYear()}-${pad(weekStart.getMonth() + 1)}-${pad(weekStart.getDate())}`
  };
}

export function getChallengeExperience(challenge, value = new Date()) {
  const baseByDifficulty = {
    Principiante: 10,
    Intermedio: 20,
    Avanzado: 30
  };
  const baseXp = baseByDifficulty[challenge?.difficulty] || 10;
  const weeklyInfo = getWeeklyChallengeInfo(value);
  const isWeekly = Boolean(challenge?.id && challenge.id === weeklyInfo.challenge.id);
  const multiplier = isWeekly ? 2 : 1;

  return {
    baseXp,
    xp: baseXp * multiplier,
    multiplier,
    isWeekly,
    weekKey: weeklyInfo.weekKey
  };
}

export function dateFromEvidence(value, fallback = new Date()) {
  const candidate = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(candidate.getTime()) ? fallback : candidate;
}
