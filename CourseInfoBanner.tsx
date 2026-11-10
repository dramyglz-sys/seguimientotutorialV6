import React from 'react';
import { CourseMetadata, CutComparisonResult } from '../types';
import { Calendar, Clock, BookOpen, Layers } from 'lucide-react';
import { FemaleSymbol, MaleSymbol, RevisionSymbol } from './InsigniaIcons';

interface CourseInfoBannerProps {
  metadata: CourseMetadata;
  comparison?: CutComparisonResult | null;
}

export const CourseInfoBanner: React.FC<CourseInfoBannerProps> = ({
  metadata,
  comparison,
}) => {
  // Format dates
  const formatIsoDate = (dStr: string) => {
    if (!dStr) return '-';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
      const [y, m, d] = dStr.split('-');
      return `${d}/${m}/${y}`;
    }
    return dStr;
  };

  // Compute course duration statistics
  const now = new Date();
  const startDate = new Date(metadata.startDate);
  const endDate = new Date(metadata.endDate);

  const startUtc = Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endUtc = Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  const nowUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  const totalCourseDays = Math.max(1, Math.round((endUtc - startUtc) / (1000 * 60 * 60 * 24)));
  const daysElapsed = Math.max(0, Math.min(totalCourseDays, Math.round((nowUtc - startUtc) / (1000 * 60 * 60 * 24))));
  const daysRemaining = Math.max(0, Math.round((endUtc - nowUtc) / (1000 * 60 * 60 * 24)));
  const percentElapsed = Math.min(100, Math.max(0, Math.round((daysElapsed / totalCourseDays) * 100)));

  // Compute Insignia breakdown exclusively for students who finished (AZUL / TERMINÓ)
  const terminoStudents = comparison?.students ? comparison.students.filter((s) => s.state === 'AZUL') : [];
  const totalTermino = terminoStudents.length;

  let countMujer = 0;
  let countHombre = 0;
  let countRevision = 0;

  terminoStudents.forEach((s) => {
    if (s.insignia === 'MUJER') {
      countMujer += 1;
    } else if (s.insignia === 'HOMBRE') {
      countHombre += 1;
    } else {
      countRevision += 1;
    }
  });

  return (
    <div
      id="course-info-banner"
      className="bg-white/70 backdrop-blur-md rounded-xl border border-white shadow-sm p-4 sm:p-5 mb-6 transition-all"
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left Column: Course Name & Key Dates */}
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#002855]/10 text-[#002855] flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-[#002855]" />
            </div>
            <div>
              <h2 className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                Curso Activo
              </h2>
              <p className="text-base sm:text-lg font-bold text-[#002855] leading-tight">
                {metadata.name}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-y-1.5 gap-x-3 text-xs text-slate-600 pt-1">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <strong>Inicio:</strong> {formatIsoDate(metadata.startDate)}
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <strong>Término:</strong> {formatIsoDate(metadata.endDate)}
            </span>
            {comparison && (
              <>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1 bg-white/80 border border-slate-200/80 px-2.5 py-0.5 rounded-md text-slate-700 font-medium shadow-2xs">
                  <Layers className="w-3.5 h-3.5 text-[#00d1b2]" />
                  {comparison.isSingleCut ? (
                    <>
                      <strong className="text-[#002855]">Corte único:</strong>{' '}
                      {comparison.currentDate?.displayLabel ||
                        `${comparison.currentDate?.formatted || ''} · Corte ${comparison.currentDate?.cutNumber || 1}`}{' '}
                      <span className="text-slate-400 font-mono text-[11px]">({comparison.currentSheetName})</span>
                    </>
                  ) : (
                    <>
                      <strong className="text-[#002855]">Cortes comparados:</strong>{' '}
                      <span>
                        {comparison.previousDate?.displayLabel ||
                          `${comparison.previousDate?.formatted || ''} · Corte ${comparison.previousDate?.cutNumber || 1}`}
                      </span>{' '}
                      <span className="text-slate-400 font-bold">→</span>{' '}
                      <span className="text-[#002855] font-bold">
                        {comparison.currentDate?.displayLabel ||
                          `${comparison.currentDate?.formatted || ''} · Corte ${comparison.currentDate?.cutNumber || 1}`}
                      </span>{' '}
                      <span className="text-slate-400 font-mono text-[11px]">
                        ({comparison.previousSheetName} → {comparison.currentSheetName})
                      </span>
                    </>
                  )}
                </span>
              </>
            )}
            {(comparison?.courseType || metadata.courseType) && (
              <>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200/70">
                  <span className="text-slate-400 font-normal">Tipo:</span>
                  <span className={(comparison?.courseType || metadata.courseType) === 'TUTORIZADO' ? 'text-indigo-900 font-bold' : 'text-slate-700 font-semibold'}>
                    {(comparison?.courseType || metadata.courseType) === 'TUTORIZADO' ? 'Tutorizado' : 'Semitutorizado'}
                  </span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right Column: Time Progress Metrics & ET */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 lg:gap-6 bg-white/80 backdrop-blur-xs border border-slate-200/70 rounded-xl p-3.5 shadow-2xs">
          {/* 1. DÍAS RESTANTES (Destacado) */}
          <div className="text-center px-2 min-w-[90px]">
            <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold">
              Días restantes
            </span>
            <div className="flex items-baseline justify-center gap-1 mt-0.5">
              <span
                className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                  daysRemaining <= 5 ? 'text-red-600' : 'text-[#002855]'
                }`}
              >
                {daysRemaining}
              </span>
              <span className="text-xs text-slate-500 font-normal">días</span>
            </div>
          </div>

          <div className="h-10 w-px bg-slate-200 hidden sm:block" />

          {/* 2. PROGRESO DEL CURSO */}
          <div className="w-full sm:w-36 px-2">
            <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">
              <span>Progreso del curso</span>
              <span className="text-[#002855] font-bold">{percentElapsed} %</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden shadow-inner">
              <div
                className="bg-[#00d1b2] h-full rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${percentElapsed}%` }}
              />
            </div>
          </div>

          <div className="h-10 w-px bg-slate-200 hidden sm:block" />

          {/* 3. ET — EFICIENCIA TERMINAL & DESGLOSE DE INSIGNIAS */}
          <div className="text-center px-2 min-w-[125px]">
            <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold">
              ET
            </span>
            <div className="text-xl sm:text-2xl font-extrabold text-[#002855] tracking-tight mt-0.5">
              {comparison && comparison.totalStudents > 0
                ? `${Number(((comparison.counts.azul / comparison.totalStudents) * 100).toFixed(1))} %`
                : '—'}
            </div>
            <span className="block text-[10px] text-slate-500 font-normal leading-none mt-0.5">
              Eficiencia Terminal
            </span>

            {/* Franja compacta con desglose de insignias de alumnos TERMINÓ */}
            <div
              className="flex items-center justify-center gap-2 mt-1.5 pt-1.5 border-t border-slate-200/70 text-[11px] font-semibold tracking-tight"
              title={`Insignias alumnos TERMINÓ: ${countMujer} Mujer + ${countHombre} Hombre + ${countRevision} Revisión = ${totalTermino}`}
            >
              <span
                className="text-red-600 flex items-center gap-1 cursor-help"
                title={`Mujer: ${countMujer} alumnos terminados`}
              >
                <FemaleSymbol size={16} className="text-red-600" />
                <span>{countMujer}</span>
              </span>
              <span className="text-slate-300 font-light">•</span>
              <span
                className="text-blue-600 flex items-center gap-1 cursor-help"
                title={`Hombre: ${countHombre} alumnos terminados`}
              >
                <MaleSymbol size={16} className="text-blue-600" />
                <span>{countHombre}</span>
              </span>
              <span className="text-slate-300 font-light">•</span>
              <span
                className="text-amber-500 flex items-center gap-1 cursor-help"
                title={`Revisión: ${countRevision} alumnos terminados`}
              >
                <RevisionSymbol size={10} className="text-amber-500" />
                <span>{countRevision}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
