import React, { useState, useMemo } from 'react';
import { CutComparisonResult, InsigniaType, ProcessedStudent, TutorialState } from '../types';
import { Sparkles, X, User, ChevronRight, Search, CheckCircle2, ArrowRight } from 'lucide-react';
import { FemaleSymbol, MaleSymbol, RevisionSymbol } from './InsigniaIcons';

interface WhatChangedModalProps {
  comparison: CutComparisonResult;
  onSelectStudent: (student: ProcessedStudent) => void;
  onClose: () => void;
}

export const WhatChangedModal: React.FC<WhatChangedModalProps> = ({
  comparison,
  onSelectStudent,
  onClose,
}) => {
  const [filterState, setFilterState] = useState<TutorialState | 'NUEVO_INGRESO' | 'ALL'>('ALL');
  const [filterInsignia, setFilterInsignia] = useState<InsigniaType | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Count of new enrollments detected in current cut (0 if single cut)
  const newEnrollmentCount = useMemo(() => {
    if (comparison.isSingleCut) return 0;
    return (comparison?.students || []).filter((s) => s.isNewEnrollment).length;
  }, [comparison?.students, comparison?.isSingleCut]);

  // Identify students with new changes or new enrollments
  const newStudents = useMemo(() => {
    return (comparison?.students || []).filter((s) => {
      return Boolean(
        s.isNewEnrollment ||
        s.isNewInState ||
        s.state === 'VERDE' ||
        s.state === 'AMARILLO' ||
        (s.state === 'AZUL' && s.newlyCompleted)
      );
    });
  }, [comparison?.students]);

  // Counts of new changes per category
  const newCounts = useMemo(() => {
    const counts = {
      rojo: 0,
      amarillo: 0,
      naranja: 0,
      verde: 0,
      azul: 0,
      negro: 0,
    };

    (comparison?.students || []).forEach((s) => {
      if (s.state === 'ROJO' && s.isNewInState) counts.rojo++;
      else if (s.state === 'AMARILLO' && s.isNewInState) counts.amarillo++;
      else if (s.state === 'NARANJA' && s.isNewInState) counts.naranja++;
      else if (s.state === 'VERDE' && s.isNewInState) counts.verde++;
      else if (s.state === 'AZUL' && (s.newlyCompleted || s.isNewInState)) counts.azul++;
      else if (s.state === 'NEGRO' && s.isNewInState) counts.negro++;
    });

    return counts;
  }, [comparison?.students]);

  // Counts of new changes per insignia
  const insigniaCounts = useMemo(() => {
    let mujer = 0;
    let hombre = 0;
    let revision = 0;

    newStudents.forEach((s) => {
      const ins = s.insignia || 'REVISION';
      if (ins === 'MUJER') mujer++;
      else if (ins === 'HOMBRE') hombre++;
      else revision++;
    });

    return {
      all: newStudents.length,
      mujer,
      hombre,
      revision,
    };
  }, [newStudents]);

  // Filtered list
  const filteredList = useMemo(() => {
    return newStudents.filter((s) => {
      if (filterState === 'NUEVO_INGRESO') {
        if (!s.isNewEnrollment) return false;
      } else if (filterState !== 'ALL' && s.state !== filterState) {
        return false;
      }
      if (filterInsignia !== 'ALL') {
        const ins = s.insignia || 'REVISION';
        if (ins !== filterInsignia) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = s.nombreCompleto?.toLowerCase().includes(q) || s.nombre?.toLowerCase().includes(q);
        const matchesUser = s.usuario?.toLowerCase().includes(q);
        const matchesEvent = s.changeEventText?.toLowerCase().includes(q) || s.changeDetected?.toLowerCase().includes(q);
        const matchesNewEnrollment = Boolean(s.isNewEnrollment && ('nuevo ingreso'.includes(q) || 'ingreso'.includes(q)));
        return Boolean(matchesName || matchesUser || matchesEvent || matchesNewEnrollment);
      }
      return true;
    });
  }, [newStudents, filterState, filterInsignia, searchQuery]);

  const getStateBadgeStyle = (student: ProcessedStudent) => {
    switch (student.state) {
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
      case 'NEGRO': {
        const isNA =
          student.tutorialResolution === 'N.A' ||
          student.tutorialResolution === 'Reprobó';
        if (isNA) {
          return 'bg-purple-700 text-white border-purple-800 shadow-sm';
        }
        return 'bg-slate-900 text-white border-slate-950';
      }
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const getStateRowBg = (state: TutorialState) => {
    switch (state) {
      case 'AZUL':
        return 'bg-blue-50/70 border-blue-200/80 hover:bg-blue-100/60';
      case 'VERDE':
        return 'bg-emerald-50/70 border-emerald-200/80 hover:bg-emerald-100/60';
      case 'AMARILLO':
        return 'bg-amber-50/70 border-amber-200/80 hover:bg-amber-100/60';
      case 'NARANJA':
        return 'bg-orange-50/70 border-orange-200/80 hover:bg-orange-100/60';
      case 'ROJO':
        return 'bg-rose-50/70 border-rose-200/80 hover:bg-rose-100/60';
      case 'NEGRO':
        return 'bg-slate-100/90 border-slate-300 hover:bg-slate-200/80';
      default:
        return 'bg-white border-slate-200 hover:bg-slate-50';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/80 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#002855] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#00d1b2]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white uppercase tracking-wide">
                  QUÉ CAMBIÓ HOY
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00d1b2] text-[#002855]">
                  {newStudents.length} {newStudents.length === 1 ? 'cambio nuevo' : 'cambios nuevos'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                {comparison.previousDate ? (
                  <>
                    Comparación entre el corte{' '}
                    <strong className="text-white">
                      {comparison.previousDate.displayLabel || comparison.previousDate.formatted}
                    </strong>{' '}
                    y el corte{' '}
                    <strong className="text-white">
                      {comparison.currentDate.displayLabel || comparison.currentDate.formatted}
                    </strong>{' '}
                    ({comparison.diffDays === 0
                      ? 'mismo día'
                      : `${comparison.diffDays} ${comparison.diffDays === 1 ? 'día transcurrido' : 'días transcurridos'}`})
                  </>
                ) : (
                  <>
                    Corte único analizado:{' '}
                    {comparison.currentDate.displayLabel || comparison.currentDate.formatted}
                  </>
                )}
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

        {/* Summary category cards */}
        <div className="p-4 bg-slate-50 border-b border-slate-200/80 shrink-0">
          <div className={`grid grid-cols-2 sm:grid-cols-3 ${newEnrollmentCount > 0 ? 'lg:grid-cols-7' : 'md:grid-cols-6'} gap-2`}>
            {/* 🚨 NUEVO INGRESO (ONLY IF newEnrollmentCount > 0) */}
            {newEnrollmentCount > 0 && (
              <button
                onClick={() => setFilterState(filterState === 'NUEVO_INGRESO' ? 'ALL' : 'NUEVO_INGRESO')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden animate-alert-glow ${
                  filterState === 'NUEVO_INGRESO'
                    ? 'ring-2 ring-red-400 border-red-300 shadow-md'
                    : 'border-red-900/60 hover:brightness-110 shadow-xs'
                }`}
                style={{ backgroundColor: '#7F1D1D', color: '#ffffff' }}
              >
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="flex items-center gap-1">
                    <span>🚨</span>
                    <span>NUEVO INGRESO</span>
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded font-black ${
                      filterState === 'NUEVO_INGRESO'
                        ? 'bg-white text-[#7F1D1D]'
                        : 'bg-red-950/80 text-red-200 border border-red-700/60'
                    }`}
                  >
                    {newEnrollmentCount}
                  </span>
                </div>
                <span className="text-[10px] block mt-0.5 text-red-200 font-medium">
                  Alumnos incorporados
                </span>
              </button>
            )}

            {/* Azul */}
            <button
              onClick={() => setFilterState(filterState === 'AZUL' ? 'ALL' : 'AZUL')}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                filterState === 'AZUL'
                  ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                  : 'bg-white hover:bg-blue-50 border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span>🔵 TERMINÓ</span>
                <span className={`px-1.5 py-0.2 rounded font-black ${filterState === 'AZUL' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-900'}`}>
                  {newCounts.azul}
                </span>
              </div>
              <span className={`text-[10px] block mt-0.5 ${filterState === 'AZUL' ? 'text-blue-100' : 'text-slate-500'}`}>
                Nuevos terminados
              </span>
            </button>

            {/* Verde */}
            <button
              onClick={() => setFilterState(filterState === 'VERDE' ? 'ALL' : 'VERDE')}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                filterState === 'VERDE'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                  : 'bg-white hover:bg-emerald-50 border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span>🟢 AVANZANDO</span>
                <span className={`px-1.5 py-0.2 rounded font-black ${filterState === 'VERDE' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-900'}`}>
                  {newCounts.verde}
                </span>
              </div>
              <span className={`text-[10px] block mt-0.5 ${filterState === 'VERDE' ? 'text-emerald-100' : 'text-slate-500'}`}>
                Nuevos avances
              </span>
            </button>

            {/* Amarillo */}
            <button
              onClick={() => setFilterState(filterState === 'AMARILLO' ? 'ALL' : 'AMARILLO')}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                filterState === 'AMARILLO'
                  ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                  : 'bg-white hover:bg-amber-50 border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span>🟡 PAUSA</span>
                <span className={`px-1.5 py-0.2 rounded font-black ${filterState === 'AMARILLO' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-900'}`}>
                  {newCounts.amarillo}
                </span>
              </div>
              <span className={`text-[10px] block mt-0.5 ${filterState === 'AMARILLO' ? 'text-amber-100' : 'text-slate-500'}`}>
                Avances parciales
              </span>
            </button>

            {/* Naranja */}
            <button
              onClick={() => setFilterState(filterState === 'NARANJA' ? 'ALL' : 'NARANJA')}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                filterState === 'NARANJA'
                  ? 'bg-orange-600 text-white border-orange-700 shadow-sm'
                  : 'bg-white hover:bg-orange-50 border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span>🟠 SIN AVANCE</span>
                <span className={`px-1.5 py-0.2 rounded font-black ${filterState === 'NARANJA' ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-900'}`}>
                  {newCounts.naranja}
                </span>
              </div>
              <span className={`text-[10px] block mt-0.5 ${filterState === 'NARANJA' ? 'text-orange-100' : 'text-slate-500'}`}>
                Sin nueva actividad
              </span>
            </button>

            {/* Rojo */}
            <button
              onClick={() => setFilterState(filterState === 'ROJO' ? 'ALL' : 'ROJO')}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                filterState === 'ROJO'
                  ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                  : 'bg-white hover:bg-rose-50 border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span>🔴 SIN INICIO</span>
                <span className={`px-1.5 py-0.2 rounded font-black ${filterState === 'ROJO' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-900'}`}>
                  {newCounts.rojo}
                </span>
              </div>
              <span className={`text-[10px] block mt-0.5 ${filterState === 'ROJO' ? 'text-rose-100' : 'text-slate-500'}`}>
                Nuevos sin iniciar
              </span>
            </button>

            {/* Negro */}
            <button
              onClick={() => setFilterState(filterState === 'NEGRO' ? 'ALL' : 'NEGRO')}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                filterState === 'NEGRO'
                  ? 'bg-slate-900 text-white border-black shadow-sm'
                  : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span>⚫ REV. CALIF.</span>
                <span className={`px-1.5 py-0.2 rounded font-black ${filterState === 'NEGRO' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-900'}`}>
                  {newCounts.negro}
                </span>
              </div>
              <span className={`text-[10px] block mt-0.5 ${filterState === 'NEGRO' ? 'text-slate-300' : 'text-slate-500'}`}>
                Nuevos casos &lt; 80
              </span>
            </button>
          </div>

          {/* Insignia filter row */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200/60 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
              Insignia:
            </span>
            <button
              onClick={() => setFilterInsignia('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                filterInsignia === 'ALL'
                  ? 'bg-[#002855] text-white border-[#002855] shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Todas ({insigniaCounts.all})
            </button>
            <button
              onClick={() => setFilterInsignia(filterInsignia === 'MUJER' ? 'ALL' : 'MUJER')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                filterInsignia === 'MUJER'
                  ? 'bg-red-600 text-white border-red-700 shadow-2xs'
                  : 'bg-white text-red-600 border-red-200 hover:bg-red-50'
              }`}
            >
              <FemaleSymbol size={18} className={filterInsignia === 'MUJER' ? 'text-white' : 'text-red-600'} />
              <span>Mujeres ({insigniaCounts.mujer})</span>
            </button>
            <button
              onClick={() => setFilterInsignia(filterInsignia === 'HOMBRE' ? 'ALL' : 'HOMBRE')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                filterInsignia === 'HOMBRE'
                  ? 'bg-blue-600 text-white border-blue-700 shadow-2xs'
                  : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'
              }`}
            >
              <MaleSymbol size={18} className={filterInsignia === 'HOMBRE' ? 'text-white' : 'text-blue-600'} />
              <span>Hombres ({insigniaCounts.hombre})</span>
            </button>
            <button
              onClick={() => setFilterInsignia(filterInsignia === 'REVISION' ? 'ALL' : 'REVISION')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                filterInsignia === 'REVISION'
                  ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                  : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
              }`}
            >
              <RevisionSymbol size={12} className={filterInsignia === 'REVISION' ? 'text-white' : 'text-amber-500'} />
              <span>Revisión ({insigniaCounts.revision})</span>
            </button>
          </div>

          {/* Search bar & filter pill */}
          <div className="flex items-center justify-between gap-3 mt-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por alumno o evento..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#002855] shadow-2xs"
              />
            </div>

            {(filterState !== 'ALL' || filterInsignia !== 'ALL') && (
              <button
                onClick={() => {
                  setFilterState('ALL');
                  setFilterInsignia('ALL');
                }}
                className="text-xs text-[#002855] hover:underline font-semibold cursor-pointer"
              >
                ✕ Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* Students list */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          {filteredList.length === 0 ? (
            <div className="text-center py-12 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <CheckCircle2 className="w-9 h-9 text-[#00d1b2] mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-700">
                {searchQuery || filterState !== 'ALL' || filterInsignia !== 'ALL'
                  ? 'No se encontraron alumnos con el criterio seleccionado'
                  : 'No se detectaron cambios nuevos en este corte'}
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                {searchQuery || filterState !== 'ALL' || filterInsignia !== 'ALL'
                  ? 'Intente limpiar los filtros de búsqueda.'
                  : 'Todos los alumnos mantienen el mismo estado que en el corte anterior.'}
              </p>
            </div>
          ) : (
            filteredList.map((student) => {
              const rowBg = getStateRowBg(student.state);
              const badgeStyle = getStateBadgeStyle(student);
              const isNewlyCompleted = student.state === 'AZUL' && student.newlyCompleted;

              return (
                <div
                  key={student.usuario || student.email}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs ${rowBg}`}
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-slate-900">
                        {student.nombreCompleto || `${student.nombre} ${student.apellidos}`}
                      </span>

                      {/* Insignia symbol - enlarged to approx 20px */}
                      {student.insignia === 'MUJER' && (
                        <FemaleSymbol
                          size={20}
                          className="text-red-600 cursor-help"
                          title="Mujer"
                        />
                      )}
                      {student.insignia === 'HOMBRE' && (
                        <MaleSymbol
                          size={20}
                          className="text-blue-600 cursor-help"
                          title="Hombre"
                        />
                      )}
                      {(!student.insignia || student.insignia === 'REVISION') && (
                        <RevisionSymbol
                          size={14}
                          className="text-amber-500 cursor-help"
                          title="Revisión de insignia"
                        />
                      )}

                      {/* 🚨 NUEVO INGRESO Badge */}
                      {student.isNewEnrollment && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-white shadow-2xs"
                          style={{ backgroundColor: '#7F1D1D' }}
                        >
                          <span>🚨</span>
                          <span>NUEVO INGRESO</span>
                        </span>
                      )}

                      {/* State Badge */}
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${badgeStyle}`}
                      >
                        {student.state === 'NEGRO'
                          ? (student.tutorialResolution === 'N.A' || student.tutorialResolution === 'Reprobó')
                            ? 'REV. CALIF. · N.A'
                            : student.tutorialResolution === 'Segundo intento otorgado'
                            ? 'REV. CALIF. · 2.º INTENTO'
                            : 'REV. CALIF.'
                          : student.stateLabel}
                      </span>

                      {/* Tag NUEVO */}
                      {!student.isNewEnrollment && (
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-black tracking-wide bg-slate-900 text-[#00d1b2]">
                          NUEVO
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-x-4 gap-y-1 text-xs text-slate-600 flex-wrap">
                      <span className="text-[11px] font-mono text-slate-500">
                        Usuario: {student.usuario}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                        <span className="text-slate-400 font-normal">Evento:</span>
                        <span>{student.changeEventText || student.changeDetected}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-black/5">
                    <button
                      onClick={() => {
                        onClose();
                        onSelectStudent(student);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#002855] bg-white hover:bg-slate-100 rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                    >
                      <span>Ver detalle</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            Mostrando {filteredList.length} de {newStudents.length} eventos nuevos
          </span>
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
