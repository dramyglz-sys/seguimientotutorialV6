import React, { useState, useEffect, useCallback } from 'react';
import { CourseState, CourseSummary, InsigniaType, ProcessedStudent, TutorialResolutionType, TutorialState } from './types';
import {
  loadActiveCourse,
  saveCourseState,
  getAllCoursesSummaries,
  loadCourseById,
  deleteCourseById,
  saveTutorialResolution,
  saveManualInsignia,
} from './utils/indexedDB';
import { exportTutorialExcel } from './utils/excelExport';
import { getStudentPersonalizedMessage } from './utils/messages';
import { Header } from './components/Header';
import { CourseInfoBanner } from './components/CourseInfoBanner';
import { StateCards } from './components/StateCards';
import { StudentTable } from './components/StudentTable';
import { InterventionsSection } from './components/InterventionsSection';
import { StudentDetailModal } from './components/StudentDetailModal';
import { HistoryModal } from './components/HistoryModal';
import { NewCourseModal } from './components/NewCourseModal';
import { UpdateCourseModal } from './components/UpdateCourseModal';
import { SavedCoursesModal } from './components/SavedCoursesModal';
import { WhatChangedModal } from './components/WhatChangedModal';
import { SingleCutWarning } from './components/SingleCutWarning';
import { NewEnrollmentBanner } from './components/NewEnrollmentBanner';
import { NewEnrollmentsModal } from './components/NewEnrollmentsModal';
import { PlusCircle, BookOpen, Calendar, Users, ArrowRight, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function App() {
  const [courseState, setCourseState] = useState<CourseState | null>(null);
  const [savedCourses, setSavedCourses] = useState<CourseSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStateFilter, setSelectedStateFilter] = useState<TutorialState | 'ALL'>('ALL');
  const [selectedStudent, setSelectedStudent] = useState<ProcessedStudent | null>(null);

  // Modals
  const [showNewCourseModal, setShowNewCourseModal] = useState(false);
  const [showUpdateCourseModal, setShowUpdateCourseModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showSavedCoursesModal, setShowSavedCoursesModal] = useState(false);
  const [showWhatChangedModal, setShowWhatChangedModal] = useState(false);
  const [showNewEnrollmentsModal, setShowNewEnrollmentsModal] = useState(false);

  // Toast / notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const refreshCoursesList = useCallback(async () => {
    try {
      const summaries = await getAllCoursesSummaries();
      setSavedCourses(summaries);
    } catch (err) {
      console.error('Error fetching course summaries:', err);
    }
  }, []);

  // Load active course & courses list from IndexedDB on startup
  useEffect(() => {
    async function init() {
      try {
        const [active, summaries] = await Promise.all([
          loadActiveCourse(),
          getAllCoursesSummaries(),
        ]);
        if (active) {
          setCourseState(active);
        } else if (summaries.length > 0) {
          // If no active course was stored but courses exist, load first course
          const firstCourse = await loadCourseById(summaries[0].id);
          if (firstCourse) {
            setCourseState(firstCourse);
          }
        }
        setSavedCourses(summaries);
      } catch (err) {
        console.error('Error loading course state from DB:', err);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // Save changes to DB whenever course is created/updated
  const handleSaveCourse = async (newState: CourseState) => {
    setCourseState(newState);
    await saveCourseState(newState);
    await refreshCoursesList();
    setSelectedStateFilter('ALL');
    setShowNewCourseModal(false);
    setShowUpdateCourseModal(false);
    showToast('✓ Curso guardado y actualizado en memoria local.');
  };

  // Switch active course
  const handleSelectCourse = async (courseId: string) => {
    try {
      const course = await loadCourseById(courseId);
      if (course) {
        setCourseState(course);
        await saveCourseState(course);
        setSelectedStateFilter('ALL');
        showToast(`✓ Curso activo: ${course.courseMetadata.name}`);
      }
    } catch (err) {
      console.error('Error switching course:', err);
    }
  };

  // Delete course
  const handleDeleteCourse = async (courseId: string) => {
    try {
      await deleteCourseById(courseId);
      const updatedSummaries = await getAllCoursesSummaries();
      setSavedCourses(updatedSummaries);

      if (courseState?.id === courseId) {
        if (updatedSummaries.length > 0) {
          const nextCourse = await loadCourseById(updatedSummaries[0].id);
          setCourseState(nextCourse);
        } else {
          setCourseState(null);
        }
      }
      showToast('✓ Curso eliminado correctamente de la memoria local.');
    } catch (err) {
      console.error('Error deleting course:', err);
    }
  };

  const handleDownloadExcel = async () => {
    if (!courseState?.currentComparison) {
      showToast('⚠ No hay datos de comparación disponibles para exportar.');
      return;
    }
    try {
      await exportTutorialExcel(courseState.currentComparison, courseState.courseMetadata);
      showToast('✓ Archivo Excel generado y descargado.');
    } catch (err) {
      console.error(err);
      alert('Error al generar el archivo Excel resumido.');
    }
  };

  const handleUpdateResolution = async (usuario: string, resolution: TutorialResolutionType) => {
    if (!courseState?.currentComparison?.students) return;
    const targetStudent = courseState.currentComparison.students.find((s) => s.usuario === usuario);
    const issueUnit = targetStudent?.issues && targetStudent.issues.length > 0 ? targetStudent.issues[0].unitNumber : undefined;
    const issueScore = targetStudent?.issues && targetStudent.issues.length > 0 ? targetStudent.issues[0].score : undefined;

    const savedRecord = await saveTutorialResolution(
      courseState.id,
      usuario,
      resolution,
      issueUnit,
      issueScore
    );

    const updatedResolutions = {
      ...(courseState.tutorialResolutions || {}),
      [usuario]: savedRecord,
    };

    const updatedStudents = courseState.currentComparison.students.map((s) => {
      if (s.usuario === usuario) {
        return {
          ...s,
          tutorialResolution: resolution,
          tutorialResolutionData: savedRecord,
        };
      }
      return s;
    });

    const updatedCourse: CourseState = {
      ...courseState,
      tutorialResolutions: updatedResolutions,
      currentComparison: {
        ...courseState.currentComparison,
        students: updatedStudents,
      },
    };

    setCourseState(updatedCourse);
    await saveCourseState(updatedCourse);

    if (selectedStudent && selectedStudent.usuario === usuario) {
      setSelectedStudent({
        ...selectedStudent,
        tutorialResolution: resolution,
        tutorialResolutionData: savedRecord,
      });
    }

    showToast(`✓ Resolución tutorial guardada: "${resolution}"`);
  };

  const handleUpdateInsignia = async (usuario: string, insignia: InsigniaType) => {
    if (!courseState?.currentComparison?.students) return;
    await saveManualInsignia(courseState.id, usuario, insignia);

    const updatedManualInsignias = {
      ...(courseState.manualInsignias || {}),
      [usuario]: insignia,
    };

    const updatedStudents = courseState.currentComparison.students.map((s) => {
      if (s.usuario === usuario) {
        return {
          ...s,
          insignia,
          isManualInsignia: true,
        };
      }
      return s;
    });

    const updatedCourse: CourseState = {
      ...courseState,
      manualInsignias: updatedManualInsignias,
      currentComparison: {
        ...courseState.currentComparison,
        students: updatedStudents,
      },
    };

    setCourseState(updatedCourse);
    await saveCourseState(updatedCourse);

    if (selectedStudent && selectedStudent.usuario === usuario) {
      setSelectedStudent({
        ...selectedStudent,
        insignia,
        isManualInsignia: true,
      });
    }

    showToast(`✓ Clasificación de insignia actualizada: ${insignia}`);
  };

  const handleUpdateMessage = async (usuario: string, message: string, isManual: boolean) => {
    if (!courseState?.currentComparison?.students) return;

    const updatedStudents = courseState.currentComparison.students.map((s) => {
      if (s.usuario === usuario) {
        return {
          ...s,
          isManualMessage: isManual,
          personalizedMessage: isManual
            ? message
            : getStudentPersonalizedMessage({ ...s, isManualMessage: false }),
        };
      }
      return s;
    });

    const updatedCourse: CourseState = {
      ...courseState,
      currentComparison: {
        ...courseState.currentComparison,
        students: updatedStudents,
      },
    };

    setCourseState(updatedCourse);
    await saveCourseState(updatedCourse);

    if (selectedStudent && selectedStudent.usuario === usuario) {
      setSelectedStudent({
        ...selectedStudent,
        isManualMessage: isManual,
        personalizedMessage: isManual
          ? message
          : getStudentPersonalizedMessage({ ...selectedStudent, isManualMessage: false }),
      });
    }

    showToast(isManual ? '✓ Mensaje personalizado guardado.' : '✓ Plantilla predeterminada restablecida.');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center text-xs font-semibold text-slate-400">
          Cargando Seguimiento Tutorial...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fa] text-slate-800 flex flex-col font-sans selection:bg-[#00d1b2]/20">
      {/* Header */}
      <Header
        hasActiveCourse={Boolean(courseState)}
        totalSavedCourses={savedCourses.length}
        onNewCourse={() => setShowNewCourseModal(true)}
        onUpdateCourse={() => setShowUpdateCourseModal(true)}
        onDownloadExcel={handleDownloadExcel}
        onOpenHistory={() => {
          if (courseState?.validSheets && courseState.validSheets.length > 0) {
            setShowHistoryModal(true);
          } else {
            showToast('ℹ No hay cortes registrados para mostrar en el historial.');
          }
        }}
        onOpenWhatChanged={() => {
          if (courseState?.currentComparison) {
            setShowWhatChangedModal(true);
          } else {
            showToast('ℹ Se requieren datos de comparación para consultar los cambios.');
          }
        }}
        onOpenSavedCourses={() => setShowSavedCoursesModal(true)}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#002855]/95 backdrop-blur-md text-white px-4 py-2.5 rounded-xl shadow-xl border border-white/20 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="w-5 h-5 rounded-full bg-[#00d1b2]/20 flex items-center justify-center text-[#00d1b2]">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!courseState ? (
          /* Initial State View (When no course is active) */
          <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-4 sm:p-8">
            <div className="max-w-xl w-full bg-white/85 backdrop-blur-md rounded-2xl border border-white/80 shadow-lg p-6 sm:p-8 space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-[#002855] text-white flex items-center justify-center font-black text-2xl mx-auto shadow-md border border-white/20">
                <span className="text-[#00d1b2]">S</span>T
              </div>

              <div>
                <h1 className="text-xl sm:text-2xl font-black text-[#002855] tracking-tight uppercase mb-2">
                  SEGUIMIENTO TUTORIAL
                </h1>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  {savedCourses.length > 0
                    ? 'Seleccione uno de los cursos guardados en memoria local o cargue un nuevo curso.'
                    : 'No hay un curso activo. Agregue un nuevo curso desde su archivo Excel para comenzar.'}
                </p>
              </div>

              {/* Saved Courses quick selection if available */}
              {savedCourses.length > 0 && (
                <div className="text-left space-y-2 max-h-56 overflow-y-auto p-1">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block px-1">
                    Cursos guardados en este navegador:
                  </span>
                  {savedCourses.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => handleSelectCourse(c.id)}
                      className="p-3 bg-slate-50 hover:bg-blue-50/60 rounded-xl border border-slate-200/80 hover:border-blue-200 transition-all cursor-pointer flex items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#002855] truncate">
                          {c.name}
                        </h4>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                          <span>
                            {c.startDate} → {c.endDate}
                          </span>
                          {c.lastCutDateFormatted && (
                            <span>• Último corte: {c.lastCutDateFormatted}</span>
                          )}
                          <span>• {c.totalStudents} alumnos</span>
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#002855] group-hover:text-[#00bda1] shrink-0">
                        <span>Abrir</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2">
                <button
                  id="btn-inicio-nuevo-curso"
                  onClick={() => setShowNewCourseModal(true)}
                  className="w-full inline-flex items-center justify-center px-5 py-3 text-xs font-bold rounded-xl shadow-md text-white bg-[#00d1b2] hover:bg-[#00bda1] active:bg-[#00a890] transition-all focus:outline-none focus:ring-2 focus:ring-[#00d1b2]/40 cursor-pointer uppercase tracking-wider"
                >
                  <PlusCircle className="w-4 h-4 mr-2" />
                  ➕ Agregar nuevo curso
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Active Course Dashboard */
          <div>
            {/* 1. Course Information Banner */}
            <CourseInfoBanner
              metadata={courseState.courseMetadata}
              comparison={courseState.currentComparison}
            />

            {courseState.currentComparison ? (
              <>
                {/* 2. Single Cut Warning if only 1 valid sheet exists */}
                {courseState.currentComparison.isSingleCut && (
                  <SingleCutWarning
                    sheetName={courseState.currentComparison.currentSheetName}
                    formattedDate={courseState.currentComparison.currentDate?.formatted || ''}
                  />
                )}

                {/* 2.1 Alerta horizontal de NUEVOS INGRESOS (inmediatamente ANTES del apartado «ESTADO GENERAL DE ALUMNOS») */}
                {(() => {
                  const newEnrollmentCount = courseState.currentComparison.isSingleCut
                    ? 0
                    : (courseState.currentComparison.newEnrollmentCount ??
                       (courseState.currentComparison.students || []).filter((s) => s.isNewEnrollment).length);

                  if (newEnrollmentCount <= 0) return null;

                  return (
                    <NewEnrollmentBanner
                      count={newEnrollmentCount}
                      onOpenModal={() => setShowNewEnrollmentsModal(true)}
                    />
                  );
                })()}

                {/* 3. 6 State Filter Cards */}
                <StateCards
                  comparison={courseState.currentComparison}
                  selectedStateFilter={selectedStateFilter}
                  onSelectState={setSelectedStateFilter}
                />

                {/* 4. Student Table */}
                <StudentTable
                  key={courseState.id}
                  students={courseState.currentComparison.students || []}
                  academicUnits={courseState.academicUnits}
                  selectedStateFilter={selectedStateFilter}
                  onSelectStateFilter={setSelectedStateFilter}
                  onSelectStudent={setSelectedStudent}
                  onUpdateInsignia={handleUpdateInsignia}
                />

                {/* 5. Suggested Interventions Section */}
                <InterventionsSection
                  comparison={courseState.currentComparison}
                  onFilterByState={(state) => setSelectedStateFilter(state)}
                />
              </>
            ) : (
              /* Safe fallback / recovery card if currentComparison is absent */
              <div className="bg-white/85 backdrop-blur-md rounded-2xl border border-amber-200 p-6 sm:p-8 text-center space-y-4 shadow-sm my-6">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Datos de comparación no calculados para este curso
                  </h3>
                  <p className="text-xs text-slate-500 max-w-lg mx-auto mt-1 leading-relaxed">
                    Este curso se encuentra en la memoria local pero no cuenta con la comparación de cortes calculada.
                    Haga clic en el botón a continuación para cargar el archivo Excel y regenerar el análisis sin perder ningún registro.
                  </p>
                </div>
                <button
                  onClick={() => setShowUpdateCourseModal(true)}
                  className="inline-flex items-center px-4 py-2.5 text-xs font-bold rounded-xl text-white bg-[#002855] hover:bg-[#001f42] active:bg-slate-900 transition-colors shadow-sm cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4 mr-2 text-[#00d1b2]" />
                  📂 Cargar archivo Excel para actualizar
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      {showNewCourseModal && (
        <NewCourseModal
          hasActiveCourse={Boolean(courseState)}
          onCourseCreated={handleSaveCourse}
          onClose={() => setShowNewCourseModal(false)}
        />
      )}

      {showUpdateCourseModal && courseState && (
        <UpdateCourseModal
          currentCourseState={courseState}
          onCourseUpdated={handleSaveCourse}
          onClose={() => setShowUpdateCourseModal(false)}
        />
      )}

      {showHistoryModal && courseState && (
        <HistoryModal
          validSheets={courseState.validSheets || []}
          history={courseState.history || []}
          allCutSheetsData={courseState.allCutSheetsData || {}}
          onClose={() => setShowHistoryModal(false)}
        />
      )}

      {showSavedCoursesModal && (
        <SavedCoursesModal
          activeCourseId={courseState?.id || null}
          courses={savedCourses}
          onSelectCourse={handleSelectCourse}
          onDeleteCourse={handleDeleteCourse}
          onAddNewCourse={() => setShowNewCourseModal(true)}
          onClose={() => setShowSavedCoursesModal(false)}
        />
      )}

      {showWhatChangedModal && courseState?.currentComparison && (
        <WhatChangedModal
          comparison={courseState.currentComparison}
          onSelectStudent={(student) => {
            setShowWhatChangedModal(false);
            setSelectedStudent(student);
          }}
          onClose={() => setShowWhatChangedModal(false)}
        />
      )}

      {showNewEnrollmentsModal && courseState?.currentComparison && (
        <NewEnrollmentsModal
          students={courseState.currentComparison.students || []}
          previousDate={courseState.currentComparison.previousDate}
          currentDate={courseState.currentComparison.currentDate}
          onSelectStudent={(student) => {
            setSelectedStudent(student);
          }}
          onClose={() => setShowNewEnrollmentsModal(false)}
        />
      )}

      {selectedStudent && courseState && (
        <StudentDetailModal
          student={selectedStudent}
          academicUnits={courseState.academicUnits || []}
          validSheets={courseState.validSheets || []}
          allCutSheetsData={courseState.allCutSheetsData || {}}
          previousDate={courseState.currentComparison?.previousDate}
          currentDate={courseState.currentComparison?.currentDate}
          onUpdateResolution={handleUpdateResolution}
          onUpdateInsignia={handleUpdateInsignia}
          onUpdateMessage={handleUpdateMessage}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
}
