export type CourseType = 'TUTORIZADO' | 'SEMITUTORIZADO';

export type TutorialState = 'ROJO' | 'AMARILLO' | 'NARANJA' | 'VERDE' | 'AZUL' | 'NEGRO' | 'INICIADO_PRIMER_CORTE';

export interface DateDDMMYY {
  raw: string; // original sheet name, e.g. "030826", "131026-2", "131026 - 1"
  dateDigits?: string; // 6-digit date string, e.g. "131026"
  day: number;
  month: number;
  year: number; // e.g. 2026
  date: Date;
  formatted: string; // "03/08/2026"
  cutNumber: number; // 1, 2, 3, etc.
  sortKey: string; // e.g. "20261013_00001" for chronological sorting
  displayLabel?: string; // e.g. "13/10/2026 · Corte 1"
}

export interface AcademicTask {
  id: string; // unique key, e.g. "tarea_m1_u1"
  header: string; // original column header, e.g. "Tarea:M1-U1"
  moduleNumber?: number; // e.g. 1
  unitNumber: number; // e.g. 1
  unitKey: string; // composite key e.g. "M1-U1" or "U1"
  name: string; // display name e.g. "Tarea M1-U1"
  isRequired?: boolean;
}

export interface AcademicUnit {
  unitNumber: number;
  moduleNumber?: number;
  unitKey: string; // composite key "M1-U1" or "U1"
  unitLabel: string; // display label e.g. "M1-U1" or "U1"
  scorms: SCORMResource[];
  tasks?: AcademicTask[];
  unitEvaluationColumn?: string;
}

export interface SCORMResource {
  unitNumber: number;
  moduleNumber?: number;
  unitKey?: string;
  topicNumber: number;
  name: string;
  columnHeader: string;
}

export interface CourseMetadata {
  name: string;
  startDate: string; // "YYYY-MM-DD" or "DD/MM/YYYY"
  endDate: string;
  fileName?: string;
  totalDays: number;
  daysElapsed: number;
  daysRemaining: number;
  percentageElapsed: number;
  courseType?: CourseType;
}

export interface TasksSummary {
  totalTasks: number;
  submittedTasks: number;
  approvedTasks: number;
  failedTasks: number;
  pendingTasks: number;
}

export interface StudentAcademicRecord {
  usuario: string;
  nombre: string;
  apellidos: string;
  nombreCompleto: string;
  email: string;
  ciudad: string;
  departamento: string;
  
  // Dynamic fields
  evaluacionInicial?: number | string | null;
  evaluacionFinal?: number | string | null;
  evaluacionFinalScore?: number | null;
  totalCategoria?: number | string | null;
  totalCategoriaScore?: number | null;
  unitEvaluations: Record<string, number | string | null>; // unitKey or unitNumber -> score
  scormProgress: Record<string, boolean>; // columnHeader or `U${u}-T${t}` -> boolean
  taskScores?: Record<string, number | string | null>; // task.id or header -> score / percentage
  taskScoresNormalized?: Record<string, number | null>; // numeric 0-100 or null
  tasksSummary?: TasksSummary;
  
  highestActiveUnit: number;
  highestActiveUnitKey?: string;
  completedUnitsCount: number;
  highestCompletedUnit: number;
  highestCompletedUnitKey?: string;
  totalCompletedActivities: number;
}

export interface StudentEvaluationIssue {
  unitNumber: number;
  moduleNumber?: number;
  unitKey?: string;
  formattedIdentifier?: string; // e.g. "U_M2-U1", "U1"
  activityName?: string; // e.g. "Tarea U_M2-U3", "Evaluación U_M1-U1"
  score: number;
  type?: 'unit' | 'final' | 'total' | 'task';
}

export type TutorialResolutionType =
  | 'Pendiente de revisión'
  | 'Segundo intento otorgado'
  | 'Reprobó'
  | 'N.A';

export interface TutorialResolution {
  id?: string; // `${courseId}_${usuario}`
  courseId: string;
  usuario: string;
  resolution: TutorialResolutionType;
  resolutionDate: string;
  issueUnit?: number;
  issueScore?: number;
  evaluationId?: string;
}

export type InsigniaType = 'MUJER' | 'HOMBRE' | 'REVISION';

export interface InsigniaRecord {
  id?: string; // `${courseId}_${usuario}`
  courseId: string;
  usuario: string;
  insignia: InsigniaType;
  isManual: boolean;
  updatedAt: string;
}

