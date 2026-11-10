import React, { useState } from 'react';
import { CourseSummary } from '../types';
import { BookOpen, Calendar, Users, Trash2, CheckCircle2, AlertTriangle, X, PlusCircle, ArrowRight } from 'lucide-react';

interface SavedCoursesModalProps {
  activeCourseId: string | null;
  courses: CourseSummary[];
  onSelectCourse: (id: string) => void;
  onDeleteCourse: (id: string) => void;
  onAddNewCourse: () => void;
  onClose: () => void;
}

export const SavedCoursesModal: React.FC<SavedCoursesModalProps> = ({
  activeCourseId,
  courses,
  onSelectCourse,
  onDeleteCourse,
  onAddNewCourse,
  onClose,
}) => {
  const [deletingCourse, setDeletingCourse] = useState<CourseSummary | null>(null);

  const handleConfirmDelete = () => {
    if (deletingCourse) {
      onDeleteCourse(deletingCourse.id);
      setDeletingCourse(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/80 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#002855] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#00d1b2]">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white uppercase tracking-wide">
                CURSOS GUARDADOS
              </h3>
              <p className="text-[11px] text-slate-300">
                Seleccione un curso para retomar su seguimiento o agregue uno nuevo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
          {courses.length === 0 ? (
            <div className="text-center py-12 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-700">No hay cursos guardados</h4>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                Comience cargando su primer libro de seguimiento de Excel.
              </p>
              <button
                onClick={() => {
                  onClose();
                  onAddNewCourse();
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#00d1b2] hover:bg-[#00bda1] rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                Agregar nuevo curso
              </button>
            </div>
          ) : (
            courses.map((course) => {
              const isActive = course.id === activeCourseId;
              return (
                <div
                  key={course.id}
                  className={`p-4 rounded-xl border transition-all duration-150 ${
                    isActive
                      ? 'bg-blue-50/70 border-blue-200 shadow-sm ring-1 ring-blue-300/60'
                      : 'bg-white hover:bg-slate-50/80 border-slate-200/80 shadow-2xs'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900 truncate">
                          {course.name}
                        </h4>
                        {isActive && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#002855] text-white">
                            <CheckCircle2 className="w-3 h-3 text-[#00d1b2]" />
                            Activo actualmente
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-x-4 gap-y-1 text-xs text-slate-600 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {course.startDate} → {course.endDate}
                          </span>
                        </div>
                        {course.lastCutDateFormatted && (
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400">Último corte:</span>
                            <span className="font-semibold text-slate-700">
                              {course.lastCutDateFormatted}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-semibold text-slate-700">
                            {course.totalStudents} alumnos
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <button
                        onClick={() => {
                          onSelectCourse(course.id);
                          onClose();
                        }}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-[#002855] text-white hover:bg-[#003875]'
                            : 'bg-[#00d1b2] text-white hover:bg-[#00bda1]'
                        }`}
                      >
                        <span>{isActive ? 'Continuar' : 'Abrir / Retomar'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setDeletingCourse(course)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar curso"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <button
            onClick={() => {
              onClose();
              onAddNewCourse();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#002855] hover:bg-white rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-[#00d1b2]" />
            <span>➕ Agregar nuevo curso</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

        {/* Delete confirmation sub-modal */}
        {deletingCourse && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-900">
                    ¿Desea eliminar el curso?
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    ¿Desea eliminar el curso <strong className="text-slate-900">"{deletingCourse.name}"</strong>? Esta acción eliminará de la aplicación el historial, cortes, alumnos y configuraciones guardadas de este curso.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    (El archivo original de Excel en su equipo no se verá afectado).
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeletingCourse(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  Sí, eliminar curso
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
