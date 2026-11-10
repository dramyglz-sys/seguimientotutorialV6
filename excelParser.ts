import * as XLSX from 'xlsx';
import {
  AcademicUnit,
  CutComparisonResult,
  DateDDMMYY,
  HistoricalCutStep,
  InsigniaType,
  ProcessedStudent,
  SCORMResource,
  StudentAcademicRecord,
  StudentEvaluationIssue,
  TutorialResolution,
  TutorialResolutionType,
  TutorialState,
} from '../types';
import { generatePersonalizedMessage, getInterventionDetails, getStudentFirstName } from './messages';
import { inferInsignia } from './insignia';

/**
 * Validates and parses DDMMYY sheet name into a real Date object with optional cut number.
 * Supports:
 * - "131026" -> 13/10/2026, cut 1
 * - "131026-1", "131026 - 1" -> 13/10/2026, cut 1
 * - "131026-2", "131026 - 2", "131026_2" -> 13/10/2026, cut 2
 * - "131026-3", "131026 - 3", "131026_3" -> 13/10/2026, cut 3
 * - Higher cut numbers: "131026-4", etc.
 *
 * Rejects invalid dates (e.g. 321026, 310226) and invalid cut suffixes (e.g. 131026-A, 131026-0, 131026-2.5, 131026-ABC).
 */
export function parseDDMMYY(sheetName: string): DateDDMMYY | null {
  const trimmed = sheetName.trim();
  // Must start with exactly 6 digits, optionally followed by a separator (- or _) and digits
  const match = trimmed.match(/^(\d{6})(.*)$/);
  if (!match) {
    return null;
  }

  const dateDigits = match[1];
  const suffix = match[2];

  let cutNumber = 1;
  if (suffix !== undefined && suffix !== '') {
    // Suffix must strictly be: optional whitespace, followed by '-' or '_', optional whitespace, followed by 1 or more digits
    const suffixMatch = suffix.match(/^\s*[-_]\s*(\d+)$/);
    if (!suffixMatch) {
      // Suffix was present but had letters, decimals, or invalid characters (e.g. -A, -2.5, -ABC)
      return null;
    }
    const parsedCut = parseInt(suffixMatch[1], 10);
    // Cut number must be a strictly positive integer (> 0, rejecting e.g. -0)
    if (isNaN(parsedCut) || parsedCut <= 0) {
      return null;
    }
    cutNumber = parsedCut;
  }

  const day = parseInt(dateDigits.substring(0, 2), 10);
  const month = parseInt(dateDigits.substring(2, 4), 10);
  const year2Digits = parseInt(dateDigits.substring(4, 6), 10);

  if (month < 1 || month > 12) {
    return null;
  }

  // 2000s era
  const fullYear = 2000 + year2Digits;

  // Validate exact days in that month/year using real calendar days
  const daysInMonth = new Date(fullYear, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return null;
  }

  // Set hours to 12:00:00 to avoid any timezone/DST shift issues
  const dateObj = new Date(fullYear, month - 1, day, 12, 0, 0);

  const formattedDay = String(day).padStart(2, '0');
  const formattedMonth = String(month).padStart(2, '0');
  const formatted = `${formattedDay}/${formattedMonth}/${fullYear}`;

  // Chronological sort key: YYYYMMDD_XXXXX
  const sortKey = `${fullYear}${formattedMonth}${formattedDay}_${String(cutNumber).padStart(5, '0')}`;

  const displayLabel = `${formatted} · Corte ${cutNumber}`;

  return {
    raw: trimmed,
    dateDigits,
    day,
    month,
    year: fullYear,
    date: dateObj,
    formatted,
    cutNumber,
    sortKey,
    displayLabel,
  };
}

/**
 * Calculates the difference in calendar days between two dates.
 */
export function calculateDaysBetween(d1: Date, d2: Date): number {
  const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.round(Math.abs((utc2 - utc1) / (1000 * 60 * 60 * 24)));
}

/**
 * Score context options for normalization
 */
export interface ScoreContext {
  formatted?: string;
  formatPattern?: string;
  isPercentageColumn?: boolean;
  isExplicitScale100?: boolean;
  header?: string;
  favorableCriterion?: boolean;
}

/**
 * Centralized numerical score normalizer.
 * Accepts numbers or strings, strips '%', removes whitespace, handles commas as decimals,
 * normalizes decimal proportions (e.g. 0.90 -> 90, 0.85 -> 85, 0.9333 -> 93.33),
 * handles percentage cell formats and proportions where 1 represents 100%,
 * and distinguishes a real score of 0 from pending/unattempted cells ('-', empty, null).
 * In ambiguous cases, applies the favorable criterion so a student is never mistakenly failed.
 */
export function normalizeScore(value: unknown, context?: ScoreContext): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    if (isNaN(value)) return null;
    if (value === 0) return 0;

    // Decimal proportion handling: e.g. 0.90 -> 90, 0.85 -> 85, 0.9333 -> 93.33
    if (value > 0 && value < 1) {
      return Number((value * 100).toFixed(2));
    }

    // Value is 1 (or 1.0)
    if (value === 1) {
      const isPercent =
        context?.isPercentageColumn ||
        (Boolean(context?.formatPattern && context.formatPattern.includes('%'))) ||
        (Boolean(context?.formatted && context.formatted.includes('%')));

      if (isPercent) {
        return 100;
      }

      if (context?.isExplicitScale100) {
        return 1;
      }

      // Favorable criterion: In LMS evaluation/quiz column, 1 point vs 100% (or proportion 1.0)
      // Apply favorable criterion unless explicitly specified otherwise
      if (context?.favorableCriterion !== false) {
        return 100;
      }
      return 1;
    }

    return value;
  }

  let s = String(value).trim();
  if (
    s === '' ||
    s === '-' ||
    s === '—' ||
    s === '–' ||
    s.toLowerCase() === 'n/a' ||
    s.toLowerCase() === 'null' ||
    s.toLowerCase() === 'undefined' ||
    s.toLowerCase() === 'no' ||
    s.toLowerCase() === 'nan'
  ) {
    return null;
  }

  // Real zero checks: "0", "0.0", "0%", "0.00", "0,0"
  if (s === '0' || s === '0%' || s === '0.0' || s === '0.00' || s === '0,0') {
    return 0;
  }

  const hadPercent = s.includes('%');
  // Strip percentage signs and extra characters
  s = s.replace(/%/g, '').trim();
  // Replace comma with dot
  s = s.replace(',', '.');
  const parsed = parseFloat(s);
  if (isNaN(parsed)) return null;
  if (parsed === 0) return 0;

  // If original string had '%', parsed is already on 0-100 scale (e.g. "100%" -> 100, "93.33%" -> 93.33, "1%" -> 1)
  if (hadPercent) {
    return parsed;
  }

  // Decimal proportion handling without '%': e.g. "0.90", "0.85", "0.9333" -> 90, 85, 93.33
  if (parsed > 0 && parsed < 1) {
    return Number((parsed * 100).toFixed(2));
  }

  // Parsed is 1 without explicit '%'
  if (parsed === 1) {
    const isPercent =
      context?.isPercentageColumn ||
      (Boolean(context?.formatPattern && context.formatPattern.includes('%'))) ||
      (Boolean(context?.formatted && context.formatted.includes('%')));

    if (isPercent) {
      return 100;
    }

    if (context?.isExplicitScale100) {
      return 1;
    }

    // Favorable criterion in ambiguous cases
    if (context?.favorableCriterion !== false) {
      return 100;
    }
    return 1;
  }

  return parsed;
}

export const normalizeGrade = normalizeScore;

/**
 * Normaliza el identificador académico compuesto:
 * - "M2-U1" -> "U_M2-U1"
 * - "M1-U1" -> "U_M1-U1"
 * - "U7" -> "U7"
 * - "7" -> "U7"
 * Conserva la distinción entre unidades de distintos módulos (U_M1-U1 vs U_M2-U1).
 */
export function formatAcademicUnitIdentifier(
  unitKey?: string,
  unitNumber?: number,
  moduleNumber?: number
): string {
  if (unitKey) {
    const trimmed = String(unitKey).trim();
    if (trimmed.startsWith('U_')) return trimmed;
    // Composite "M<mod>-U<unit>" or "M<mod> U<unit>"
    if (trimmed.match(/^M\d+[\s_-]*U\d+$/i)) {
      const clean = trimmed.toUpperCase().replace(/\s+/g, '-').replace(/_+/g, '-');
      return `U_${clean}`;
    }
    // "U<n>" -> "U<n>"
    if (trimmed.match(/^U\d+$/i)) {
      return trimmed.toUpperCase();
    }
    // Raw number "7" -> "U7"
    if (trimmed.match(/^\d+$/)) {
      return `U${trimmed}`;
    }
    return `U_${trimmed}`;
  }
  if (moduleNumber !== undefined && moduleNumber > 0) {
    return `U_M${moduleNumber}-U${unitNumber || 1}`;
  }
  return `U${unitNumber || 1}`;
}

/**
 * REGLA DEFINITIVA: Comprueba si existe una calificación numérica real y válida en una evaluación o tarea.
 * Retorna true ÚNICAMENTE cuando el valor es numérico (ej. 100, 93.33, 80, 75, 0.90, 0).
 * Importante: 0 es una calificación real y válida.
 * Retorna false para '-', '—', '–', '', null, undefined, 'n/a', NaN, etc.
 */
export function hasValidNumericGrade(value: unknown): boolean {
  if (
    value === null ||
    value === undefined ||
    value === '' ||
    value === '-' ||
    value === '—' ||
    value === '–'
  ) {
    return false;
  }

  if (typeof value === 'number') {
    return !isNaN(value);
  }

  const normalized = String(value)
    .replace(/%/g, '')
    .trim();

  if (
    normalized === '' ||
    normalized === '-' ||
    normalized === '—' ||
    normalized === '–' ||
    normalized.toLowerCase() === 'n/a' ||
    normalized.toLowerCase() === 'null' ||
    normalized.toLowerCase() === 'undefined' ||
    normalized.toLowerCase() === 'no' ||
    normalized.toLowerCase() === 'nan'
  ) {
    return false;
  }

  const replaced = normalized.includes(',') && !normalized.includes('.')
    ? normalized.replace(',', '.')
    : normalized;

  const n = Number(replaced);
  return Number.isFinite(n);
}

export const hasValidUnitEvaluation = hasValidNumericGrade;

/**
 * Centralized SCORM progress detection.
 * Interprets 1, "1", and definitive completion strings as evidence of activity.
 * SCORM value 1 indicates completion, NEVER a grade of 1/100.
 */
export function hasScormProgress(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const s = String(value).trim();
  if (s === '' || s === '-' || s === '—' || s === '0' || s.toLowerCase() === 'no' || s.toLowerCase() === 'n/a') {
    return false;
  }
  if (s === '1') return true;

  const lower = s.toLowerCase();
  if (
    lower === 'completado' ||
    lower === 'completo' ||
    lower === 'terminado' ||
    lower === 'hecho' ||
    lower === 'aprobado' ||
    lower === 'si' ||
    lower === 'sí' ||
    lower === 'finalizado'
  ) {
    return true;
  }

  const num = parseFloat(s.replace(',', '.'));
  return !isNaN(num) && num >= 1;
}

/**
 * Checks if the student has a registered Evaluación Inicial.
 */
export function hasInitialEvaluation(record: StudentAcademicRecord): boolean {
  if (record.evaluacionInicial === null || record.evaluacionInicial === undefined) {
    return false;
  }
  const s = String(record.evaluacionInicial).trim();
  return (
    s !== '' &&
    s !== '-' &&
    s !== '—' &&
    s !== '–' &&
    s.toLowerCase() !== 'n/a' &&
    s.toLowerCase() !== 'null' &&
    s.toLowerCase() !== 'undefined' &&
    s.toLowerCase() !== 'no'
  );
}

