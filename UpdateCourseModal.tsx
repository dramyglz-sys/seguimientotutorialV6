import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { parseWorkbookCuts, compareCuts, buildHistoricalSteps } from '../utils/excelParser';
import { CourseState, CourseType } from '../types';
import { RefreshCw, Upload, AlertCircle, FileSpreadsheet, X, CheckCircle2 } from 'lucide-react';

interface UpdateCourseModalProps {
  currentCourseState: CourseState;
  onCourseUpdated: (updatedState: CourseState) => void;
  onClose: () => void;
}

export const UpdateCourseModal: React.FC<UpdateCourseModalProps> = ({
  currentCourseState,
  onCourseUpdated,
  onClose,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mismatchInfo, setMismatchInfo] = useState<{
    prevType: CourseType;
    newType: CourseType;
  } | null>(null);
  const [pendingUpdatedState, setPendingUpdatedState] = useState<CourseState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.xlsx')) {
      setErrorMsg('El archivo seleccionado debe ser un libro de Excel con formato .xlsx');
      return;
    }

    setErrorMsg(null);
    setMismatchInfo(null);
    setPendingUpdatedState(null);
    setFile(selectedFile);
    setIsProcessing(true);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const wb = XLSX.read(buffer, {
        type: 'array',
        cellNF: true,
        cellText: true,
        cellStyles: true,
        cellDates: true,
      });

      // Automatically extract and sort cuts
      const { validSheets, allCutSheetsData, academicUnits, courseType: newCourseType } = parseWorkbookCuts(wb);

      if (validSheets.length === 0) {
        throw new Error('No se encontraron hojas DDMMYY válidas en el archivo actualizado.');
      }

      // Compute last two cuts
      let comparison;
      if (validSheets.length === 1) {
        const singleSheet = validSheets[0];
        const singleData = allCutSheetsData[singleSheet.raw] || [];
        comparison = compareCuts(
          null,
          singleData,
          null,
          singleSheet,
          academicUnits,
          currentCourseState.tutorialResolutions,
          currentCourseState.manualInsignias
        );
      } else {
        const prevSheet = validSheets[validSheets.length - 2];
        const currSheet = validSheets[validSheets.length - 1];
        const prevData = allCutSheetsData[prevSheet.raw] || [];
        const currData = allCutSheetsData[currSheet.raw] || [];
        comparison = compareCuts(
          prevData,
          currData,
          prevSheet,
          currSheet,
          academicUnits,
          currentCourseState.tutorialResolutions,
          currentCourseState.manualInsignias,
          { validSheets, allCutSheetsData }
        );
      }

      const history = buildHistoricalSteps(validSheets, allCutSheetsData, academicUnits);

      // Keep existing metadata or update days elapsed
      const start = new Date(currentCourseState.courseMetadata.startDate);
      const end = new Date(currentCourseState.courseMetadata.endDate);
      const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      const now = new Date();
      const daysElapsed = Math.max(0, Math.min(totalDays, Math.round((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))));
      const daysRemaining = Math.max(0, Math.round((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      const percentageElapsed = Math.min(100, Math.max(0, Math.round((daysElapsed / totalDays) * 100)));

      const finalCourseType = newCourseType || currentCourseState.courseType || 'SEMITUTORIZADO';

      const updatedState: CourseState = {
        id: currentCourseState.id || `course_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        courseType: finalCourseType,
        courseMetadata: {
          ...currentCourseState.courseMetadata,
          courseType: finalCourseType,
          fileName: selectedFile.name,
          totalDays,
          daysElapsed,
          daysRemaining,
          percentageElapsed,
        },
        validSheets,
        academicUnits,
        allCutSheetsData,
        currentComparison: comparison,
        history,
        tutorialResolutions: currentCourseState.tutorialResolutions || {},
        manualInsignias: currentCourseState.manualInsignias || {},
        lastUpdated: new Date().toISOString(),
      };

      const prevCourseType = currentCourseState.courseType || currentCourseState.courseMetadata?.courseType;
      if (prevCourseType && newCourseType && prevCourseType !== newCourseType) {
        setMismatchInfo({ prevType: prevCourseType, newType: newCourseType });
        setPendingUpdatedState(updatedState);
        setIsProcessing(false);
        return;
      }

      onCourseUpdated(updatedState);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al procesar el libro actualizado.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/80 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#002855] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#00d1b2]">
              <RefreshCw className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-white uppercase tracking-wide">
              ACTUALIZAR SEGUIMIENTO
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs text-slate-700">
          <div className="p-3.5 bg-slate-50/80 backdrop-blur-xs rounded-xl border border-slate-200/80 shadow-2xs">
            <h4 className="font-bold text-[#002855] mb-1">
              Curso: {currentCourseState.courseMetadata.name}
            </h4>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Cargue el libro Excel del mismo curso que contiene el nuevo corte agregado. La aplicación detectará automáticamente las fechas y comparará los dos últimos cortes.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-2 shadow-2xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Mismatch Warning UI */}
          {mismatchInfo ? (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 space-y-2 shadow-2xs">
                <div className="flex items-center gap-2 font-bold text-xs text-amber-950 uppercase tracking-wide">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Advertencia: Cambio de Modalidad Detectado</span>
                </div>
                <p className="text-xs text-amber-900 leading-relaxed">
                  El tipo de curso detectado en el nuevo archivo (<strong>{mismatchInfo.newType}</strong>) difiere del registrado anteriormente (<strong>{mismatchInfo.prevType}</strong>).
                </p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  {mismatchInfo.newType === 'TUTORIZADO'
                    ? 'El archivo contiene columnas de tareas académicas. Al actualizar, las tareas serán requeridas para completar unidades y evaluadas con las reglas de tutoría.'
                    : 'El nuevo archivo no contiene columnas de tareas académicas. Al actualizar, se aplicarán las reglas de curso semitutorizado.'}
                  {' '}Sus decisiones tutoriales e insignias previamente guardadas se conservarán intactas.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setMismatchInfo(null);
                    setPendingUpdatedState(null);
                    setFile(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (pendingUpdatedState) {
                      onCourseUpdated(pendingUpdatedState);
                    }
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#002855] hover:bg-[#003875] rounded-lg shadow-2xs transition-colors cursor-pointer"
                >
                  Continuar y actualizar
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* File Picker */}
              <div>
                <div
                  onClick={() => !isProcessing && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                    isProcessing
                      ? 'border-slate-300 bg-slate-50 opacity-60 cursor-wait'
                      : 'border-slate-300 hover:border-[#002855] bg-slate-50/70 hover:bg-slate-100/70 shadow-2xs'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    id="input-archivo-actualizar"
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                    }}
                  />
                  <FileSpreadsheet className="w-10 h-10 text-[#00d1b2] mx-auto mb-2" />
                  <span className="font-bold text-slate-800 block text-xs mb-1">
                    {isProcessing ? 'Procesando archivo actualizado...' : 'Seleccione el libro Excel actualizado'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Detección automática de cortes DDMMYY y modalidad
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isProcessing}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
