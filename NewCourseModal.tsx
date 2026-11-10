import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { parseWorkbookCuts, parseDDMMYY, compareCuts, buildHistoricalSteps } from '../utils/excelParser';
import { CourseMetadata, CourseState, CourseType } from '../types';
import { PlusCircle, AlertCircle, FileSpreadsheet, X } from 'lucide-react';

interface NewCourseModalProps {
  hasActiveCourse?: boolean;
  onCourseCreated: (state: CourseState) => void;
  onClose: () => void;
}

export const NewCourseModal: React.FC<NewCourseModalProps> = ({
  onCourseCreated,
  onClose,
}) => {
  const [courseName, setCourseName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [selectedFirstCut, setSelectedFirstCut] = useState<string>('');
  const [detectedCuts, setDetectedCuts] = useState<string[]>([]);
  const [detectedCourseType, setDetectedCourseType] = useState<CourseType | null>(null);
  const [parsedWorkbook, setParsedWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.xlsx')) {
      setErrorMsg('El archivo seleccionado debe ser un libro de Excel con formato .xlsx');
      return;
    }

    setErrorMsg(null);
    setFile(selectedFile);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const wb = XLSX.read(buffer, {
        type: 'array',
        cellNF: true,
        cellText: true,
        cellStyles: true,
        cellDates: true,
      });
      setParsedWorkbook(wb);

      // Detect sheets matching DDMMYY and check for logical duplicates
      const valid: string[] = [];
      const dateCutMap = new Map<string, string>();
      for (const name of wb.SheetNames) {
        const parsed = parseDDMMYY(name);
        if (parsed) {
          const key = `${parsed.formatted}#${parsed.cutNumber}`;
          if (dateCutMap.has(key)) {
            const previousSheet = dateCutMap.get(key)!;
            throw new Error(
              `Se identificaron dos pestañas que representan exactamente el mismo corte lógico: "${previousSheet}" y "${name}" (Fecha: ${parsed.formatted}, Corte ${parsed.cutNumber}). Para corregirlo, modifique el nombre de una de las pestañas en su archivo Excel asignándole un número de corte diferente (ejemplo: "${name}-2") y vuelva a cargar el archivo.`
            );
          }
          dateCutMap.set(key, name);
          valid.push(name);
        }
      }

      if (valid.length === 0) {
        setErrorMsg('No se encontraron hojas con formato de fecha DDMMYY válido (ej. 030826) en el archivo seleccionado.');
        setDetectedCuts([]);
        setSelectedFirstCut('');
        setDetectedCourseType(null);
      } else {
        setDetectedCuts(valid);
        setSelectedFirstCut(valid[0]); // default to first detected
        try {
          const parsedInfo = parseWorkbookCuts(wb);
          setDetectedCourseType(parsedInfo.courseType || 'SEMITUTORIZADO');
        } catch {
          // If detailed comparison isn't ready yet, continue
        }
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al leer el archivo Excel.');
      setDetectedCuts([]);
      setSelectedFirstCut('');
      setDetectedCourseType(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseName.trim()) {
      setErrorMsg('Por favor ingrese el nombre del curso.');
      return;
    }
    if (!startDate || !endDate) {
      setErrorMsg('Por favor ingrese las fechas de inicio y término del curso.');
      return;
    }
    if (!file || !parsedWorkbook) {
      setErrorMsg('Por favor seleccione el archivo Excel (.xlsx) del curso.');
      return;
    }
    if (!selectedFirstCut) {
      setErrorMsg('Debe seleccionar la fecha del primer corte correspondiente a una hoja del libro.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const { validSheets, allCutSheetsData, academicUnits, courseType } = parseWorkbookCuts(parsedWorkbook);
      const finalCourseType = courseType || detectedCourseType || 'SEMITUTORIZADO';

      // Verify that the chosen first cut exists among the valid sheets
      const hasChosenCut = validSheets.some((s) => s.raw === selectedFirstCut);
      if (!hasChosenCut) {
        throw new Error(`La fecha del primer corte seleccionada (${selectedFirstCut}) no coincide con ninguna hoja DDMMYY del libro.`);
      }

      // Check dates order: Start Date <= End Date
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end < start) {
        throw new Error('La fecha de término no puede ser anterior a la fecha de inicio del curso.');
      }

      // Calculate days
      const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      const now = new Date();
      const daysElapsed = Math.max(0, Math.min(totalDays, Math.round((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))));
      const daysRemaining = Math.max(0, Math.round((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      const percentageElapsed = Math.min(100, Math.max(0, Math.round((daysElapsed / totalDays) * 100)));

      const courseMetadata: CourseMetadata = {
        name: courseName.trim(),
        startDate,
        endDate,
        fileName: file.name,
        courseType: finalCourseType,
        totalDays,
        daysElapsed,
        daysRemaining,
        percentageElapsed,
      };

      // Two last cuts determination
      let comparison;
      if (validSheets.length === 1) {
        // Single cut scenario
        const singleSheet = validSheets[0];
        const singleData = allCutSheetsData[singleSheet.raw] || [];
        comparison = compareCuts(null, singleData, null, singleSheet, academicUnits);
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
          undefined,
          undefined,
          { validSheets, allCutSheetsData }
        );
      }

      const history = buildHistoricalSteps(validSheets, allCutSheetsData, academicUnits);

      const courseId = `course_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const newCourseState: CourseState = {
        id: courseId,
        courseType: finalCourseType,
        courseMetadata,
        validSheets,
        academicUnits,
        allCutSheetsData,
        currentComparison: comparison,
        history,
        lastUpdated: new Date().toISOString(),
      };

      onCourseCreated(newCourseState);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al procesar el libro de seguimiento.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/80 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#002855] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#00d1b2]">
              <PlusCircle className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-white uppercase tracking-wide">
              NUEVO CURSO DE SEGUIMIENTO
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs text-slate-700">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-2 shadow-2xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Course Name */}
          <div>
            <label className="block font-semibold text-slate-800 mb-1">
              Nombre del curso <span className="text-rose-500">*</span>
            </label>
            <input
              id="input-nombre-curso"
              type="text"
              required
              placeholder="ej. Prescripción razonada de medicamentos"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white/90 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#002855] shadow-2xs"
            />
          </div>

          {/* Dates Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                Fecha de inicio <span className="text-rose-500">*</span>
              </label>
              <input
                id="input-fecha-inicio"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white/90 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#002855] shadow-2xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                Fecha de término <span className="text-rose-500">*</span>
              </label>
              <input
                id="input-fecha-termino"
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white/90 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#002855] shadow-2xs"
              />
            </div>
          </div>

          {/* File Upload */}
          <div>
            <label className="block font-semibold text-slate-800 mb-1">
              Archivo Excel del curso (.xlsx) <span className="text-rose-500">*</span>
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-[#002855] rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-50/70 hover:bg-slate-100/70 shadow-2xs"
            >
              <input
                ref={fileInputRef}
                id="input-archivo-excel"
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={handleFileChange}
              />
              <FileSpreadsheet className="w-8 h-8 text-[#00d1b2] mx-auto mb-1.5" />
              {file ? (
                <div>
                  <span className="font-bold text-slate-800 block text-xs">{file.name}</span>
                  <span className="text-[11px] text-emerald-700 font-semibold">
                    ✓ Archivo cargado ({detectedCuts.length} cortes DDMMYY detectados)
                  </span>
                </div>
              ) : (
                <div>
                  <span className="font-semibold text-slate-700 block text-xs">
                    Haga clic o arrastre el archivo Excel aquí
                  </span>
                  <span className="text-[10px] text-slate-500">Formato admitido: .xlsx</span>
                </div>
              )}
            </div>

            {detectedCourseType && (
              <div className="mt-2 flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-100/90 border border-slate-200/90 text-[11px]">
                <span className="text-slate-600 font-medium">Modalidad detectada:</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded text-[10px] tracking-wider uppercase ${
                    detectedCourseType === 'TUTORIZADO'
                      ? 'bg-[#002855] text-[#00d1b2]'
                      : 'bg-slate-200 text-slate-800'
                  }`}
                >
                  {detectedCourseType === 'TUTORIZADO' ? 'Tutorizado (con tareas)' : 'Semitutorizado'}
                </span>
              </div>
            )}
          </div>

          {/* First Cut Selector (from detected valid sheets) */}
          {detectedCuts.length > 0 && (
            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                Fecha del primer corte <span className="text-rose-500">*</span>
              </label>
              <select
                id="select-primer-corte"
                required
                value={selectedFirstCut}
                onChange={(e) => setSelectedFirstCut(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#002855] bg-white font-medium shadow-2xs"
              >
                {detectedCuts.map((sheet) => {
                  const parsed = parseDDMMYY(sheet);
                  return (
                    <option key={sheet} value={sheet}>
                      {parsed?.displayLabel || parsed?.formatted} (Hoja: {sheet})
                    </option>
                  );
                })}
              </select>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Corresponde a la hoja con el corte inicial del curso.
              </span>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              id="btn-confirmar-abrir-curso"
              type="submit"
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#00d1b2] hover:bg-[#00bda1] active:bg-[#00a890] rounded-lg shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isProcessing ? 'Procesando...' : '➕ Abrir nuevo curso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
