import React, { useState, useMemo } from 'react';
import {
  AcademicUnit,
  DateDDMMYY,
  InsigniaType,
  ProcessedStudent,
  StudentAcademicRecord,
  TrajectoryStep,
  TutorialResolutionType,
} from '../types';
import {
  calculateStudentTrajectory,
  normalizeScore,
  hasValidUnitEvaluation,
  formatAcademicUnitIdentifier,
  calculateDaysBetween,
  getUnitAcademicStatus,
} from '../utils/excelParser';
import { getStudentPersonalizedMessage } from '../utils/messages';
import { Copy, Check, X, User, MapPin, Building, Mail, ChevronRight, AlertTriangle, CheckCircle2, ShieldAlert, Edit2, RotateCcw } from 'lucide-react';
import { FemaleSymbol, MaleSymbol, RevisionSymbol } from './InsigniaIcons';

interface StudentDetailModalProps {
  student: ProcessedStudent;
  academicUnits: AcademicUnit[];
  validSheets?: DateDDMMYY[];
  allCutSheetsData?: Record<string, StudentAcademicRecord[]>;
  previousDate?: DateDDMMYY;
  currentDate?: DateDDMMYY;
  onUpdateResolution?: (usuario: string, resolution: TutorialResolutionType) => Promise<void> | void;
  onUpdateInsignia?: (usuario: string, insignia: InsigniaType) => Promise<void> | void;
  onUpdateMessage?: (usuario: string, message: string, isManual: boolean) => Promise<void> | void;
  onClose: () => void;
}