/**
 * Evaluates if the student has ANY evidence of activity in the course.
 * The Evaluación Inicial is an integral part of hasAnyCourseActivity.
 * If hasAnyCourseActivity is false -> ROJO.
 * If hasAnyCourseActivity is true -> CAN NEVER BE ROJO.
 */
export function hasAnyCourseActivity(record: StudentAcademicRecord): boolean {
  // 1. Evaluación Inicial
  if (hasInitialEvaluation(record)) {
    return true;
  }

  // 2. Any SCORM progress
  const hasAnyScorm = Object.values(record.scormProgress).some(Boolean);
  if (hasAnyScorm) {
    return true;
  }

  // 3. Any Task submitted or scored
  if (record.taskScores) {
    const hasAnyTask = Object.values(record.taskScores).some((val) => hasValidUnitEvaluation(val));
    if (hasAnyTask) {
      return true;
    }
  }

  // 4. Any Unit Evaluation with valid numerical score
  const hasAnyUnitEval = Object.values(record.unitEvaluations).some((val) => hasValidUnitEvaluation(val));
  if (hasAnyUnitEval) {
    return true;
  }

  // 5. Final Evaluation with score or attempt
  if (record.evaluacionFinalScore !== null || hasValidUnitEvaluation(record.evaluacionFinal)) {
    return true;
  }

  // 6. Total Categoria with score or attempt
  if (record.totalCategoriaScore !== null && record.totalCategoriaScore > 0) {
    return true;
  }
  if (hasValidUnitEvaluation(record.totalCategoria)) {
    return true;
  }

  return false;
}

/**
 * REGLA DEFINITIVA PARA 🔵 AZUL — TERMINÓ:
 * Únicamente cuando en el corte actual se cumplan simultáneamente:
 * Evaluación Final >= 80 Y Total_categoría >= 80.
 * En cursos TUTORIZADOS, todas las unidades (evaluaciones y tareas) deben estar además aprobadas.
 */