export interface ProcessedStudent {
  usuario: string;
  nombre: string;
  apellidos: string;
  nombreCompleto: string;
  email: string;
  ciudad: string;
  departamento: string;
  
  previousUnit: number;
  currentUnit: number;
  previousUnitKey?: string;
  currentUnitKey?: string;
  previousCompletedUnit: number;
  currentCompletedUnit: number;
  previousCompletedUnitKey?: string;
  currentCompletedUnitKey?: string;
  previousAcademicPosition: string;
  currentAcademicPosition: string;
  previousActivitiesCount: number;
  currentActivitiesCount: number;
  
  state: TutorialState;
  stateLabel: string;
  changeDetected: string;
  recommendedIntervention: string;
  personalizedMessage: string;
  
  issues: StudentEvaluationIssue[];
  isCompleted: boolean;
  hasStarted: boolean;
  newlyCompleted?: boolean;
  isNewInState?: boolean;
  changeEventText?: string;
  
  // Modality & Task breakdown
  courseType?: CourseType;
  tasksSummary?: TasksSummary;
  taskRecords?: Record<string, {
    header: string;
    unitKey: string;
    name: string;
    prevScore?: number | null;
    currScore?: number | null;
    isSubmitted: boolean;
    isApproved: boolean;
    changeStatus: 'new_submission' | 'score_increased' | 'score_decreased' | 'approved' | 'failed' | 'no_change';
  }>;
  
  // Tutorial Resolution & Insignia
  tutorialResolution?: TutorialResolutionType;
  tutorialResolutionData?: TutorialResolution;
  insignia: InsigniaType;
  isManualInsignia?: boolean;
  isManualMessage?: boolean;
  manualMessage?: string;
  
  // Raw records for deep inspection modal
  previousRecord?: StudentAcademicRecord;
  currentRecord: StudentAcademicRecord;

  // NUEVO INGRESO: Alumno incorporado en el corte actual que no aparecía en el corte previo
  isNewEnrollment?: boolean;
}

export interface TrajectoryStep {
  sheetRaw: string;
  dateShort: string; // e.g. "04/08"
  dateFormatted: string; // e.g. "04/08/2026"
  state: TutorialState;
  stateLabel: string;
  colorEmoji: string;
  academicPosition: string;
}

export interface CourseSummary {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  lastCutSheet: string;
  lastCutDateFormatted: string;
  totalStudents: number;
  lastUpdated: string;
  courseType?: CourseType;
}

export interface CutSheetInfo {
  sheetName: string;
  dateInfo: DateDDMMYY;
  totalStudents: number;
  academicUnits: AcademicUnit[];
}

export interface CutComparisonResult {
  previousSheetName?: string;
  previousDate?: DateDDMMYY;
  currentSheetName: string;
  currentDate: DateDDMMYY;
  diffDays: number;
  isSingleCut: boolean;
  courseType?: CourseType;
  
  students: ProcessedStudent[];
  totalStudents: number;
  newlyCompletedCount: number;
  newEnrollmentCount?: number;
  
  counts: {
    rojo: number;
    amarillo: number;
    naranja: number;
    verde: number;
    azul: number;
    negro: number;
  };
  
  percentages: {
    rojo: number;
    amarillo: number;
    naranja: number;
    verde: number;
    azul: number;
    negro: number;
  };
}

export interface HistoricalCutStep {
  fromSheet: string;
  fromDate: string;
  toSheet: string;
  toDate: string;
  diffDays: number;
  counts: {
    rojo: number;
    amarillo: number;
    naranja: number;
    verde: number;
    azul: number;
    negro: number;
  };
  totalStudents: number;
  advancements: number;
  newEnrollmentCount?: number;
}

export interface CourseState {
  id: string; // unique identifier for the course in multi-course storage
  courseMetadata: CourseMetadata;
  validSheets: DateDDMMYY[];
  academicUnits: AcademicUnit[];
  allCutSheetsData: Record<string, StudentAcademicRecord[]>;
  currentComparison: CutComparisonResult;
  history: HistoricalCutStep[];
  tutorialResolutions?: Record<string, TutorialResolution>; // key: usuario
  manualInsignias?: Record<string, InsigniaType>; // key: usuario
  lastUpdated: string;
  courseType?: CourseType;
}

export interface BackupPayload {
  version: string;
  createdAt: string;
  courseState: CourseState;
}