export const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
  student,
  academicUnits,
  validSheets = [],
  allCutSheetsData = {},
  previousDate,
  currentDate,
  onUpdateResolution,
  onUpdateInsignia,
  onUpdateMessage,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const activeMessage = useMemo(() => getStudentPersonalizedMessage(student), [student]);
  const [isEditingMessage, setIsEditingMessage] = useState(false);
  const [editedText, setEditedText] = useState(activeMessage);

  React.useEffect(() => {
    setEditedText(activeMessage);
    setIsEditingMessage(false);
  }, [student.usuario, activeMessage]);

  const handleCopy = () => {
    navigator.clipboard.writeText(isEditingMessage ? editedText : activeMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const curr = student.currentRecord;
  const prev = student.previousRecord;

  // Calculate chronological trajectory
  const trajectory: TrajectoryStep[] = useMemo(() => {
    return calculateStudentTrajectory(
      student.usuario || student.email || student.nombreCompleto,
      validSheets,
      allCutSheetsData,
      academicUnits,
      student.courseType,
      student
    );
  }, [student, validSheets, allCutSheetsData, academicUnits]);

  const isNA =
    student.state === 'NEGRO' &&
    (student.tutorialResolution === 'N.A' || student.tutorialResolution === 'Reprobó');
  const isSegundoIntento =
    student.state === 'NEGRO' &&
    student.tutorialResolution === 'Segundo intento otorgado';

  const isSingleCut = !prev || !previousDate;
  const diffDays = useMemo(() => {
    if (isSingleCut || !previousDate || !currentDate) return 0;
    return calculateDaysBetween(previousDate.date, currentDate.date);
  }, [isSingleCut, previousDate, currentDate]);

  const isTutorizado =
    student.courseType === 'TUTORIZADO' ||
    Boolean(academicUnits && academicUnits.some((u) => u.tasks && u.tasks.length > 0));

  // Determine if student has any valid recorded numeric unit evaluation grade (0 counts as valid!)
  const hasAnyValidUnitEvaluationGrade = useMemo(() => {
    if (!curr.unitEvaluations) return false;
    return Object.values(curr.unitEvaluations).some((val) => hasValidUnitEvaluation(val));
  }, [curr.unitEvaluations]);

  const hasAnyTaskGrade = useMemo(() => {
    if (!curr.taskScoresNormalized && !curr.taskScores) return false;
    const fromNorm =
      curr.taskScoresNormalized &&
      Object.values(curr.taskScoresNormalized).some((v) => typeof v === 'number');
    if (fromNorm) return true;
    return curr.taskScores ? Object.values(curr.taskScores).some((v) => normalizeScore(v) !== null) : false;
  }, [curr.taskScoresNormalized, curr.taskScores]);

  const showUnitEvaluationsSection = useMemo(() => {
    if (isTutorizado) {
      return hasAnyValidUnitEvaluationGrade || hasAnyTaskGrade || (student.issues && student.issues.length > 0);
    }
    return hasAnyValidUnitEvaluationGrade;
  }, [isTutorizado, hasAnyValidUnitEvaluationGrade, hasAnyTaskGrade, student.issues]);

  const getStateBadgeStyle = (state: string) => {
    switch (state) {
      case 'AZUL':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'VERDE':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'AMARILLO':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'NARANJA':
        return 'bg-orange-100 text-orange-900 border-orange-300';
      case 'ROJO':
        return 'bg-rose-100 text-rose-900 border-rose-300';
      case 'NEGRO':
        if (isNA) {
          return 'bg-purple-700 text-white border-purple-800 shadow-sm';
        }
        return 'bg-slate-900 text-white border-slate-950';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const getStateBadgeLabel = () => {
    if (student.state === 'NEGRO') {
      if (isNA) return 'REV. CALIF. · N.A';
      if (isSegundoIntento) return 'REV. CALIF. · 2.º INTENTO';
      return 'REV. CALIF.';
    }
    return student.stateLabel;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/80 w-full max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#002855] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#00d1b2] font-bold shadow-inner">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white leading-tight">
                  {student.nombreCompleto || `${student.nombre} ${student.apellidos}`}
                </h3>
                {student.isNewEnrollment && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-2xs"
                    style={{ backgroundColor: '#7F1D1D' }}
                  >
                    <span>🚨</span>
                    <span>NUEVO INGRESO</span>
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-300 flex items-center gap-2 mt-0.5">
                <span className="font-mono text-[11px] text-[#00d1b2]">
                  {student.usuario}
                </span>
                <span>•</span>
                <span>{student.email}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-700">
          {/* 1. DATOS DEL ALUMNO */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[11px]">
              1. DATOS DEL ALUMNO
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 shadow-2xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Nombre Completo</span>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  <span className="font-bold text-slate-900 text-xs block">
                    {student.nombreCompleto || `${student.nombre} ${student.apellidos}`}
                  </span>
                  {student.isNewEnrollment && (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold text-white shadow-2xs"
                      style={{ backgroundColor: '#7F1D1D' }}
                    >
                      <span>🚨</span>
                      <span>NUEVO INGRESO</span>
                    </span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Usuario</span>
                <span className="font-mono font-semibold text-slate-800 text-xs mt-0.5 block">
                  {student.usuario}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Dirección Email</span>
                <span className="text-slate-700 text-xs mt-0.5 block truncate">
                  {student.email || 'No registrado'}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Ubicación / Dependencia</span>
                <span className="text-slate-700 text-xs mt-0.5 block">
                  {[student.ciudad, student.departamento].filter(Boolean).join(' • ') || 'No especificado'}
                </span>
              </div>

              {/* Insignia Row */}
              <div className="sm:col-span-2 pt-2.5 border-t border-slate-200/60 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Clasificación de Insignia</span>
                  <div className="flex items-center gap-2 mt-1">
                    {student.insignia === 'MUJER' && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-md">
                        <FemaleSymbol size={18} className="text-red-600" />
                        <span>MUJER</span>
                      </span>
                    )}
                    {student.insignia === 'HOMBRE' && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md">
                        <MaleSymbol size={18} className="text-blue-600" />
                        <span>HOMBRE</span>
                      </span>
                    )}
                    {(!student.insignia || student.insignia === 'REVISION') && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2.5 py-0.5 rounded-md">
                        <RevisionSymbol size={12} className="text-amber-500" />
                        <span>REVISIÓN</span>
                      </span>
                    )}
                    {student.isManualInsignia && (
                      <span className="text-[10px] text-slate-400 italic">(corregida manualmente)</span>
                    )}
                  </div>
                </div>

                {onUpdateInsignia && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 font-semibold mr-1">Corregir:</span>
                    <button
                      type="button"
                      onClick={() => onUpdateInsignia(student.usuario, 'MUJER')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        student.insignia === 'MUJER'
                          ? 'bg-red-600 text-white border-red-700 shadow-2xs'
                          : 'bg-white text-red-600 border-red-200 hover:bg-red-50'
                      }`}
                    >
                      <FemaleSymbol size={16} className={student.insignia === 'MUJER' ? 'text-white' : 'text-red-600'} />
                      <span>Mujer</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateInsignia(student.usuario, 'HOMBRE')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        student.insignia === 'HOMBRE'
                          ? 'bg-blue-600 text-white border-blue-700 shadow-2xs'
                          : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'
                      }`}
                    >
                      <MaleSymbol size={16} className={student.insignia === 'HOMBRE' ? 'text-white' : 'text-blue-600'} />
                      <span>Hombre</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateInsignia(student.usuario, 'REVISION')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        student.insignia === 'REVISION'
                          ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                          : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
                      }`}
                    >
                      <RevisionSymbol size={10} className={student.insignia === 'REVISION' ? 'text-white' : 'text-amber-500'} />
                      <span>Revisión</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2. ESTADO ACTUAL */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[11px]">
              2. ESTADO ACTUAL
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 shadow-2xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Estado</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStateBadgeStyle(student.state)}`}>
                    {getStateBadgeLabel()}
                  </span>
                  {(student.isNewInState || (student.state === 'AZUL' && student.newlyCompleted)) && (
                    <span className="px-1.5 py-0.2 rounded bg-slate-900 text-[#00d1b2] text-[9px] font-bold">
                      NUEVO
                    </span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Punto académico previo</span>
                <span className="font-bold text-xs text-slate-600 mt-0.5 block">
                  {student.previousAcademicPosition || '-'}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Punto académico actual</span>
                <span className="font-bold text-xs text-slate-900 mt-0.5 block">
                  {student.currentAcademicPosition || 'Sin inicio'}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Última unidad terminada</span>
                <span className="font-semibold text-xs text-slate-800 mt-0.5 block">
                  {student.currentCompletedUnitKey
                    ? formatAcademicUnitIdentifier(student.currentCompletedUnitKey)
                    : student.currentCompletedUnit > 0
                    ? `U${student.currentCompletedUnit}`
                    : 'Ninguna'}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Unidad de actividad</span>
                <span className="font-semibold text-xs text-slate-700 mt-0.5 block">
                  {student.currentUnitKey
                    ? formatAcademicUnitIdentifier(student.currentUnitKey)
                    : student.currentUnit > 0
                    ? `U${student.currentUnit}`
                    : 'Sin iniciar'}
                </span>
              </div>

              {student.courseType === 'TUTORIZADO' && student.tasksSummary && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Seguimiento de tareas</span>
                  <span className="font-bold text-xs text-indigo-900 mt-0.5 block">
                    {student.tasksSummary.approvedTasks} / {student.tasksSummary.totalTasks} aprobadas
                    {student.tasksSummary.pendingTasks > 0 && ` (${student.tasksSummary.pendingTasks} pendientes)`}
                  </span>
                </div>
              )}

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Cambio detectado</span>
                <span className="font-bold text-xs text-slate-900 mt-0.5 block">
                  {student.changeEventText || student.changeDetected}
                </span>
              </div>

              <div className="sm:col-span-3 pt-2 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Fecha corte previo</span>
                  <span className="text-slate-600 text-xs mt-0.5 block">
                    {previousDate ? previousDate.displayLabel || previousDate.formatted : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Fecha corte actual</span>
                  <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                    {currentDate ? currentDate.displayLabel || currentDate.formatted : '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* RESOLUCIÓN TUTORIAL (Para alumnos con estado académico NEGRO) */}
          {student.state === 'NEGRO' && (
            <div className="space-y-3 p-4 bg-slate-50/90 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                    RESOLUCIÓN TUTORIAL
                  </h4>
                  {isSegundoIntento && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      SEGUNDO INTENTO OTORGADO
                    </span>
                  )}
                  {isNA && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                      CASO ATENDIDO
                    </span>
                  )}
                  {(!student.tutorialResolution || student.tutorialResolution === 'Pendiente de revisión') && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      PENDIENTE DE REVISIÓN
                    </span>
                  )}
                </div>

                {student.tutorialResolutionData?.resolutionDate && (
                  <span className="text-[10px] text-slate-500 font-medium">
                    Registrado: {new Date(student.tutorialResolutionData.resolutionDate).toLocaleDateString('es-MX')}
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-slate-200/70">
                <div className="flex-1">
                  <p className="text-xs text-slate-800 font-medium">
                    Actividad que motiva la revisión:{' '}
                    <strong className="text-slate-900 font-bold">
                      {student.issues && student.issues.length > 0
                        ? student.issues
                            .map((i) => {
                              const label = i.formattedIdentifier || formatAcademicUnitIdentifier(i.unitKey, i.unitNumber, i.moduleNumber);
                              const actType = i.type === 'task' ? 'Tarea' : i.type === 'final' ? 'Eval. Final' : 'Evaluación';
                              return `${actType} ${label} (${i.score} pts)`;
                            })
                            .join(', ')
                        : 'Calificación de actividad < 80'}
                    </strong>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Seleccione manualmente la resolución tutorial tomada para este alumno.
                  </p>
                </div>

                <div className="shrink-0">
                  <select
                    id="select-resolucion-tutorial"
                    value={
                      student.tutorialResolution === 'Reprobó'
                        ? 'N.A'
                        : (student.tutorialResolution || 'Pendiente de revisión')
                    }
                    onChange={(e) => {
                      if (onUpdateResolution) {
                        onUpdateResolution(student.usuario, e.target.value as TutorialResolutionType);
                      }
                    }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#002855] focus:border-[#002855] shadow-2xs cursor-pointer"
                  >
                    <option value="Pendiente de revisión">1. Pendiente de revisión</option>
                    <option value="Segundo intento otorgado">2. Segundo intento otorgado</option>
                    <option value="N.A">3. N.A</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 3. TRAYECTORIA */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[11px]">
                3. TRAYECTORIA
              </h4>
              <span className="text-[10px] text-slate-400">
                Evolución a través de los cortes
              </span>
            </div>

            <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 shadow-2xs">
              {trajectory.length === 0 ? (
                <span className="text-xs text-slate-400 italic">
                  Solo se dispone de 1 corte registrado en este curso.
                </span>
              ) : (
                <div className="flex items-stretch gap-2 flex-wrap">
                  {trajectory.map((step, idx) => {
                    const isLast = idx === trajectory.length - 1;
                    return (
                      <React.Fragment key={step.sheetRaw}>
                        <div
                          className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs shadow-2xs transition-all ${
                            isLast
                              ? 'bg-white border-[#002855] text-slate-900 ring-2 ring-[#002855]/20 font-bold'
                              : 'bg-white/90 border-slate-200 text-slate-700'
                          }`}
                          title={`Corte: ${step.dateFormatted} | Estado: ${step.stateLabel} | Posición: ${step.academicPosition}`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 font-mono text-[11px] font-semibold">{step.dateShort}</span>
                            <span>{step.colorEmoji}</span>
                            <span className="text-[10px] uppercase font-bold text-slate-700">
                              {step.stateLabel}
                            </span>
                          </div>
                          <span className="text-[10px] font-medium text-slate-500 mt-1 max-w-[130px] truncate text-center">
                            {step.academicPosition || 'Sin inicio'}
                          </span>
                        </div>
                        {!isLast && (
                          <div className="flex items-center text-slate-400 text-xs font-bold px-0.5">
                            →
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 4. EVALUACIONES */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[11px]">
              4. EVALUACIONES
            </h4>
            <div className={`grid gap-2.5 ${isTutorizado ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
              {/* Evaluacion Inicial: ONLY for SEMITUTORIZADO (hidden in TUTORIZADO) */}
              {!isTutorizado && (
                <div className="p-3 rounded-xl border border-slate-200/80 bg-white/90 shadow-2xs">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
                    Evaluación Inicial
                  </span>
                  <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                    {curr.evaluacionInicial !== null && curr.evaluacionInicial !== undefined
                      ? String(curr.evaluacionInicial)
                      : 'No realizada'}
                  </span>
                </div>
              )}

              {/* Evaluacion Final */}
              <div className="p-3 rounded-xl border border-slate-200/80 bg-white/90 shadow-2xs">
                <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
                  Evaluación Final
                </span>
                <span
                  className={`font-bold text-sm mt-0.5 block ${
                    curr.evaluacionFinalScore !== null && curr.evaluacionFinalScore !== undefined && curr.evaluacionFinalScore >= 80
                      ? 'text-emerald-700 font-bold'
                      : 'text-slate-800'
                  }`}
                >
                  {curr.evaluacionFinal ? String(curr.evaluacionFinal) : 'Pendiente'}
                </span>
              </div>

              {/* Evaluaciones de Unidad:
                  - En SEMITUTORIZADO: se muestra ÚNICAMENTE si existe al menos una calificación válida registrada (incluyendo 0). Si no hay registros válidos, se oculta completamente sin recuadros vacíos.
                  - En TUTORIZADO: se muestra si existen calificaciones de evaluación o tareas registradas, o si hay incidencias.
                  - Muestra TODAS las unidades identificadas en el curso (ej. U1..U7).
                  - Las unidades sin calificación se muestran con 'Pendiente' (sin confundir con reprobada).
                  - Si al menos una tarea o evaluación es < 80, se muestra en negro con la calificación mínima reprobatoria: ej. U6: 75 ⚠.
              */}
              {showUnitEvaluationsSection && (
                <div className={`${isTutorizado ? 'col-span-1' : 'sm:col-span-2'} p-3.5 rounded-xl border border-slate-200/80 bg-white/90 shadow-2xs`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
                      Eval. por Unidad
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      Calificaciones registradas
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(() => {
                      const unitsToRender = academicUnits && academicUnits.length > 0
                        ? academicUnits.map((u) => {
                            const uKey = u.unitKey || u.unitLabel || (u.unitNumber ? `U${u.unitNumber}` : 'U1');
                            const label = formatAcademicUnitIdentifier(u.unitKey, u.unitNumber, u.moduleNumber);
                            return { uKey, label, unit: u };
                          })
                        : Object.entries(curr.unitEvaluations)
                            .filter(([k]) => isNaN(Number(k)) || !Object.keys(curr.unitEvaluations).some(other => other.startsWith('M') && other.endsWith(`U${k}`)))
                            .map(([uStr]) => ({
                              uKey: uStr,
                              label: formatAcademicUnitIdentifier(uStr),
                              unit: undefined as import('../types').AcademicUnit | undefined,
                            }));

                      return unitsToRender.map(({ uKey, label, unit }) => {
                        const status = unit
                          ? getUnitAcademicStatus(unit, curr, prev, student, { diffDays, isSingleCut })
                          : null;

                        if (status) {
                          return (
                            <span
                              key={uKey}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs border ${status.compactBadgeClasses}`}
                              title={`Unidad ${label}: ${status.stateLabel}`}
                            >
                              <span className={status.state === 'NEGRO' ? 'text-slate-300 font-bold' : 'text-slate-600 font-medium'}>
                                {label}:
                              </span>
                              <span className={status.compactValueClasses}>
                                {status.compactText}
                              </span>
                              {status.compactSymbol && (
                                <span className={status.compactSymbolClasses}>
                                  {status.compactSymbol}
                                </span>
                              )}
                            </span>
                          );
                        }

                        // Fallback si no se encontró la definición de unidad
                        const rawScore = curr.unitEvaluations[uKey];
                        const isValidEval = hasValidUnitEvaluation(rawScore);
                        const evalScore = isValidEval ? normalizeScore(rawScore) : null;
                        const isLow = evalScore !== null && evalScore < 80;
                        const isPassed = evalScore !== null && evalScore >= 80;

                        return (
                          <span
                            key={uKey}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border shadow-2xs ${
                              isLow
                                ? 'bg-slate-900 text-white border-slate-950 font-bold'
                                : isPassed
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            <span className={isLow ? 'text-slate-300' : 'text-slate-500'}>{label}:</span>
                            <span className={isLow ? 'text-white font-bold' : evalScore === null ? 'text-slate-400 font-normal italic' : 'text-emerald-900 font-bold'}>
                              {evalScore === null ? 'Sin inicio' : evalScore}
                            </span>
                            {isLow && <span className="text-amber-400 font-bold ml-0.5">⚠</span>}
                            {isPassed && <span className="text-emerald-600 font-bold ml-0.5">✓</span>}
                          </span>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Desglose Académico por Unidad (EXCLUSIVO PARA CURSOS TUTORIZADOS) */}
            {isTutorizado && academicUnits && academicUnits.length > 0 && (
              <div className="mt-3 p-3 sm:p-3.5 bg-slate-50/90 rounded-xl border border-slate-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Desglose Académico por Unidad
                  </span>
                  <div className="flex items-center gap-2">
                    {student.state === 'AZUL' && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                        DIPLOMADO CONCLUIDO
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500 font-medium">
                      Modalidad: <strong className="text-indigo-900">Tutorizado</strong>
                    </span>
                  </div>
                </div>

                {/* Cuadrícula adaptable: 4 columnas en pantallas amplias, 2 en medianas, 1 en estrechas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                  {academicUnits.map((unit) => {
                    const status = getUnitAcademicStatus(unit, curr, prev, student, { diffDays, isSingleCut });
                    const tasks = unit.tasks || [];
                    const unitIsNA = student.tutorialResolution === 'N.A' || student.tutorialResolution === 'Reprobó';
                    const unitIsSegundoIntento = student.tutorialResolution === 'Segundo intento otorgado';

                    return (
                      <div
                        key={status.uKey}
                        className={`rounded-xl border p-2.5 text-xs shadow-2xs transition-all flex flex-col justify-between gap-2 ${status.cardBgClasses}`}
                      >
                        <div className="space-y-1.5">
                          {/* Header: Unit identifier — Unit state badge */}
                          <div className="flex items-center justify-between gap-1 pb-1 border-b border-slate-200/60">
                            <span className="font-mono font-bold text-slate-900 text-xs truncate" title={status.unitTitle}>
                              {status.unitTitle}
                            </span>
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] border leading-tight shrink-0 ${status.cardBadgeClasses}`}
                            >
                              {status.cardBadgeText}
                            </span>
                          </div>

                          {/* Activities list: SCORM, Tarea, Ev */}
                          <div className="space-y-0.5 text-[11px]">
                            {/* SCORM row */}
                            {status.totalScorms > 0 && (
                              <div className="flex items-center justify-between py-0.5">
                                <span className="text-slate-500 font-medium">SCORM:</span>
                                <span
                                  className={`font-semibold ${
                                    status.isScormComplete
                                      ? 'text-emerald-700'
                                      : status.scormsDone > 0
                                      ? 'text-amber-700'
                                      : 'text-rose-600'
                                  }`}
                                >
                                  {status.scormsDone}/{status.totalScorms}
                                </span>
                              </div>
                            )}

                            {/* Tareas row(s): No full task titles */}
                            {tasks.map((task, idx) => {
                              const tScore = status.taskScores[idx] ?? null;
                              const taskLabel = tasks.length === 1 ? 'Tarea' : `Tarea ${idx + 1}`;

                              return (
                                <div key={task.id} className="flex items-center justify-between py-0.5">
                                  <span className="text-slate-500 font-medium">{taskLabel}:</span>
                                  {tScore !== null && tScore >= 80 ? (
                                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700" title="Aprobada">
                                      <span>{tScore}</span>
                                      <span className="text-emerald-600 font-bold">✓</span>
                                    </span>
                                  ) : tScore !== null && tScore < 80 ? (
                                    unitIsNA ? (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
                                        <span>{tScore}</span>
                                        <span>· N.A.</span>
                                      </span>
                                    ) : unitIsSegundoIntento ? (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-white border border-slate-950">
                                        <span>{tScore}</span>
                                        <span>· 2.º</span>
                                      </span>
                                    ) : (
                                      <span
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-white border border-slate-950 shadow-2xs"
                                        title="Requiere revisión (<80)"
                                      >
                                        <span>{tScore}</span>
                                        <span className="text-amber-300 font-bold">⚠</span>
                                      </span>
                                    )
                                  ) : (
                                    <span className="font-normal text-slate-400 italic">
                                      Pendiente
                                    </span>
                                  )}
                                </div>
                              );
                            })}

                            {/* Unit Evaluation row */}
                            <div className="flex items-center justify-between py-0.5">
                              <span className="text-slate-500 font-medium">Ev:</span>
                              {status.evalScore !== null && status.evalScore >= 80 ? (
                                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700" title="Aprobada">
                                  <span>{status.evalScore}</span>
                                  <span className="text-emerald-600 font-bold">✓</span>
                                </span>
                              ) : status.evalScore !== null && status.evalScore < 80 ? (
                                unitIsNA ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
                                    <span>{status.evalScore}</span>
                                    <span>· N.A.</span>
                                  </span>
                                ) : unitIsSegundoIntento ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-white border border-slate-950">
                                    <span>{status.evalScore}</span>
                                    <span>· 2.º</span>
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-white border border-slate-950 shadow-2xs"
                                    title="Requiere revisión (<80)"
                                  >
                                    <span>{status.evalScore}</span>
                                    <span className="text-amber-300 font-bold">⚠</span>
                                  </span>
                                )
                              ) : (
                                <span className="font-normal text-slate-400 italic">
                                  Pendiente
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Tutorial resolution dropdown inside card when failing grade exists */}
                        {status.hasFailedGrade && (
                          <div className="pt-1.5 border-t border-slate-200/70 space-y-1">
                            <span className="text-[9px] font-bold text-slate-500 block uppercase">
                              Resolución tutorial
                            </span>
                            <select
                              value={
                                student.tutorialResolution === 'Reprobó'
                                  ? 'N.A'
                                  : (student.tutorialResolution || 'Pendiente de revisión')
                              }
                              onChange={(e) => {
                                if (onUpdateResolution) {
                                  onUpdateResolution(student.usuario, e.target.value as TutorialResolutionType);
                                }
                              }}
                              className="w-full text-[10px] font-semibold px-1.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#002855] shadow-2xs cursor-pointer"
                            >
                              <option value="Pendiente de revisión">1. Pendiente de revisión</option>
                              <option value="Segundo intento otorgado">2. Segundo intento otorgado</option>
                              <option value="N.A">3. N.A</option>
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 5. INTERVENCIÓN SUGERIDA */}
          <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[11px]">
                    5. INTERVENCIÓN SUGERIDA
                  </h4>
                  {student.isManualMessage && (
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-300">
                      Personalizado manualmente
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-semibold text-slate-700 mt-0.5">
                  Objetivo: <span className="font-normal">{student.recommendedIntervention}</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                {onUpdateMessage && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditingMessage) {
                        setEditedText(activeMessage);
                        setIsEditingMessage(false);
                      } else {
                        setEditedText(activeMessage);
                        setIsEditingMessage(true);
                      }
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>{isEditingMessage ? 'Cancelar' : 'Editar'}</span>
                  </button>
                )}

                {student.isManualMessage && onUpdateMessage && (
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateMessage(student.usuario, '', false);
                      setIsEditingMessage(false);
                    }}
                    title="Restablecer a la plantilla automática unificada"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3 text-slate-500" />
                    <span>Restablecer</span>
                  </button>
                )}

                <button
                  id="btn-copiar-mensaje-modal"
                  onClick={handleCopy}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition-all cursor-pointer ${
                    copied
                      ? 'bg-[#00d1b2] text-white shadow-sm'
                      : 'bg-[#002855] text-white hover:bg-[#001f42]'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>✓ Mensaje copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar mensaje</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {isEditingMessage ? (
              <div className="space-y-2">
                <textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  rows={6}
                  className="w-full p-3 bg-white rounded-lg border border-slate-300 text-xs text-slate-800 leading-relaxed font-sans focus:outline-none focus:ring-1 focus:ring-[#002855] focus:border-[#002855] shadow-2xs"
                  placeholder="Escriba el mensaje tutorial personalizado..."
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (onUpdateMessage) {
                        onUpdateMessage(student.usuario, editedText, true);
                      }
                      setIsEditingMessage(false);
                    }}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-2xs cursor-pointer transition-colors"
                  >
                    Guardar mensaje personalizado
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-white rounded-lg border border-slate-200 font-sans text-xs text-slate-800 leading-relaxed italic whitespace-pre-line shadow-2xs">
                "{activeMessage}"
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 bg-slate-50/80 border-t border-slate-200/80 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
