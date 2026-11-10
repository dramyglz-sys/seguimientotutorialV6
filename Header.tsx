import React from 'react';
import { PlusCircle, RefreshCw, Download, History, Sparkles, BookOpen } from 'lucide-react';

interface HeaderProps {
  hasActiveCourse: boolean;
  totalSavedCourses: number;
  onNewCourse: () => void;
  onUpdateCourse: () => void;
  onDownloadExcel: () => void;
  onOpenHistory: () => void;
  onOpenWhatChanged: () => void;
  onOpenSavedCourses: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  hasActiveCourse,
  totalSavedCourses,
  onNewCourse,
  onUpdateCourse,
  onDownloadExcel,
  onOpenHistory,
  onOpenWhatChanged,
  onOpenSavedCourses,
}) => {
  return (
    <header className="bg-[#002855] text-white shadow-md border-b border-[#001f42] sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
          {/* Title & App Branding */}
          <div className="flex items-center space-x-3 self-start lg:self-center">
            <div className="w-9 h-9 bg-[#00d1b2] rounded-xl flex items-center justify-center font-bold text-white shadow-inner shrink-0">
              ST
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white uppercase">
                SEGUIMIENTO TUTORIAL
              </h1>
              <p className="text-[11px] text-slate-300 font-normal">
                Gestión y toma de decisiones tutoriales por cortes de evaluación
              </p>
            </div>
          </div>

          {/* Action Blocks: Primary and Secondary zones */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-center w-full lg:w-auto justify-start lg:justify-end">
            {/* Primary Action Buttons (when a course is active) */}
            {hasActiveCourse && (
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white/5 rounded-xl border border-white/10">
                {/* 1. 📂 Actualizar */}
                <button
                  id="btn-actualizar-seguimiento"
                  onClick={onUpdateCourse}
                  className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold rounded-lg text-white bg-slate-700/80 hover:bg-slate-700 active:bg-slate-800 transition-colors cursor-pointer"
                  title="Actualizar seguimiento con un nuevo corte de Excel"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1 text-[#00d1b2]" />
                  <span>📂 Actualizar</span>
                </button>

                {/* 2. 📥 Descargar */}
                <button
                  id="btn-descargar-excel"
                  onClick={onDownloadExcel}
                  className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold rounded-lg text-white bg-slate-700/80 hover:bg-slate-700 active:bg-slate-800 transition-colors cursor-pointer"
                  title="Descargar reporte en formato Excel"
                >
                  <Download className="w-3.5 h-3.5 mr-1 text-[#00d1b2]" />
                  <span>📥 Descargar</span>
                </button>

                {/* 3. 🕘 Historial */}
                <button
                  id="btn-historial"
                  onClick={onOpenHistory}
                  className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold rounded-lg text-white bg-slate-700/80 hover:bg-slate-700 active:bg-slate-800 transition-colors cursor-pointer"
                  title="Ver historial de evolución entre cortes"
                >
                  <History className="w-3.5 h-3.5 mr-1 text-[#00d1b2]" />
                  <span>🕘 Historial</span>
                </button>

                {/* 4. ✨ Qué cambió hoy */}
                <button
                  id="btn-que-cambio-hoy"
                  onClick={onOpenWhatChanged}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-bold rounded-lg text-[#002855] bg-[#00d1b2] hover:bg-[#00bda1] active:bg-[#00a890] transition-all shadow-xs cursor-pointer"
                  title="Identificar cambios nuevos entre los dos últimos cortes"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  <span>✨ Qué cambió hoy</span>
                </button>
              </div>
            )}

            {/* Secondary Zone: Course Navigation & Addition */}
            <div className="flex items-center gap-1.5">
              {/* 📚 Visualizar cursos */}
              <button
                id="btn-visualizar-cursos"
                onClick={onOpenSavedCourses}
                className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-white/10 hover:bg-white/20 active:bg-white/25 transition-colors border border-white/15 cursor-pointer"
                title="Ver lista de cursos guardados en memoria local"
              >
                <BookOpen className="w-3.5 h-3.5 mr-1.5 text-[#00d1b2]" />
                <span>📚 Visualizar cursos</span>
                {totalSavedCourses > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#00d1b2] text-[#002855]">
                    {totalSavedCourses}
                  </span>
                )}
              </button>

              {/* ➕ Agregar nuevo curso */}
              <button
                id="btn-nuevo-curso"
                onClick={onNewCourse}
                className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-slate-800 hover:bg-slate-700 active:bg-slate-900 transition-colors border border-slate-600 cursor-pointer shadow-xs"
                title="Cargar un nuevo curso a la memoria local"
              >
                <PlusCircle className="w-3.5 h-3.5 mr-1.5 text-[#00d1b2]" />
                <span>➕ Agregar nuevo curso</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