export function isCourseCompleted(
  record: StudentAcademicRecord,
  units?: AcademicUnit[],
  courseType?: import('../types').CourseType
): boolean {
  const efScore = record.evaluacionFinalScore;
  const tcScore = record.totalCategoriaScore;

  if (efScore === null || tcScore === null) {
    return false;
  }

  if (efScore < 80 || tcScore < 80) {
    return false;
  }

  // In TUTORIZADO: check that every academic unit is completed
  if (courseType === 'TUTORIZADO' && units && units.length > 0) {
    for (const unit of units) {
      if (!isUnitCompleted(record, unit, courseType)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * REGLA DEFINITIVA DE “UNIDAD COMPLETADA”:
 * En SEMITUTORIZADO:
 *   Una unidad se considera completada ÚNICAMENTE cuando la columna correspondiente a la
 *   EVALUACIÓN DE ESA UNIDAD contiene una CALIFICACIÓN NUMÉRICA REAL Y VÁLIDA.
 * En TUTORIZADO:
 *   Una unidad se considera completada ÚNICAMENTE cuando la EVALUACIÓN DE LA UNIDAD es >= 80
 *   Y TODAS las tareas requeridas de esa unidad están aprobadas (>= 80).
 */
export function isUnitCompleted(
  record: StudentAcademicRecord,
  unit: AcademicUnit,
  courseType?: import('../types').CourseType
): boolean {
  const evalVal =
    record.unitEvaluations[unit.unitKey || ''] ??
    record.unitEvaluations[unit.unitLabel || ''] ??
    record.unitEvaluations[unit.unitNumber];
  const evalValid = hasValidNumericGrade(evalVal);
  const evalScore = normalizeScore(evalVal);

  if (courseType === 'TUTORIZADO') {
    // Evaluation must be valid and >= 80
    if (!evalValid || evalScore === null || evalScore < 80) {
      return false;
    }
    // All tasks in this unit must be approved (>= 80)
    if (unit.tasks && unit.tasks.length > 0) {
      for (const task of unit.tasks) {
        const taskVal =
          record.taskScoresNormalized?.[task.id] ??
          record.taskScoresNormalized?.[task.header] ??
          record.taskScoresNormalized?.[task.unitKey] ??
          record.taskScores?.[task.id] ??
          record.taskScores?.[task.header];
        const taskScore = typeof taskVal === 'number' ? taskVal : normalizeScore(taskVal);
        if (taskScore === null || taskScore < 80) {
          return false;
        }
      }
    }
    return true;
  }

  // SEMITUTORIZADO: valid numeric grade in unit evaluation and >= 80
  return evalValid && evalScore !== null && evalScore >= 80;
}

/**
 * REGLA DEFINITIVA: Retorna la última unidad completada.
 */
export function getHighestCompletedUnit(
  record: StudentAcademicRecord | null | undefined,
  units?: AcademicUnit[],
  courseType?: import('../types').CourseType
): number {
  if (!record || !record.unitEvaluations) return 0;
  let highest = 0;

  if (units && units.length > 0) {
    for (const unit of units) {
      if (isUnitCompleted(record, unit, courseType)) {
        highest = Math.max(highest, unit.unitNumber);
      }
    }
  } else {
    for (const [uStr, evalVal] of Object.entries(record.unitEvaluations)) {
      const uNum = parseInt(uStr, 10);
      if (!isNaN(uNum) && hasValidNumericGrade(evalVal)) {
        highest = Math.max(highest, uNum);
      }
    }
  }

  return highest;
}

/**
 * Retorna el número total de unidades completadas.
 */
export function getCompletedUnitsCount(
  record: StudentAcademicRecord | null | undefined,
  units?: AcademicUnit[],
  courseType?: import('../types').CourseType
): number {
  if (!record || !record.unitEvaluations) return 0;
  let count = 0;

  if (units && units.length > 0) {
    for (const unit of units) {
      if (isUnitCompleted(record, unit, courseType)) {
        count += 1;
      }
    }
  } else {
    for (const [, evalVal] of Object.entries(record.unitEvaluations)) {
      if (hasValidNumericGrade(evalVal)) {
        count += 1;
      }
    }
  }

  return count;
}

/**
 * Calculates completed units info with composite keys.
 */
export function getCompletedUnitsInfo(
  record: StudentAcademicRecord,
  units: AcademicUnit[],
  courseType?: import('../types').CourseType
): { count: number; highestCompletedUnit: number; highestCompletedUnitKey: string } {
  const count = getCompletedUnitsCount(record, units, courseType);
  const highestCompletedUnit = getHighestCompletedUnit(record, units, courseType);
  
  let highestCompletedUnitKey = '';
  if (units && units.length > 0) {
    for (let i = units.length - 1; i >= 0; i--) {
      if (isUnitCompleted(record, units[i], courseType)) {
        highestCompletedUnitKey = units[i].unitKey || units[i].unitLabel;
        break;
      }
    }
  }

  return { count, highestCompletedUnit, highestCompletedUnitKey };
}

/**
 * Identifies all evaluation issues (score < 80) in unit evaluations, tasks, and Evaluacion Final.
 * Excludes Evaluacion Inicial.
 * ONLY includes evaluations/tasks where a real valid numeric score < 80 exists.
 * Does NOT include '-' or unattempted activities.
 */
export function getFailedUnitEvaluations(
  record: StudentAcademicRecord,
  units?: AcademicUnit[]
): StudentEvaluationIssue[] {
  const issues: StudentEvaluationIssue[] = [];

  if (units && units.length > 0) {
    units.forEach((unit) => {
      // Check unit evaluation
      const evalVal =
        record.unitEvaluations[unit.unitKey || ''] ??
        record.unitEvaluations[unit.unitLabel || ''] ??
        record.unitEvaluations[unit.unitNumber];
      const numScore = normalizeScore(evalVal);
      if (numScore !== null && numScore < 80) {
        const fullUnitId = formatAcademicUnitIdentifier(unit.unitKey, unit.unitNumber, unit.moduleNumber);
        issues.push({
          unitNumber: unit.unitNumber,
          moduleNumber: unit.moduleNumber,
          unitKey: unit.unitKey || unit.unitLabel,
          formattedIdentifier: fullUnitId,
          activityName: `Evaluación ${fullUnitId}`,
          score: numScore,
          type: 'unit',
        });
      }

      // Check tasks for this unit
      if (unit.tasks && unit.tasks.length > 0) {
        unit.tasks.forEach((task) => {
          const taskVal =
            record.taskScoresNormalized?.[task.id] ??
            record.taskScoresNormalized?.[task.header] ??
            record.taskScoresNormalized?.[task.unitKey] ??
            record.taskScores?.[task.id] ??
            record.taskScores?.[task.header];
          const taskScore = typeof taskVal === 'number' ? taskVal : normalizeScore(taskVal);
          if (taskScore !== null && taskScore < 80) {
            const fullUnitId = formatAcademicUnitIdentifier(unit.unitKey, unit.unitNumber, unit.moduleNumber);
            issues.push({
              unitNumber: unit.unitNumber,
              moduleNumber: unit.moduleNumber,
              unitKey: unit.unitKey || unit.unitLabel,
              formattedIdentifier: fullUnitId,
              activityName: task.name || `Tarea ${fullUnitId}`,
              score: taskScore,
              type: 'task',
            });
          }
        });
      }
    });
  } else {
    // Fallback if units not provided
    Object.entries(record.unitEvaluations).forEach(([unitStr, score]) => {
      const uNum = parseInt(unitStr, 10);
      const numScore = normalizeScore(score);
      if (numScore !== null && numScore < 80) {
        const fullUnitId = formatAcademicUnitIdentifier(unitStr, isNaN(uNum) ? undefined : uNum);
        issues.push({
          unitNumber: isNaN(uNum) ? 0 : uNum,
          unitKey: unitStr,
          formattedIdentifier: fullUnitId,
          activityName: `Evaluación ${fullUnitId}`,
          score: numScore,
          type: 'unit',
        });
      }
    });

    if (record.taskScores) {
      Object.entries(record.taskScores).forEach(([tKey, score]) => {
        const numScore = normalizeScore(score);
        if (numScore !== null && numScore < 80) {
          const fullUnitId = formatAcademicUnitIdentifier(tKey);
          issues.push({
            unitNumber: 0,
            formattedIdentifier: fullUnitId,
            activityName: `Tarea ${fullUnitId}`,
            score: numScore,
            type: 'task',
          });
        }
      });
    }
  }

  // Include Evaluación Final if attempted with score < 80 (Evaluación Inicial is never included)
  const efScore =
    record.evaluacionFinalScore !== null && record.evaluacionFinalScore !== undefined
      ? record.evaluacionFinalScore
      : normalizeScore(record.evaluacionFinal);
  if (efScore !== null && efScore < 80) {
    issues.push({ unitNumber: 0, activityName: 'Evaluación Final', formattedIdentifier: 'Evaluación Final', score: efScore, type: 'final' });
  }

  return issues;
}

export type UnitAcademicState = 'NEGRO' | 'VERDE' | 'ROJO' | 'AMARILLO' | 'NARANJA';

export interface UnitAcademicStatus {
  state: UnitAcademicState;
  stateLabel: string;
  colorName: string;
  uKey: string;
  unitTitle: string;

  evalScore: number | null;
  isEvalPassed: boolean;
  isEvalFailed: boolean;
  isEvalPending: boolean;

  taskScores: (number | null)[];
  failingTasks: number[];
  allTasksPassed: boolean;
  hasAnyTaskFailed: boolean;
  hasAnyTaskPending: boolean;

  isScormComplete: boolean;
  scormsDone: number;
  totalScorms: number;

  hasFailedGrade: boolean;
  minFailingScore: number | null;

  // Compact indicator (for EVAL. POR UNIDAD)
  compactText: string;
  compactSymbol?: string;
  compactBadgeClasses: string;
  compactValueClasses: string;
  compactSymbolClasses?: string;

  // Detailed card (for DESGLOSE ACADÉMICO POR UNIDAD)
  cardBadgeText: string;
  cardBadgeClasses: string;
  cardBgClasses: string;
}

/**
 * Semaforización académica unificada por unidad:
 * 1. ⚫ Negro (Requiere revisión): cualquier tarea o evaluación con calificación < 80.
 * 2. 🟢 Verde (Completada): todas las actividades obligatorias terminadas y aprobadas (>= 80).
 * 3. 🔴 Rojo (Sin inicio): ninguna actividad registrada en la unidad.
 * 4. 🟡 Amarillo (Pendiente): actividad parcial reciente, pero faltan tareas o evaluaciones.
 * 5. 🟠 Naranja (Sin avance): actividad previa sin nuevos avances durante el periodo establecido.
 */
export function getUnitAcademicStatus(
  unit: AcademicUnit,
  curr: StudentAcademicRecord,
  prev: StudentAcademicRecord | null | undefined,
  student: ProcessedStudent,
  options?: { diffDays?: number; isSingleCut?: boolean }
): UnitAcademicStatus {
  const uKey = unit.unitKey || unit.unitLabel || (unit.unitNumber ? `U${unit.unitNumber}` : 'U1');
  const unitTitle = formatAcademicUnitIdentifier(unit.unitKey, unit.unitNumber, unit.moduleNumber);

  // 1. SCORM calculation
  const totalScorms = unit.scorms ? unit.scorms.length : 0;
  const hasScorms = totalScorms > 0;
  const scormsDoneCurr = hasScorms
    ? unit.scorms.filter((sc) => {
        const k = `${uKey}-T${sc.topicNumber}`;
        const legacyK = `U${sc.unitNumber}-T${sc.topicNumber}`;
        return Boolean(curr.scormProgress?.[k] || curr.scormProgress?.[legacyK]);
      }).length
    : 0;
  const scormsDonePrev = hasScorms && prev
    ? unit.scorms.filter((sc) => {
        const k = `${uKey}-T${sc.topicNumber}`;
        const legacyK = `U${sc.unitNumber}-T${sc.topicNumber}`;
        return Boolean(prev.scormProgress?.[k] || prev.scormProgress?.[legacyK]);
      }).length
    : 0;
  const isScormComplete = !hasScorms || scormsDoneCurr === totalScorms;
  const hasScormsStarted = scormsDoneCurr > 0;
  const hasNewScorm = scormsDoneCurr > scormsDonePrev;

  // 2. Tasks calculation
  const tasks = unit.tasks || [];
  const hasTasks = tasks.length > 0;

  const getTaskScore = (t: import('../types').AcademicTask, rec: StudentAcademicRecord | null | undefined): number | null => {
    if (!rec) return null;
    const val =
      rec.taskScoresNormalized?.[t.id] ??
      rec.taskScoresNormalized?.[t.header] ??
      rec.taskScoresNormalized?.[t.unitKey] ??
      (rec.taskScores?.[t.id] !== undefined ? normalizeScore(rec.taskScores[t.id]) : null) ??
      (rec.taskScores?.[t.header] !== undefined ? normalizeScore(rec.taskScores[t.header]) : null);
    return typeof val === 'number' ? val : null;
  };

  const taskScoresCurr = tasks.map((t) => getTaskScore(t, curr));
  const taskScoresPrev = tasks.map((t) => getTaskScore(t, prev));
  const submittedTasksCurr = taskScoresCurr.filter((s): s is number => s !== null);
  const failingTasks = submittedTasksCurr.filter((s) => s < 80);
  const hasAnyTaskFailed = failingTasks.length > 0;
  const allTasksPassed = !hasTasks || (submittedTasksCurr.length === tasks.length && taskScoresCurr.every((s) => s !== null && s >= 80));
  const hasAnyTaskPending = hasTasks && taskScoresCurr.some((s) => s === null);
  const hasAnyTaskStarted = submittedTasksCurr.length > 0;
  const hasNewTaskActivity = tasks.some((t, i) => {
    const p = taskScoresPrev[i];
    const c = taskScoresCurr[i];
    if (p === null && c !== null) return true;
    if (p !== null && c !== null && c > p) return true;
    return false;
  });

  // 3. Unit Evaluation calculation
  const rawEvalCurr =
    curr.unitEvaluations?.[uKey] ??
    curr.unitEvaluations?.[unit.unitLabel || ''] ??
    curr.unitEvaluations?.[unit.unitNumber];
  const evalScoreCurr = hasValidUnitEvaluation(rawEvalCurr) ? normalizeScore(rawEvalCurr) : null;
  const rawEvalPrev = prev
    ? prev.unitEvaluations?.[uKey] ??
      prev.unitEvaluations?.[unit.unitLabel || ''] ??
      prev.unitEvaluations?.[unit.unitNumber]
    : null;
  const evalScorePrev = prev && hasValidUnitEvaluation(rawEvalPrev) ? normalizeScore(rawEvalPrev) : null;
  const isEvalPassed = evalScoreCurr !== null && evalScoreCurr >= 80;
  const isEvalFailed = evalScoreCurr !== null && evalScoreCurr < 80;
  const isEvalPending = evalScoreCurr === null;
  const hasNewEvalActivity =
    (evalScorePrev === null && evalScoreCurr !== null) ||
    (evalScorePrev !== null && evalScoreCurr !== null && evalScoreCurr > evalScorePrev);

  // 4. Activity checks
  const hasCurrActivity = hasScormsStarted || hasAnyTaskStarted || evalScoreCurr !== null;
  const hasPrevActivity = scormsDonePrev > 0 || (hasTasks && taskScoresPrev.some((s) => s !== null)) || evalScorePrev !== null;
  const hasNewActivityInUnit = hasNewScorm || hasNewTaskActivity || hasNewEvalActivity;

  // 5. Failing grade check (< 80)
  const allFailingScores = [...failingTasks, ...(isEvalFailed && evalScoreCurr !== null ? [evalScoreCurr] : [])];
  const hasFailedGrade = allFailingScores.length > 0;
  const minFailingScore = hasFailedGrade ? Math.min(...allFailingScores) : null;

  // Tutorial resolution checks
  const unitIsNA = student.tutorialResolution === 'N.A' || student.tutorialResolution === 'Reprobó';
  const unitIsSegundoIntento = student.tutorialResolution === 'Segundo intento otorgado';

  // State determination
  let state: UnitAcademicState;
  let stateLabel: string;
  let colorName: string;
  let compactText: string;
  let compactBadgeClasses: string;
  let compactValueClasses: string;
  let compactSymbol: string | undefined;
  let compactSymbolClasses: string | undefined;
  let cardBadgeText: string;
  let cardBadgeClasses: string;
  let cardBgClasses: string;

  // 1. ⚫ NEGRO: Requiere revisión (< 80)
  if (hasFailedGrade && minFailingScore !== null) {
    state = 'NEGRO';
    stateLabel = 'Requiere revisión';
    colorName = 'Negro';
    compactText = `${minFailingScore}`;
    compactSymbol = '⚠';
    compactSymbolClasses = 'text-amber-400 font-bold ml-0.5';
    compactBadgeClasses = 'bg-slate-900 text-white border-slate-950 font-bold shadow-2xs';
    compactValueClasses = 'text-white font-bold ml-0.5';

    if (unitIsNA) {
      cardBadgeText = 'N.A. · Atendido';
      cardBadgeClasses = 'bg-purple-100 text-purple-900 border-purple-300 font-bold';
      cardBgClasses = 'bg-purple-50/25 border-purple-200';
    } else if (unitIsSegundoIntento) {
      cardBadgeText = '2.º intento';
      cardBadgeClasses = 'bg-slate-900 text-white border-slate-950 font-bold';
      cardBgClasses = 'bg-slate-50 border-slate-400';
    } else {
      cardBadgeText = 'Requiere revisión';
      cardBadgeClasses = 'bg-slate-900 text-white border-slate-950 font-bold';
      cardBgClasses = 'bg-slate-50 border-slate-400';
    }
  }
  // 2. 🟢 VERDE: Unidad completada satisfactoriamente (todas las obligatorias aprobadas >= 80)
  else if (isScormComplete && allTasksPassed && isEvalPassed) {
    state = 'VERDE';
    stateLabel = 'Completada';
    colorName = 'Verde';
    compactText = evalScoreCurr !== null ? `${evalScoreCurr}` : '100';
    compactSymbol = '✓';
    compactSymbolClasses = 'text-emerald-600 font-bold ml-0.5';
    compactBadgeClasses = 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold shadow-2xs';
    compactValueClasses = 'font-bold text-emerald-900 ml-0.5';

    cardBadgeText = 'Completada';
    cardBadgeClasses = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';
    cardBgClasses = 'bg-emerald-50/20 border-emerald-200';
  }
  // 3. 🔴 ROJO: Sin inicio (ninguna actividad registrada en la unidad)
  else if (!hasCurrActivity) {
    state = 'ROJO';
    stateLabel = 'Sin inicio';
    colorName = 'Rojo';
    compactText = 'Sin inicio';
    compactSymbol = undefined;
    compactBadgeClasses = 'bg-rose-50 text-rose-800 border-rose-200 font-semibold shadow-2xs';
    compactValueClasses = 'font-normal text-rose-700 italic ml-0.5';

    cardBadgeText = 'Sin inicio';
    cardBadgeClasses = 'bg-rose-100 text-rose-800 border-rose-200 font-bold';
    cardBgClasses = 'bg-rose-50/20 border-rose-200';
  }
  // 4. 🟡 AMARILLO vs 🟠 NARANJA: Actividad parcial
  else {
    const isSingleCut = Boolean(options?.isSingleCut || !prev);
    const diffDays = options?.diffDays ?? (isSingleCut ? 0 : 2);

    const isSinAvance =
      !isSingleCut &&
      hasPrevActivity &&
      !hasNewActivityInUnit &&
      (student.state === 'NARANJA' || diffDays >= 2);

    if (isSinAvance) {
      state = 'NARANJA';
      stateLabel = 'Sin avance';
      colorName = 'Naranja';
      compactText = 'Sin avance';
      compactSymbol = undefined;
      compactBadgeClasses = 'bg-orange-50 text-orange-950 border-orange-300 font-semibold shadow-2xs';
      compactValueClasses = 'font-semibold text-orange-900 ml-0.5';

      cardBadgeText = 'Sin avance';
      cardBadgeClasses = 'bg-orange-100 text-orange-900 border-orange-300 font-bold';
      cardBgClasses = 'bg-orange-50/20 border-orange-300';
    } else {
      state = 'AMARILLO';
      stateLabel = 'Pendiente';
      colorName = 'Amarillo';
      compactText = 'Pendiente';
      compactSymbol = undefined;
      compactBadgeClasses = 'bg-amber-50 text-amber-900 border-amber-300 font-semibold shadow-2xs';
      compactValueClasses = 'font-semibold text-amber-900 ml-0.5';

      let missingDetail = 'Pendiente';
      if (isEvalPending && (!hasTasks || allTasksPassed)) {
        missingDetail = 'Falta evaluación';
      } else if (hasAnyTaskPending && isEvalPassed) {
        missingDetail = 'Falta tarea';
      } else if (!isScormComplete && (isEvalPassed || hasAnyTaskStarted)) {
        missingDetail = 'Falta SCORM';
      }
      cardBadgeText = missingDetail;
      cardBadgeClasses = 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
      cardBgClasses = 'bg-amber-50/20 border-amber-300';
    }
  }

  return {
    state,
    stateLabel,
    colorName,
    uKey,
    unitTitle,
    evalScore: evalScoreCurr,
    isEvalPassed,
    isEvalFailed,
    isEvalPending,
    taskScores: taskScoresCurr,
    failingTasks,
    allTasksPassed,
    hasAnyTaskFailed,
    hasAnyTaskPending,
    isScormComplete,
    scormsDone: scormsDoneCurr,
    totalScorms,
    hasFailedGrade,
    minFailingScore,
    compactText,
    compactSymbol,
    compactBadgeClasses,
    compactValueClasses,
    compactSymbolClasses,
    cardBadgeText,
    cardBadgeClasses,
    cardBgClasses,
  };
}

/**
 * Dynamically determines the student's latest academic checkpoint reached.
 * Supports composite modular labels (M1-U1, M2-U3, U1, etc.) and task statuses.
 */
export function getAcademicPosition(
  record: StudentAcademicRecord,
  units: AcademicUnit[],
  courseType?: import('../types').CourseType
): string {
  if (!hasAnyCourseActivity(record)) {
    return 'Sin inicio';
  }

  if (isCourseCompleted(record, units, courseType)) {
    return 'Curso completado';
  }

  // If student reached Evaluación Final with a valid score
  const hasValidEf =
    record.evaluacionFinalScore !== null ||
    hasValidUnitEvaluation(record.evaluacionFinal);

  if (hasValidEf) {
    return 'Evaluación Final';
  }

  // Iterate units descending from highest to lowest
  const reversedUnits = [...units].reverse();

  for (const unit of reversedUnits) {
    const isCompleted = isUnitCompleted(record, unit, courseType);
    if (isCompleted) {
      return `Unidad ${unit.unitLabel || `U${unit.unitNumber}`} completada`;
    }

    // Check unit evaluation
    const evalVal =
      record.unitEvaluations[unit.unitKey || ''] ??
      record.unitEvaluations[unit.unitLabel || ''] ??
      record.unitEvaluations[unit.unitNumber];
    if (hasValidUnitEvaluation(evalVal)) {
      return `Evaluación ${unit.unitLabel || `U${unit.unitNumber}`}`;
    }

    // Check tasks for this unit
    if (unit.tasks && unit.tasks.length > 0) {
      for (const task of unit.tasks) {
        const tVal = record.taskScores?.[task.id] ?? record.taskScores?.[task.header];
        const tScore = normalizeScore(tVal);
        if (tScore !== null) {
          return tScore >= 80
            ? `Tarea ${unit.unitLabel || `U${unit.unitNumber}`} aprobada`
            : `Tarea ${unit.unitLabel || `U${unit.unitNumber}`} entregada`;
        }
      }
    }

    // Check topics in this unit in descending order
    const sortedScorms = [...unit.scorms].sort((a, b) => b.topicNumber - a.topicNumber);
    for (const sc of sortedScorms) {
      const key = `${unit.unitKey || `U${unit.unitNumber}`}-T${sc.topicNumber}`;
      const legacyKey = `U${sc.unitNumber}-T${sc.topicNumber}`;
      if (record.scormProgress[key] || record.scormProgress[legacyKey]) {
        return `Unidad ${unit.unitLabel || `U${unit.unitNumber}`} Tema ${sc.topicNumber}`;
      }
    }
  }

  // If no unit activity, but has Evaluación Inicial
  if (hasInitialEvaluation(record)) {
    return 'Evaluación Inicial';
  }

  return 'Sin inicio';
}

/**
 * Detects if there has been ANY new academic activity between previous and current cut.
 * (New Evaluacion Inicial, new SCORM, new task, new unit evaluation, new final evaluation, new total score, etc.)
 */
export function hasNewAcademicActivity(
  prev: StudentAcademicRecord | undefined,
  curr: StudentAcademicRecord,
  units: AcademicUnit[],
  courseType?: import('../types').CourseType
): boolean {
  if (!prev) {
    return hasAnyCourseActivity(curr);
  }

  // 1. Evaluacion Inicial newly performed
  if (hasInitialEvaluation(curr) && !hasInitialEvaluation(prev)) {
    return true;
  }

  // 2. Newly completed SCORM
  for (const [key, isDone] of Object.entries(curr.scormProgress)) {
    const wasDone = Boolean(prev.scormProgress[key]);
    if (isDone && !wasDone) {
      return true;
    }
  }

  // 3. Newly attempted Task or changed Task score
  if (curr.taskScores) {
    for (const [tKey, currVal] of Object.entries(curr.taskScores)) {
      const prevVal = prev.taskScores?.[tKey];
      const currScore = normalizeScore(currVal);
      const prevScore = normalizeScore(prevVal);
      if (currScore !== null && prevScore === null) {
        return true;
      }
      if (currScore !== null && prevScore !== null && currScore !== prevScore) {
        return true;
      }
    }
  }

  // 4. Newly attempted Unit Evaluation with valid score or changed score
  for (const [uStr, currScore] of Object.entries(curr.unitEvaluations)) {
    const prevScore = prev.unitEvaluations[uStr];
    const currHas = hasValidUnitEvaluation(currScore);
    const prevHas = hasValidUnitEvaluation(prevScore);

    if (currHas && !prevHas) {
      return true;
    }
    if (currHas && prevHas && normalizeScore(currScore) !== normalizeScore(prevScore)) {
      return true;
    }
  }

  // 5. Final Evaluation attempted or changed
  const currEf = curr.evaluacionFinalScore;
  const prevEf = prev.evaluacionFinalScore;
  if (currEf !== null && prevEf === null) return true;
  if (currEf !== null && prevEf !== null && currEf !== prevEf) return true;
  if (curr.evaluacionFinal && !prev.evaluacionFinal) return true;

  // 6. Total Categoria changed
  const currTc = curr.totalCategoriaScore;
  const prevTc = prev.totalCategoriaScore;
  if (currTc !== null && prevTc === null) return true;
  if (currTc !== null && prevTc !== null && currTc !== prevTc) return true;

  // 7. Total activities count increase
  if (curr.totalCompletedActivities > prev.totalCompletedActivities) {
    return true;
  }

  // 8. Academic position advanced
  const prevPos = getAcademicPosition(prev, units, courseType);
  const currPos = getAcademicPosition(curr, units, courseType);
  if (currPos !== 'Sin inicio' && currPos !== prevPos) {
    return true;
  }

  return false;
}

/**
 * Column classification interfaces
 */
export interface ColumnMetadata {
  header: string;
  type:
    | 'admin'
    | 'evaluacion_inicial'
    | 'evaluacion_final'
    | 'total_categoria'
    | 'evaluacion_unidad'
    | 'tarea'
    | 'scorm'
    | 'other';
  adminField?: 'usuario' | 'nombre' | 'apellidos' | 'email' | 'ciudad' | 'departamento';
  moduleNumber?: number;
  unitNumber?: number;
  unitKey?: string;
  topicNumber?: number;
  scormName?: string;
  taskName?: string;
  taskId?: string;
}

/**
 * Detects dynamic academic structure, classifies headers, extracts composite units (M+U or U),
 * and determines the course modality (TUTORIZADO vs SEMITUTORIZADO).
 */
export function classifyColumns(headers: string[]): {
  columns: ColumnMetadata[];
  units: AcademicUnit[];
  courseType: import('../types').CourseType;
} {
  const columns: ColumnMetadata[] = [];
  const unitMap = new Map<
    string,
    {
      unitNumber: number;
      moduleNumber?: number;
      unitKey: string;
      unitLabel: string;
      scorms: SCORMResource[];
      tasks: import('../types').AcademicTask[];
      unitEvalHeader?: string;
    }
  >();

  // Helper to ensure unit entry exists in unitMap
  const getOrCreateUnit = (unitNumber: number, moduleNumber?: number) => {
    const unitKey = moduleNumber !== undefined ? `M${moduleNumber}-U${unitNumber}` : `U${unitNumber}`;
    const unitLabel = unitKey;
    if (!unitMap.has(unitKey)) {
      unitMap.set(unitKey, {
        unitNumber,
        moduleNumber,
        unitKey,
        unitLabel,
        scorms: [],
        tasks: [],
      });
    }
    return unitMap.get(unitKey)!;
  };

  headers.forEach((rawHeader) => {
    const header = String(rawHeader || '').trim();
    if (!header) {
      columns.push({ header, type: 'other' });
      return;
    }

    const lower = header.toLowerCase();

    // 1. Admin columns
    if (lower === 'usuario' || lower === 'nombre de usuario' || lower === 'id de usuario' || lower === 'username') {
      columns.push({ header, type: 'admin', adminField: 'usuario' });
      return;
    }
    if (lower === 'nombre' || lower === 'primer nombre') {
      columns.push({ header, type: 'admin', adminField: 'nombre' });
      return;
    }
    if (lower === 'apellido(s)' || lower === 'apellidos' || lower === 'apellido' || lower === 'primer apellido') {
      columns.push({ header, type: 'admin', adminField: 'apellidos' });
      return;
    }
    if (
      lower === 'dirección email' ||
      lower === 'direccion email' ||
      lower === 'email' ||
      lower === 'correo' ||
      lower === 'correo electrónico' ||
      lower === 'correo electronico'
    ) {
      columns.push({ header, type: 'admin', adminField: 'email' });
      return;
    }
    if (lower === 'ciudad' || lower === 'municipio') {
      columns.push({ header, type: 'admin', adminField: 'ciudad' });
      return;
    }
    if (lower === 'departamento' || lower === 'estado' || lower === 'provincia') {
      if (!lower.includes('examen') && !lower.includes('scorm') && !lower.includes('total') && !lower.includes('tarea')) {
        columns.push({ header, type: 'admin', adminField: 'departamento' });
        return;
      }
    }

    // 2. Evaluacion Inicial
    if (
      lower.includes('evaluación inicial') ||
      lower.includes('evaluacion inicial') ||
      lower.includes('evaluacion diagnostica') ||
      lower.includes('evaluación diagnóstica')
    ) {
      columns.push({ header, type: 'evaluacion_inicial' });
      return;
    }

    // 3. Evaluacion Final (EF)
    if (
      lower.includes('evaluación final') ||
      lower.includes('evaluacion final') ||
      lower.includes('examen final') ||
      lower.includes('examen:ef') ||
      lower.includes('examen: ef') ||
      lower.includes('evaluación: ef') ||
      lower.includes('evaluacion: ef')
    ) {
      columns.push({ header, type: 'evaluacion_final' });
      return;
    }

    // 4. Total de la Categoría / Calificación Total del Curso
    if (
      lower.includes('total_categoría') ||
      lower.includes('total_categoria') ||
      lower.includes('total categoría') ||
      lower.includes('total categoria') ||
      lower.includes('total de la categoría') ||
      lower.includes('total de la categoria') ||
      lower.includes('calificación del curso') ||
      lower.includes('calificacion del curso') ||
      lower.includes('total del curso') ||
      lower.includes('curso total')
    ) {
      columns.push({ header, type: 'total_categoria' });
      return;
    }

    // 5. Tarea detection (e.g. "Tarea:M1-U1", "Tarea: M1-U2", "Tarea:M2-U3", "Tarea: U1", "Tarea M1-U1")
    // Does NOT match the word 'tarea' within non-activity comments
    const tareaMatch =
      header.match(/^(?:Paquete\s+)?Tarea\s*[:\-_]?\s*(?:M\s*(\d+)[\s_\-]*)?U\s*(\d+)(.*?)(?:\(Real\))?$/i) ||
      header.match(/^(?:Paquete\s+)?Tarea\s+(?:M\s*(\d+)[\s_\-]*)?U\s*(\d+)(.*?)(?:\(Real\))?$/i) ||
      header.match(/(?:^|\b)Tarea\s*[:\-_]\s*(?:M\s*(\d+)[\s_\-]*)?U\s*(\d+)(.*?)(?:\(Real\))?$/i);

    if (tareaMatch) {
      const moduleNumber = tareaMatch[1] ? parseInt(tareaMatch[1], 10) : undefined;
      const unitNumber = parseInt(tareaMatch[2], 10);
      const unitKey = moduleNumber !== undefined ? `M${moduleNumber}-U${unitNumber}` : `U${unitNumber}`;
      const suffix = (tareaMatch[3] || '').trim();
      const taskName = suffix ? `Tarea ${unitKey} ${suffix}`.trim() : `Tarea ${unitKey}`;
      const taskId = `tarea_${unitKey.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${columns.filter((c) => c.type === 'tarea').length + 1}`;

      columns.push({
        header,
        type: 'tarea',
        moduleNumber,
        unitNumber,
        unitKey,
        taskName,
        taskId,
      });

      const unitData = getOrCreateUnit(unitNumber, moduleNumber);
      unitData.tasks.push({
        id: taskId,
        header,
        moduleNumber,
        unitNumber,
        unitKey,
        name: taskName,
        isRequired: true,
      });
      return;
    }

    // 6. SCORM detection (e.g. "Paquete SCORM:U1-T1 Introducción (Real)", "Paquete SCORM: M1-U1-T1 Introducción (Real)", "SCORM: M2-U3-T2 Conceptos (Real)")
    const scormMatch =
      header.match(/(?:Paquete\s+SCORM\s*:\s*|SCORM\s*:\s*|SCORM.*?)\s*(?:M\s*(\d+)[\s_\-]*)?U\s*(\d+)[\s_-]*T\s*(\d+)\s*(.*?)(?:\(Real\))?$/i) ||
      header.match(/(?:Paquete\s+SCORM\s*:\s*)?(?:M\s*(\d+)[\s_\-]*)?U\s*(\d+)[\s_-]*T\s*(\d+)\s*(.*?)(?:\(Real\))?$/i);

    if (scormMatch) {
      const moduleNumber = scormMatch[1] ? parseInt(scormMatch[1], 10) : undefined;
      const unitNumber = parseInt(scormMatch[2], 10);
      const topicNumber = parseInt(scormMatch[3], 10);
      const scormName = scormMatch[4] ? scormMatch[4].trim() : `Tema ${topicNumber}`;
      const unitKey = moduleNumber !== undefined ? `M${moduleNumber}-U${unitNumber}` : `U${unitNumber}`;

      columns.push({
        header,
        type: 'scorm',
        moduleNumber,
        unitNumber,
        unitKey,
        topicNumber,
        scormName,
      });

      const unitData = getOrCreateUnit(unitNumber, moduleNumber);
      unitData.scorms.push({
        unitNumber,
        moduleNumber,
        unitKey,
        topicNumber,
        name: scormName,
        columnHeader: header,
      });
      return;
    }

    // 7. Unit Evaluation detection
    // Examples: "Examen:M2-U1 Evaluación de la unidad (Real)", "Examen: Unidad 7 (Real)", "Unidad 7 (Real)", "Evaluación: Unidad 7", "U7 (Real)", "Cuestionario Unidad 7"
    const unitEvalMatch =
      // With module + unit: "Examen:M2-U1...", "Evaluacion: M1-U2...", "M2-U1 Evaluación..."
      header.match(/(?:Examen|Evaluaci[oó]n|Cuestionario)?\s*[:\-_]?\s*(?:de\s+la\s+)?M\s*(\d+)[\s_\-]*U\s*(\d+)/i) ||
      // "Examen: Unidad 7", "Evaluación: U7", "Cuestionario de la Unidad 7"
      header.match(/(?:Examen|Evaluaci[oó]n|Cuestionario)\s*[:\-_]?\s*(?:de\s+la\s+)?(?:M\s*(\d+)[\s_\-]*)?(?:Unidad|U)[\s_-]*(\d+)/i) ||
      // "Unidad 7: Evaluación", "U7 - Examen"
      header.match(/(?:M\s*(\d+)[\s_\-]*)?(?:Unidad|U)[\s_-]*(\d+)\s*[:\-_]?\s*(?:Evaluaci[oó]n|Examen|Cuestionario)/i) ||
      // Standalone unit header: "Unidad 7 (Real)", "U7 (Real)", "Unidad 7", "U7"
      header.match(/^(?:M\s*(\d+)[\s_\-]*)?(?:Unidad|U)[\s_-]*(\d+)(?:\s*(?:[:\-_]|de|\().*)?$/i);

    if (unitEvalMatch) {
      const moduleNumber = unitEvalMatch[1] ? parseInt(unitEvalMatch[1], 10) : undefined;
      const unitNumber = parseInt(unitEvalMatch[2], 10);
      const unitKey = moduleNumber !== undefined ? `M${moduleNumber}-U${unitNumber}` : `U${unitNumber}`;

      columns.push({
        header,
        type: 'evaluacion_unidad',
        moduleNumber,
        unitNumber,
        unitKey,
      });

      const unitData = getOrCreateUnit(unitNumber, moduleNumber);
      unitData.unitEvalHeader = header;
      return;
    }

    columns.push({ header, type: 'other' });
  });

  // Sort units by moduleNumber (ascending), then by unitNumber (ascending)
  const units: AcademicUnit[] = Array.from(unitMap.entries())
    .sort(([, dataA], [, dataB]) => {
      const modA = dataA.moduleNumber ?? 0;
      const modB = dataB.moduleNumber ?? 0;
      if (modA !== modB) return modA - modB;
      return dataA.unitNumber - dataB.unitNumber;
    })
    .map(([, data]) => ({
      unitNumber: data.unitNumber,
      moduleNumber: data.moduleNumber,
      unitKey: data.unitKey,
      unitLabel: data.unitLabel,
      scorms: data.scorms.sort((a, b) => a.topicNumber - b.topicNumber),
      tasks: data.tasks,
      unitEvaluationColumn: data.unitEvalHeader,
    }));

  const hasTasks = columns.some((c) => c.type === 'tarea');
  const courseType: import('../types').CourseType = hasTasks ? 'TUTORIZADO' : 'SEMITUTORIZADO';

  return { columns, units, courseType };
}

/**
 * Extracts student records from a specific worksheet.
 * Preserves exact, literal values for Nombre, Apellido(s), Usuario, Dirección Email, etc.
 * Normalizes scores for tasks, unit evaluations, and final evaluations.
 */
export function extractStudentRecordsFromSheet(
  sheet: XLSX.WorkSheet,
  classified: {
    columns: ColumnMetadata[];
    units: AcademicUnit[];
    courseType?: import('../types').CourseType;
  }
): StudentAcademicRecord[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  if (!rows || rows.length < 2) {
    return [];
  }

  const rawHeaders = (rows[0] || []).map((h) => String(h || '').trim());
  const headerMap = new Map<string, number>();
  rawHeaders.forEach((h, idx) => {
    if (h) headerMap.set(h, idx);
  });

  // Analyze each column to detect if it operates as percentage or proportion scale
  const columnContextMap = new Map<string, ScoreContext>();

  classified.columns.forEach((col) => {
    const colIdx = headerMap.get(col.header);
    if (colIdx === undefined) return;

    let hasPercentageFormat = false;
    let hasProportions = false;
    let maxNumeric = 0;
    let minPositiveNumeric = Infinity;

    for (let r = 1; r < rows.length; r++) {
      const addr = XLSX.utils.encode_cell({ r, c: colIdx });
      const cell = sheet[addr] as XLSX.CellObject | undefined;
      if (!cell) continue;

      const raw = cell.v;
      const formatted = cell.w;
      const formatPattern = typeof cell.z === 'string' ? cell.z : undefined;

      if (formatPattern && formatPattern.includes('%')) {
        hasPercentageFormat = true;
      }
      if (typeof formatted === 'string' && formatted.includes('%')) {
        hasPercentageFormat = true;
      }
      if (typeof raw === 'number' && !isNaN(raw)) {
        if (raw > 0 && raw < 1) {
          hasProportions = true;
        }
        if (raw > 0) {
          maxNumeric = Math.max(maxNumeric, raw);
          minPositiveNumeric = Math.min(minPositiveNumeric, raw);
        }
      } else if (typeof raw === 'string') {
        const s = raw.trim();
        if (s.includes('%')) {
          hasPercentageFormat = true;
        }
        const num = parseFloat(s.replace(',', '.'));
        if (!isNaN(num) && num > 0 && num < 1) {
          hasProportions = true;
        }
        if (!isNaN(num) && num > 0) {
          maxNumeric = Math.max(maxNumeric, num);
          minPositiveNumeric = Math.min(minPositiveNumeric, num);
        }
      }
    }

    const isPercentageColumn =
      hasPercentageFormat ||
      hasProportions ||
      (maxNumeric <= 1 && minPositiveNumeric < 1 && maxNumeric > 0) ||
      (col.header.toLowerCase().includes('(real)') && (hasProportions || hasPercentageFormat || maxNumeric <= 1));

    columnContextMap.set(col.header, {
      isPercentageColumn,
      header: col.header,
      favorableCriterion: true,
    });
  });

  const students: StudentAcademicRecord[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    if (!row || row.length === 0) continue;

    const getCellInfo = (col: ColumnMetadata) => {
      const idx = headerMap.get(col.header);
      if (idx === undefined) return { rawVal: undefined, cell: undefined, context: undefined };
      const rawVal = row[idx];
      const addr = XLSX.utils.encode_cell({ r, c: idx });
      const cell = sheet[addr] as XLSX.CellObject | undefined;
      const baseContext = columnContextMap.get(col.header);
      const context: ScoreContext = {
        ...baseContext,
        formatted: cell?.w,
        formatPattern: typeof cell?.z === 'string' ? cell.z : undefined,
      };
      return { rawVal: cell?.v !== undefined ? cell.v : rawVal, cell, context };
    };

    // Extract admin data literally
    let usuario = '';
    let nombre = '';
    let apellidos = '';
    let email = '';
    let ciudad = '';
    let departamento = '';

    classified.columns.forEach((col) => {
      if (col.type === 'admin') {
        const { rawVal } = getCellInfo(col);
        const val = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : '';
        if (col.adminField === 'usuario') usuario = val;
        if (col.adminField === 'nombre') nombre = val;
        if (col.adminField === 'apellidos') apellidos = val;
        if (col.adminField === 'email') email = val;
        if (col.adminField === 'ciudad') ciudad = val;
        if (col.adminField === 'departamento') departamento = val;
      }
    });

    if (!usuario && !email && !nombre) {
      continue;
    }

    const nombreCompleto = [nombre, apellidos].filter(Boolean).join(' ').trim() || usuario || email;

    // Extract Academic Fields
    let evaluacionInicial: number | string | null = null;
    let evaluacionFinal: number | string | null = null;
    let evaluacionFinalScore: number | null = null;
    let totalCategoria: number | string | null = null;
    let totalCategoriaScore: number | null = null;

    const unitEvaluations: Record<string, number | string | null> = {};
    const scormProgress: Record<string, boolean> = {};
    const taskScores: Record<string, number | string | null> = {};
    const taskScoresNormalized: Record<string, number | null> = {};

    let highestActiveUnit = 0;
    let highestActiveUnitKey = '';
    let totalCompletedActivities = 0;

    classified.columns.forEach((col) => {
      const { rawVal, context } = getCellInfo(col);

      if (col.type === 'evaluacion_inicial') {
        evaluacionInicial = rawVal !== undefined && rawVal !== '' ? String(rawVal).trim() : null;
        if (evaluacionInicial !== null && evaluacionInicial !== '-') {
          totalCompletedActivities += 1;
        }
      } else if (col.type === 'evaluacion_final') {
        if (rawVal !== undefined && rawVal !== '') {
          evaluacionFinal = String(rawVal).trim();
          evaluacionFinalScore = normalizeScore(rawVal, context);
          if (evaluacionFinalScore !== null) {
            totalCompletedActivities += 1;
          }
        }
      } else if (col.type === 'total_categoria') {
        if (rawVal !== undefined && rawVal !== '') {
          totalCategoria = String(rawVal).trim();
          totalCategoriaScore = normalizeScore(rawVal, context);
        }
      } else if (col.type === 'evaluacion_unidad' && col.unitNumber !== undefined) {
        const uKey = col.unitKey || `U${col.unitNumber}`;
        if (hasValidUnitEvaluation(rawVal)) {
          const num = normalizeScore(rawVal, context);
          unitEvaluations[uKey] = num;
          unitEvaluations[col.unitNumber] = num;
          if (col.unitNumber > highestActiveUnit) {
            highestActiveUnit = col.unitNumber;
            highestActiveUnitKey = uKey;
          }
          totalCompletedActivities += 1;
        } else {
          const rawTrim = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : '';
          const fallback = rawTrim !== '' ? rawTrim : '-';
          unitEvaluations[uKey] = fallback;
          unitEvaluations[col.unitNumber] = fallback;
        }
      } else if (col.type === 'tarea') {
        const rawTrim = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : '';
        const num = normalizeScore(rawVal, context);
        const uKey = col.unitKey || `U${col.unitNumber || 1}`;

        if (col.taskId) {
          taskScores[col.taskId] = rawTrim !== '' ? rawTrim : null;
          taskScoresNormalized[col.taskId] = num;
        }
        taskScores[col.header] = rawTrim !== '' ? rawTrim : null;
        taskScoresNormalized[col.header] = num;
        taskScores[uKey] = rawTrim !== '' ? rawTrim : null;
        taskScoresNormalized[uKey] = num;

        if (hasValidNumericGrade(rawVal)) {
          totalCompletedActivities += 1;
          if (col.unitNumber !== undefined && col.unitNumber > highestActiveUnit) {
            highestActiveUnit = col.unitNumber;
            highestActiveUnitKey = uKey;
          }
        }
      } else if (col.type === 'scorm' && col.unitNumber !== undefined && col.topicNumber !== undefined) {
        const hasProg = hasScormProgress(rawVal);
        const uKey = col.unitKey || `U${col.unitNumber}`;
        const key = `${uKey}-T${col.topicNumber}`;
        const legacyKey = `U${col.unitNumber}-T${col.topicNumber}`;

        scormProgress[key] = hasProg;
        scormProgress[legacyKey] = hasProg;

        if (hasProg) {
          totalCompletedActivities += 1;
          if (col.unitNumber > highestActiveUnit) {
            highestActiveUnit = col.unitNumber;
            highestActiveUnitKey = uKey;
          }
        }
      }
    });

    // Compute Tasks summary
    let submittedTasks = 0;
    let approvedTasks = 0;
    let failedTasks = 0;
    let allTasksCount = 0;

    classified.units.forEach((u) => {
      if (u.tasks) {
        u.tasks.forEach((t) => {
          allTasksCount++;
          const score = normalizeScore(taskScores[t.id] ?? taskScores[t.header]);
          if (score !== null) {
            submittedTasks++;
            if (score >= 80) {
              approvedTasks++;
            } else {
              failedTasks++;
            }
          }
        });
      }
    });

    const tasksSummary: import('../types').TasksSummary = {
      totalTasks: allTasksCount,
      submittedTasks,
      approvedTasks,
      failedTasks,
      pendingTasks: allTasksCount - submittedTasks,
    };

    // Create partial record to compute unit completion
    const partialRecord: StudentAcademicRecord = {
      usuario,
      nombre,
      apellidos,
      nombreCompleto,
      email,
      ciudad,
      departamento,
      evaluacionInicial,
      evaluacionFinal,
      evaluacionFinalScore,
      totalCategoria,
      totalCategoriaScore,
      unitEvaluations,
      scormProgress,
      taskScores,
      taskScoresNormalized,
      tasksSummary,
      highestActiveUnit,
      highestActiveUnitKey,
      completedUnitsCount: 0,
      highestCompletedUnit: 0,
      highestCompletedUnitKey: '',
      totalCompletedActivities,
    };

    const { count: completedUnitsCount, highestCompletedUnit, highestCompletedUnitKey } = getCompletedUnitsInfo(
      partialRecord,
      classified.units,
      classified.courseType
    );

    partialRecord.completedUnitsCount = completedUnitsCount;
    partialRecord.highestCompletedUnit = highestCompletedUnit;
    partialRecord.highestCompletedUnitKey = highestCompletedUnitKey;

    students.push(partialRecord);
  }

  return students;
}

/**
 * Validates the Excel workbook and extracts all DDMMYY cuts sorted chronologically.
 */
export function parseWorkbookCuts(workbook: XLSX.WorkBook): {
  validSheets: DateDDMMYY[];
  allCutSheetsData: Record<string, StudentAcademicRecord[]>;
  academicUnits: AcademicUnit[];
  courseType: import('../types').CourseType;
} {
  const sheetNames = workbook.SheetNames;
  const validSheets: DateDDMMYY[] = [];
  const dateCutMap = new Map<string, string>(); // key: `${formatted}#${cutNumber}` -> sheet raw name

  for (const name of sheetNames) {
    const dateInfo = parseDDMMYY(name);
    if (dateInfo) {
      const key = `${dateInfo.formatted}#${dateInfo.cutNumber}`;
      if (dateCutMap.has(key)) {
        const previousSheet = dateCutMap.get(key)!;
        throw new Error(
          `Se identificaron dos pestañas que representan exactamente el mismo corte lógico: "${previousSheet}" y "${name}" (Fecha: ${dateInfo.formatted}, Corte ${dateInfo.cutNumber}). Para corregirlo, modifique el nombre de una de las pestañas en su archivo Excel asignándole un número de corte diferente (ejemplo: "${name}-2") y vuelva a cargar el archivo.`
        );
      }
      dateCutMap.set(key, name);
      validSheets.push(dateInfo);
    }
  }

  if (validSheets.length === 0) {
    throw new Error(
      'No se encontraron hojas con formato de fecha DDMMYY válido (ej. 030826) en el libro de Excel.'
    );
  }

  // Sort strictly by calendar date ascending, then cutNumber ascending
  validSheets.sort((a, b) => {
    const timeA = a.date.getTime();
    const timeB = b.date.getTime();
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    return a.cutNumber - b.cutNumber;
  });

  // Collect headers across all valid sheets to discover the complete academic structure
  const headerSet = new Set<string>();
  const allHeaders: string[] = [];

  // Start from latest sheet backwards, preserving order
  for (let i = validSheets.length - 1; i >= 0; i--) {
    const ws = workbook.Sheets[validSheets[i].raw];
    if (!ws) continue;
    const sheetHeaders = (XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })[0] || []) as string[];
    sheetHeaders.forEach((h) => {
      const trimmed = String(h || '').trim();
      if (trimmed && !headerSet.has(trimmed)) {
        headerSet.add(trimmed);
        allHeaders.push(trimmed);
      }
    });
  }

  if (allHeaders.length === 0) {
    const latestSheetName = validSheets[validSheets.length - 1].raw;
    throw new Error(`No se pudo leer la hoja ${latestSheetName}`);
  }

  const classified = classifyColumns(allHeaders);

  // Parse all cut sheets data
  const allCutSheetsData: Record<string, StudentAcademicRecord[]> = {};

  for (const sheetInfo of validSheets) {
    const ws = workbook.Sheets[sheetInfo.raw];
    if (ws) {
      const records = extractStudentRecordsFromSheet(ws, classified);
      allCutSheetsData[sheetInfo.raw] = records;
    }
  }

  return {
    validSheets,
    allCutSheetsData,
    academicUnits: classified.units,
    courseType: classified.courseType,
  };
}

/**
 * Internal helper to match records without modifying original strings.
 */
function getMatchKey(rec: StudentAcademicRecord): string {
  if (rec.usuario) return rec.usuario.trim().toLowerCase();
  if (rec.email) return rec.email.trim().toLowerCase();
  return rec.nombreCompleto.trim().toLowerCase();
}

/**
 * Finds the date of the student's latest observable academic activity across all cuts up to currentDate.
 */
export function findLastActivityDate(
  studentKey: string,
  currentCutIndex: number,
  validSheets: DateDDMMYY[],
  allCutSheetsData: Record<string, StudentAcademicRecord[]>,
  academicUnits: AcademicUnit[],
  courseType?: import('../types').CourseType
): DateDDMMYY | null {
  if (currentCutIndex < 0 || currentCutIndex >= validSheets.length) return null;

  const normalizedTarget = studentKey.trim().toLowerCase();

  const getRec = (sheetName: string): StudentAcademicRecord | undefined => {
    const data = allCutSheetsData[sheetName] || [];
    return data.find((s) => {
      if (s.usuario && s.usuario.trim().toLowerCase() === normalizedTarget) return true;
      if (s.email && s.email.trim().toLowerCase() === normalizedTarget) return true;
      if (s.nombreCompleto && s.nombreCompleto.trim().toLowerCase() === normalizedTarget) return true;
      return false;
    });
  };

  const currRec = getRec(validSheets[currentCutIndex].raw);
  if (!currRec || !hasAnyCourseActivity(currRec)) {
    return null;
  }

  // Walk backwards from current cut to find the last step where new activity occurred
  for (let i = currentCutIndex; i > 0; i--) {
    const sheetCurr = validSheets[i];
    const sheetPrev = validSheets[i - 1];
    const recCurr = getRec(sheetCurr.raw);
    const recPrev = getRec(sheetPrev.raw);

    if (recCurr && hasNewAcademicActivity(recPrev, recCurr, academicUnits, courseType)) {
      return sheetCurr;
    }
  }

  // If no change occurred between any cuts, the activity dates to the earliest cut where student had started
  for (let i = 0; i <= currentCutIndex; i++) {
    const sheet = validSheets[i];
    const rec = getRec(sheet.raw);
    if (rec && hasAnyCourseActivity(rec)) {
      return sheet;
    }
  }

  return validSheets[0];
}

/**
 * Compares two cuts (or evaluates a single cut) strictly according to the mandatory priority rules:
 *
 * ORDEN DEFINITIVO DE CLASIFICACIÓN:
 * 1. 🔵 AZUL: TERMINÓ (Evaluación Final >= 80 Y Total_categoría >= 80, y en TUTORIZADO todas las unidades aprobadas)
 * 2. ⚫ NEGRO: REV. CALIF. (Evaluación de unidad, tarea o final < 80, excluyendo Evaluación Inicial)
 * 3. 🔴 ROJO: SIN INICIO (Nunca ha realizado ninguna actividad, incluida Evaluación Inicial)
 * 4. 🟢 VERDE: AVANZANDO (Completó al menos una nueva unidad entre los dos cortes)
 * 5. 🟡 PAUSA: PAUSA (Existe nueva actividad entre cortes, o corte del mismo día / reciente sin antigüedad para naranja)
 * 6. 🟠 SIN AVANCE: SIN AVANCE (Ya había iniciado y permanece sin cambios con antigüedad de inactividad >= 2 días)
 */
export function compareCuts(
  previousRecords: StudentAcademicRecord[] | null,
  currentRecords: StudentAcademicRecord[],
  previousDate: DateDDMMYY | null,
  currentDate: DateDDMMYY,
  academicUnits: AcademicUnit[],
  existingResolutions?: Record<string, TutorialResolution>,
  manualInsignias?: Record<string, InsigniaType>,
  historicalData?: {
    validSheets: DateDDMMYY[];
    allCutSheetsData: Record<string, StudentAcademicRecord[]>;
  },
  explicitCourseType?: import('../types').CourseType
): CutComparisonResult {
  const isSingleCut = previousRecords === null || previousDate === null;
  const diffDays = isSingleCut ? 0 : calculateDaysBetween(previousDate!.date, currentDate.date);

  const courseType: import('../types').CourseType =
    explicitCourseType ||
    (academicUnits.some((u) => u.tasks && u.tasks.length > 0) ? 'TUTORIZADO' : 'SEMITUTORIZADO');

  // Map previous records by normalized match key
  const prevMap = new Map<string, StudentAcademicRecord>();
  const prevUserSet = new Set<string>();
  if (previousRecords) {
    previousRecords.forEach((rec) => {
      const key = getMatchKey(rec);
      if (key) prevMap.set(key, rec);
      const u = (rec.usuario || '').trim().toLowerCase();
      if (u) prevUserSet.add(u);
    });
  }

  const processedStudents: ProcessedStudent[] = [];
  let newlyCompletedCount = 0;
  let newEnrollmentCount = 0;

  const counts = {
    rojo: 0,
    amarillo: 0,
    naranja: 0,
    verde: 0,
    azul: 0,
    negro: 0,
  };

  currentRecords.forEach((curr) => {
    const key = getMatchKey(curr);
    const prev = key ? prevMap.get(key) : undefined;

    // NUEVO INGRESO: Aparece en corte actual pero NO en el corte previo (solo con >= 2 cortes)
    const currUser = (curr.usuario || '').trim().toLowerCase();
    const isNewEnrollment = !isSingleCut && Boolean(currUser) && !prevUserSet.has(currUser);
    if (isNewEnrollment) {
      newEnrollmentCount += 1;
    }

    const previousUnit = prev ? prev.highestActiveUnit : 0;
    const currentUnit = curr.highestActiveUnit;
    const previousUnitKey = prev?.highestActiveUnitKey;
    const currentUnitKey = curr.highestActiveUnitKey;

    const previousCompletedUnit = getHighestCompletedUnit(prev, academicUnits, courseType);
    const currentCompletedUnit = getHighestCompletedUnit(curr, academicUnits, courseType);
    const previousCompletedUnitKey = prev?.highestCompletedUnitKey;
    const currentCompletedUnitKey = curr.highestCompletedUnitKey;

    const previousCompletedCount = getCompletedUnitsCount(prev, academicUnits, courseType);
    const currentCompletedCount = getCompletedUnitsCount(curr, academicUnits, courseType);

    const previousActivitiesCount = prev ? prev.totalCompletedActivities : 0;
    const currentActivitiesCount = curr.totalCompletedActivities;

    // Academic Positions
    const previousAcademicPosition = prev ? getAcademicPosition(prev, academicUnits, courseType) : 'Sin inicio';
    const currentAcademicPosition = getAcademicPosition(curr, academicUnits, courseType);

    // Activity check
    const hasStarted = hasAnyCourseActivity(curr);

    // Rule 1: 🔵 AZUL: TERMINÓ
    const isCompleted = isCourseCompleted(curr, academicUnits, courseType);
    const isPrevCompleted = prev ? isCourseCompleted(prev, academicUnits, courseType) : false;
    const newlyCompleted = !isPrevCompleted && isCompleted;
    if (newlyCompleted) {
      newlyCompletedCount += 1;
    }

    // Rule 2: Check for unit evaluation, task, or final evaluation issues (< 80) in CURRENT cut
    const failedUnitIssues = getFailedUnitEvaluations(curr, academicUnits);

    // Has new academic activity between previous and current cut
    const hasAnyNewActivity = hasNewAcademicActivity(prev, curr, academicUnits, courseType);

    // Build task records tracking for modal and inspection
    const taskRecords: Record<
      string,
      {
        header: string;
        unitKey: string;
        name: string;
        prevScore?: number | null;
        currScore?: number | null;
        isSubmitted: boolean;
        isApproved: boolean;
        changeStatus: 'new_submission' | 'score_increased' | 'score_decreased' | 'approved' | 'failed' | 'no_change';
      }
    > = {};

    if (courseType === 'TUTORIZADO') {
      academicUnits.forEach((u) => {
        if (u.tasks) {
          u.tasks.forEach((t) => {
            const prevScore = normalizeScore(prev?.taskScores?.[t.id] ?? prev?.taskScores?.[t.header]);
            const currScore = normalizeScore(curr.taskScores?.[t.id] ?? curr.taskScores?.[t.header]);
            const isSubmitted = currScore !== null;
            const isApproved = currScore !== null && currScore >= 80;

            let changeStatus:
              | 'new_submission'
              | 'score_increased'
              | 'score_decreased'
              | 'approved'
              | 'failed'
              | 'no_change' = 'no_change';

            if (prevScore === null && currScore !== null) {
              changeStatus = isApproved ? 'approved' : 'new_submission';
            } else if (prevScore !== null && currScore !== null) {
              if (currScore > prevScore) {
                changeStatus = 'score_increased';
              } else if (currScore < prevScore) {
                changeStatus = 'score_decreased';
              } else if (!isApproved && prevScore < 80) {
                changeStatus = 'failed';
              }
            }

            taskRecords[t.id] = {
              header: t.header,
              unitKey: t.unitKey,
              name: t.name,
              prevScore,
              currScore,
              isSubmitted,
              isApproved,
              changeStatus,
            };
          });
        }
      });
    }

    // STATE CLASSIFICATION (STRICT MANDATORY PRIORITY ORDER)
    let state: TutorialState;
    let stateLabel: string;
    let changeText = 'Sin cambios';
    let isNewInState = false;
    let changeEventText = '';

    // 1. 🔵 AZUL — TERMINÓ
    if (isCompleted) {
      state = 'AZUL';
      stateLabel = 'TERMINÓ';
      counts.azul += 1;
      changeText = newlyCompleted ? 'Evaluación Final aprobada' : 'Curso concluido';
      isNewInState = newlyCompleted;
      changeEventText = newlyCompleted
        ? `Terminó desde el último corte (EF: ${curr.evaluacionFinalScore}, Total: ${curr.totalCategoriaScore})`
        : 'Concluido en cortes previos';
    }
    // 2. ⚫ NEGRO — REV. CALIF. (Evaluación o Tarea < 80)
    else if (failedUnitIssues.length > 0) {
      state = 'NEGRO';
      stateLabel = 'REV. CALIF.';
      const issueDescriptions = failedUnitIssues
        .map((i) => `${i.activityName || `U${i.unitNumber}`}: ${i.score} pts`)
        .join(', ');
      changeText = `Calificación < 80 (${issueDescriptions})`;
      counts.negro += 1;

      const prevFailedIssues = prev ? getFailedUnitEvaluations(prev, academicUnits) : [];
      const prevHadIssue = prevFailedIssues.length > 0;
      isNewInState = !prevHadIssue;
      changeEventText = isNewInState
        ? `Nueva actividad que requiere revisión (${issueDescriptions})`
        : `Actividad < 80 (${issueDescriptions})`;
    }
    // 3. 🔴 ROJO — SIN INICIO
    else if (!hasStarted) {
      state = 'ROJO';
      stateLabel = 'SIN INICIO';
      changeText = 'Sin actividad registrada';
      counts.rojo += 1;
      isNewInState = !prev;
      changeEventText = 'Sin actividad registrada';
    }
    // Single-cut scenario (only 1 cut sheet)
    else if (isSingleCut) {
      state = 'INICIADO_PRIMER_CORTE';
      stateLabel = 'INICIADO';
      changeText = `Iniciado: ${currentAcademicPosition}`;
      isNewInState = false;
      changeEventText = `Iniciado en ${currentAcademicPosition}`;
    }
    // 4. 🟢 VERDE — AVANZANDO (AUMENTÓ EL NÚMERO DE UNIDADES COMPLETADAS)
    else if (currentCompletedCount > previousCompletedCount || currentCompletedUnit > previousCompletedUnit) {
      state = 'VERDE';
      stateLabel = 'AVANZANDO';

      if (!prev || previousAcademicPosition === 'Sin inicio') {
        changeText = `Sin inicio → ${currentAcademicPosition}`;
      } else {
        const unitCompletedLabel = currentCompletedUnitKey || `U${currentCompletedUnit}`;
        changeText = `${previousAcademicPosition} → ${currentAcademicPosition} (${unitCompletedLabel} completada)`;
      }

      counts.verde += 1;
      isNewInState = true;
      changeEventText = changeText;
    }
    // 5. 🟡 PAUSA — AMARILLO (Hubo actividad nueva, pero NO completó una unidad adicional)
    else if (hasAnyNewActivity) {
      state = 'AMARILLO';
      stateLabel = 'PAUSA';

      // Check for specific task submissions or score improvements
      const changedTask = Object.values(taskRecords).find(
        (tr) => tr.changeStatus === 'new_submission' || tr.changeStatus === 'approved' || tr.changeStatus === 'score_increased'
      );

      if (changedTask && changedTask.currScore !== null) {
        changeText = `${changedTask.name}: ${changedTask.currScore} pts · Avance en ${currentAcademicPosition}`;
      } else if (!prev || previousAcademicPosition === 'Sin inicio') {
        changeText = `Sin inicio → ${currentAcademicPosition}`;
      } else if (previousAcademicPosition !== currentAcademicPosition) {
        changeText = `${previousAcademicPosition} → ${currentAcademicPosition}`;
      } else {
        changeText = `Avance parcial: ${currentAcademicPosition}`;
      }

      counts.amarillo += 1;
      isNewInState = true;
      changeEventText = changeText;
    }
    // 6. 🟠 SIN AVANCE / 🟡 PAUSA (Sin cambios en el corte actual)
    else {
      let daysSinceLastActivity = diffDays;
      if (historicalData && historicalData.validSheets.length > 0) {
        const lastActSheet = findLastActivityDate(
          curr.usuario || curr.email || curr.nombreCompleto,
          historicalData.validSheets.findIndex((s) => s.raw === currentDate.raw),
          historicalData.validSheets,
          historicalData.allCutSheetsData,
          academicUnits,
          courseType
        );
        if (lastActSheet) {
          daysSinceLastActivity = calculateDaysBetween(lastActSheet.date, currentDate.date);
        }
      }

      // Regla 4: Un alumno de nuevo ingreso NUNCA debe clasificarse en 🟠 SIN AVANCE (NARANJA).
      // Si presenta actividad parcial, debe clasificarse en 🟡 PAUSA (AMARILLO).
      if (daysSinceLastActivity < 2 || isNewEnrollment) {
        state = 'AMARILLO';
        stateLabel = 'PAUSA';
        if (isNewEnrollment) {
          changeText =
            currentAcademicPosition && currentAcademicPosition !== 'Sin inicio'
              ? `Nuevo ingreso con avance parcial: ${currentAcademicPosition}`
              : 'Nuevo ingreso con avance parcial';
        } else if (daysSinceLastActivity === 0) {
          changeText =
            currentAcademicPosition && currentAcademicPosition !== 'Sin inicio'
              ? `Pausa reciente en ${currentAcademicPosition} (mismo día)`
              : 'Sin cambios en el corte actual';
        } else {
          changeText =
            currentAcademicPosition && currentAcademicPosition !== 'Sin inicio'
              ? `Pausa reciente en ${currentAcademicPosition}`
              : 'Pausa reciente (sin cambios entre cortes consecutivos)';
        }
        counts.amarillo += 1;
        isNewInState = isNewEnrollment ? true : false;
        changeEventText = changeText;
      } else {
        state = 'NARANJA';
        stateLabel = 'SIN AVANCE';

        if (currentAcademicPosition && currentAcademicPosition !== 'Sin inicio') {
          changeText = `Permanece en ${currentAcademicPosition} (${daysSinceLastActivity} días sin actividad)`;
        } else {
          changeText = `Sin avance (${daysSinceLastActivity} días sin actividad)`;
        }

        counts.naranja += 1;
        isNewInState = Boolean(prev && hasAnyCourseActivity(prev));
        changeEventText = changeText;
      }
    }

    let hasPendingEvaluation = false;
    let hasPendingTask = false;
    let hasPendingBoth = false;

    if (academicUnits && academicUnits.length > 0) {
      const activeUnit =
        academicUnits.find((u) => !isUnitCompleted(curr, u, courseType)) ||
        academicUnits.find((u) => u.unitKey === currentUnitKey || u.unitNumber === currentUnit) ||
        academicUnits[0];

      if (activeUnit) {
        const evalVal =
          curr.unitEvaluations[activeUnit.unitKey || ''] ??
          curr.unitEvaluations[activeUnit.unitLabel || ''] ??
          curr.unitEvaluations[activeUnit.unitNumber];
        const evalValid = hasValidNumericGrade(evalVal);
        const evalScore = normalizeScore(evalVal);
        const evalPending = !evalValid || evalScore === null;

        let taskPending = false;
        if (activeUnit.tasks && activeUnit.tasks.length > 0) {
          taskPending = activeUnit.tasks.some((t) => {
            const tVal = curr.taskScores?.[t.id] ?? curr.taskScores?.[t.header];
            const tScore = normalizeScore(tVal);
            return tScore === null;
          });
        }

        hasPendingEvaluation = evalPending;
        hasPendingTask = taskPending;
        hasPendingBoth = evalPending && taskPending;
      }
    }

    const interventionInfo = getInterventionDetails(state);
    const firstName = getStudentFirstName(curr);
    const personalizedMsg = generatePersonalizedMessage(firstName, state, {
      currentUnit,
      currentUnitKey,
      changeDetected: changeText,
      issues: failedUnitIssues,
      hasPendingEvaluation,
      hasPendingTask,
      hasPendingBoth,
    });

    // Insignia classification (honoring manual correction first)
    const manualIns = manualInsignias ? manualInsignias[curr.usuario] : undefined;
    const insignia: InsigniaType = manualIns || inferInsignia(curr.nombre, curr.nombreCompleto);
    const isManualInsignia = Boolean(manualIns);

    // Tutorial resolution for students with academic issue / NEGRO
    let tutorialResolution: TutorialResolutionType | undefined = undefined;
    let tutorialResolutionData: TutorialResolution | undefined = undefined;

    if (state === 'NEGRO') {
      const res = existingResolutions ? existingResolutions[curr.usuario] : undefined;
      const currentFailedIssue = failedUnitIssues.length > 0 ? failedUnitIssues[0] : null;
      if (res) {
        const sameUnit =
          !res.issueUnit ||
          !currentFailedIssue ||
          res.issueUnit === currentFailedIssue.unitNumber;

        if (sameUnit) {
          tutorialResolution =
            res.resolution === 'Reprobó'
              ? 'N.A'
              : (res.resolution as TutorialResolutionType);
          tutorialResolutionData = res;
        } else {
          tutorialResolution = 'Pendiente de revisión';
        }
      } else {
        tutorialResolution = 'Pendiente de revisión';
      }
    } else {
      const res = existingResolutions ? existingResolutions[curr.usuario] : undefined;
      if (res) {
        tutorialResolutionData = res;
      }
    }

    processedStudents.push({
      usuario: curr.usuario,
      nombre: curr.nombre,
      apellidos: curr.apellidos,
      nombreCompleto: curr.nombreCompleto,
      email: curr.email,
      ciudad: curr.ciudad,
      departamento: curr.departamento,
      previousUnit,
      currentUnit,
      previousUnitKey,
      currentUnitKey,
      previousCompletedUnit,
      currentCompletedUnit,
      previousCompletedUnitKey,
      currentCompletedUnitKey,
      previousAcademicPosition,
      currentAcademicPosition,
      previousActivitiesCount,
      currentActivitiesCount,
      state,
      stateLabel,
      changeDetected: changeText,
      recommendedIntervention: interventionInfo.objective,
      personalizedMessage: personalizedMsg,
      issues: failedUnitIssues,
      isCompleted,
      hasStarted,
      newlyCompleted,
      isNewInState,
      changeEventText,
      courseType,
      tasksSummary: curr.tasksSummary,
      taskRecords,
      tutorialResolution,
      tutorialResolutionData,
      insignia,
      isManualInsignia,
      previousRecord: prev,
      currentRecord: curr,
      isNewEnrollment,
    });
  });

  const total = processedStudents.length;

  const percentages = {
    rojo: total > 0 ? (counts.rojo / total) * 100 : 0,
    amarillo: total > 0 ? (counts.amarillo / total) * 100 : 0,
    naranja: total > 0 ? (counts.naranja / total) * 100 : 0,
    verde: total > 0 ? (counts.verde / total) * 100 : 0,
    azul: total > 0 ? (counts.azul / total) * 100 : 0,
    negro: total > 0 ? (counts.negro / total) * 100 : 0,
  };

  return {
    previousSheetName: previousDate?.raw,
    previousDate: previousDate || undefined,
    currentSheetName: currentDate.raw,
    currentDate,
    diffDays,
    isSingleCut,
    courseType,
    students: processedStudents,
    totalStudents: total,
    newlyCompletedCount,
    newEnrollmentCount,
    counts,
    percentages,
  };
}

/**
 * Calculates a student's chronological trajectory across all available cuts.
 */
/**
 * Calculates a student's chronological trajectory across all available cuts.
 */
export function calculateStudentTrajectory(
  studentKey: string, // usuario, email or nombreCompleto
  validSheets: DateDDMMYY[],
  allCutSheetsData: Record<string, StudentAcademicRecord[]>,
  academicUnits: AcademicUnit[],
  courseType?: import('../types').CourseType,
  currentStudent?: import('../types').ProcessedStudent
): import('../types').TrajectoryStep[] {
  if (!validSheets || validSheets.length === 0) return [];

  const normalizedTarget = studentKey.trim().toLowerCase();
  const steps: import('../types').TrajectoryStep[] = [];

  for (let i = 0; i < validSheets.length; i++) {
    const sheet = validSheets[i];
    const sheetData = allCutSheetsData[sheet.raw] || [];
    const currentRec = sheetData.find((s) => {
      if (s.usuario && s.usuario.trim().toLowerCase() === normalizedTarget) return true;
      if (s.email && s.email.trim().toLowerCase() === normalizedTarget) return true;
      if (s.nombreCompleto && s.nombreCompleto.trim().toLowerCase() === normalizedTarget) return true;
      return false;
    });

    if (!currentRec) continue;

    const dayStr = String(sheet.day).padStart(2, '0');
    const monthStr = String(sheet.month).padStart(2, '0');
    const dateShort = `${dayStr}/${monthStr} C${sheet.cutNumber || 1}`;
    const dateFormatted = sheet.displayLabel || `${sheet.formatted} · Corte ${sheet.cutNumber || 1}`;
    let academicPosition = getAcademicPosition(currentRec, academicUnits, courseType);

    let state: TutorialState;
    let stateLabel: string;
    let colorEmoji: string;

    if (i === 0) {
      // First cut: calculate absolute states
      const isCompleted = isCourseCompleted(currentRec, academicUnits, courseType);
      const failedIssues = getFailedUnitEvaluations(currentRec, academicUnits);
      const hasStarted = hasAnyCourseActivity(currentRec);

      if (isCompleted) {
        state = 'AZUL';
        stateLabel = 'TERMINÓ';
        colorEmoji = '🔵';
      } else if (failedIssues.length > 0) {
        state = 'NEGRO';
        stateLabel = 'REV. CALIF.';
        colorEmoji = '⚫';
      } else if (!hasStarted) {
        state = 'ROJO';
        stateLabel = 'SIN INICIO';
        colorEmoji = '🔴';
      } else {
        state = 'INICIADO_PRIMER_CORTE';
        stateLabel = 'INICIADO';
        colorEmoji = '⚪';
      }
    } else {
      const prevSheet = validSheets[i - 1];
      const prevData = allCutSheetsData[prevSheet.raw] || [];
      const prevRec = prevData.find((s) => {
        if (s.usuario && s.usuario.trim().toLowerCase() === normalizedTarget) return true;
        if (s.email && s.email.trim().toLowerCase() === normalizedTarget) return true;
        if (s.nombreCompleto && s.nombreCompleto.trim().toLowerCase() === normalizedTarget) return true;
        return false;
      });

      const comp = compareCuts(
        prevRec ? [prevRec] : null,
        [currentRec],
        prevSheet,
        sheet,
        academicUnits,
        undefined,
        undefined,
        {
          validSheets: validSheets.slice(0, i + 1),
          allCutSheetsData,
        },
        courseType
      );
      const studentResult = comp.students[0];
      state = studentResult.state;
      stateLabel = studentResult.stateLabel;

      switch (state) {
        case 'ROJO':
          colorEmoji = '🔴';
          break;
        case 'AMARILLO':
          colorEmoji = '🟡';
          break;
        case 'NARANJA':
          colorEmoji = '🟠';
          break;
        case 'VERDE':
          colorEmoji = '🟢';
          break;
        case 'AZUL':
          colorEmoji = '🔵';
          break;
        case 'NEGRO':
          colorEmoji = '⚫';
          break;
        default:
          colorEmoji = '⚪';
      }
    }

    // Unify state across sections: ensure the last step matches currentStudent's state exactly
    if (currentStudent && i === validSheets.length - 1) {
      state = currentStudent.state;
      stateLabel = currentStudent.stateLabel;
      academicPosition = currentStudent.currentAcademicPosition || academicPosition;
      switch (state) {
        case 'ROJO':
          colorEmoji = '🔴';
          break;
        case 'AMARILLO':
          colorEmoji = '🟡';
          break;
        case 'NARANJA':
          colorEmoji = '🟠';
          break;
        case 'VERDE':
          colorEmoji = '🟢';
          break;
        case 'AZUL':
          colorEmoji = '🔵';
          break;
        case 'NEGRO':
          colorEmoji = '⚫';
          break;
        default:
          colorEmoji = '⚪';
      }
    }

    steps.push({
      sheetRaw: sheet.raw,
      dateShort,
      dateFormatted,
      state,
      stateLabel,
      colorEmoji,
      academicPosition,
    });
  }

  return steps;
}

/**
 * Builds chronological history comparison across all cuts in the workbook.
 */
export function buildHistoricalSteps(
  validSheets: DateDDMMYY[],
  allCutSheetsData: Record<string, StudentAcademicRecord[]>,
  academicUnits: AcademicUnit[],
  courseType?: import('../types').CourseType
): HistoricalCutStep[] {
  if (validSheets.length < 2) {
    return [];
  }

  const history: HistoricalCutStep[] = [];

  for (let i = 1; i < validSheets.length; i++) {
    const prevSheet = validSheets[i - 1];
    const currSheet = validSheets[i];

    const prevData = allCutSheetsData[prevSheet.raw] || [];
    const currData = allCutSheetsData[currSheet.raw] || [];

    const comparison = compareCuts(
      prevData,
      currData,
      prevSheet,
      currSheet,
      academicUnits,
      undefined,
      undefined,
      {
        validSheets: validSheets.slice(0, i + 1),
        allCutSheetsData,
      },
      courseType
    );

    history.push({
      fromSheet: prevSheet.raw,
      fromDate: prevSheet.displayLabel || `${prevSheet.formatted} · Corte ${prevSheet.cutNumber || 1}`,
      toSheet: currSheet.raw,
      toDate: currSheet.displayLabel || `${currSheet.formatted} · Corte ${currSheet.cutNumber || 1}`,
      diffDays: comparison.diffDays,
      counts: comparison.counts,
      totalStudents: comparison.totalStudents,
      advancements: comparison.counts.verde + comparison.counts.azul,
      newEnrollmentCount: comparison.newEnrollmentCount || 0,
    });
  }

  return history;
}
