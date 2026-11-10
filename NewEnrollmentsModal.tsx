import React, { useState, useMemo } from 'react';
import { DateDDMMYY, ProcessedStudent, TutorialState, InsigniaType } from '../types';
import { X, Search, Copy, Check, Eye, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { FemaleSymbol, MaleSymbol, RevisionSymbol } from './InsigniaIcons';
import { getStudentPersonalizedMessage } from '../utils/messages';
import { formatAcademicUnitIdentifier } from '../utils/excelParser';

interface NewEnrollmentsModalProps {
  students: ProcessedStudent[];
  previousDate?: DateDDMMYY;
  currentDate: DateDDMMYY;
  onSelectStudent: (student: ProcessedStudent) => void;
  onClose: () => void;
}

type SortField = 'nombre' | 'state' | 'usuario';
type SortDirection = 'asc' | 'desc';

export const NewEnrollmentsModal: React.FC<NewEnrollmentsModalProps> = ({
  students,
  previousDate,
  currentDate,
  onSelectStudent,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('nombre');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter exclusively new enrollment students
  const newEnrollmentStudents = useMemo(() => {
    return (students || []).filter((s) => s.isNewEnrollment);
  }, [students]);

  // Search filtering (by name, usuario, email)
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return newEnrollmentStudents;
    const q = searchQuery.toLowerCase().trim();
    return newEnrollmentStudents.filter((s) => {
      const matchName = String(s.nombreCompleto || `${s.nombre} ${s.apellidos}`).toLowerCase().includes(q);
      const matchUser = String(s.usuario || '').toLowerCase().includes(q);
      const matchEmail = String(s.email || '').toLowerCase().includes(q);
      return matchName || matchUser || matchEmail;
    });
  }, [newEnrollmentStudents, searchQuery]);

  // Priority ranking for academic states
  const stateRankMap: Record<TutorialState, number> = {
    ROJO: 1,
    AMARILLO: 2,
    NARANJA: 3,
    VERDE: 4,
    AZUL: 5,
    NEGRO: 6,
    INICIADO_PRIMER_CORTE: 7,
  };

  // Sorting
  const sortedStudents = useMemo(() => {
    return [...filteredStudents].sort((a, b) => {
      let diff = 0;
      if (sortField === 'nombre') {
        const nameA = String(a.nombreCompleto || `${a.nombre} ${a.apellidos}`).toLowerCase();
        const nameB = String(b.nombreCompleto || `${b.nombre} ${b.apellidos}`).toLowerCase();
        diff = nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
      } else if (sortField === 'state') {
        const rankA = stateRankMap[a.state] || 99;
        const rankB = stateRankMap[b.state] || 99;
        diff = rankA - rankB;
      } else if (sortField === 'usuario') {
        const userA = String(a.usuario || '').toLowerCase();
        const userB = String(b.usuario || '').toLowerCase();
        diff = userA.localeCompare(userB, undefined, { numeric: true });
      }
      return sortDirection === 'asc' ? diff : -diff;
    });
  }, [filteredStudents, sortField, sortDirection]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const copyMessage = (student: ProcessedStudent, e: React.MouseEvent) => {
    e.stopPropagation();
    const msg = getStudentPersonalizedMessage(student);
    navigator.clipboard.writeText(msg);
    const key = student.usuario || student.email;
    setCopiedId(key);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const getStateBadge = (student: ProcessedStudent) => {
    switch (student.state) {
      case 'ROJO':
        return {
          bg: 'bg-rose-100 text-rose-900 border-rose-300',
          dot: 'bg-rose-500',
          label: 'SIN INICIO',
          borderColor: '#e11d48',
        };
      case 'AMARILLO':
        return {
          bg: 'bg-amber-100 text-amber-900 border-amber-300',
          dot: 'bg-amber-500',
          label: 'PAUSA',
          borderColor: '#f59e0b',
        };
      case 'VERDE':
        return {
          bg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
          dot: 'bg-emerald-500',
          label: 'AVANZANDO',
          borderColor: '#10b981',
        };
      case 'AZUL':
        return {
          bg: 'bg-blue-100 text-blue-900 border-blue-300',
          dot: 'bg-blue-500',
          label: 'TERMINÓ',
          borderColor: '#2563eb',
        };
      case 'NEGRO': {
        const isNA = student.tutorialResolution === 'N.A' || student.tutorialResolution === 'Reprobó';
        if (isNA) {
          return {
            bg: 'bg-purple-700 text-white border-purple-800 shadow-xs',
            dot: 'bg-purple-200',
            label: 'REV. CALIF. · N.A',
            borderColor: '#9333ea',
          };
        }
        return {
          bg: 'bg-slate-900 text-white border-slate-950',
          dot: 'bg-white',
          label: 'REV. CALIF.',
          borderColor: '#0f172a',
        };
      }
      default:
        return {
          bg: 'bg-slate-100 text-slate-800 border-slate-300',
          dot: 'bg-slate-500',
          label: 'INICIADO',
          borderColor: '#94a3b8',
        };
    }
  };

  const getInsigniaBadge = (insignia?: InsigniaType) => {
    const ins = insignia || 'REVISION';
    switch (ins) {
      case 'MUJER':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
            <FemaleSymbol size={16} className="text-red-600" />
            <span>MUJER</span>
          </span>
        );
      case 'HOMBRE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <MaleSymbol size={16} className="text-blue-600" />
            <span>HOMBRE</span>
          </span>
        );
      case 'REVISION':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <RevisionSymbol size={11} className="text-amber-500" />
            <span>REVISIÓN</span>
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-white/80 w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Encabezado Institucional */}
        <div className="p-4 sm:p-5 bg-[#002855] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl shrink-0 shadow-inner">
              <span className="motion-safe:animate-pulse">🚨</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-white uppercase tracking-wide">
                  🚨 NUEVOS INGRESOS
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#7F1D1D] text-white border border-red-400/40 shadow-xs">
                  {newEnrollmentStudents.length} {newEnrollmentStudents.length === 1 ? 'alumno' : 'alumnos'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Alumnos incorporados entre{' '}
                <strong className="text-white">
                  {previousDate?.displayLabel || previousDate?.formatted || 'corte previo'}
                </strong>{' '}
                y{' '}
                <strong className="text-white">
                  {currentDate.displayLabel || currentDate.formatted}
                </strong>
                .
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Búsqueda y Filtros Rápidos */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nombre o usuario..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#002855] shadow-2xs"
            />
          </div>

          <div className="text-xs text-slate-500 font-medium self-end sm:self-center">
            Mostrando <strong>{sortedStudents.length}</strong> de <strong>{newEnrollmentStudents.length}</strong> nuevos ingresos
          </div>
        </div>

        {/* Tabla con desplazamiento vertical independiente */}
        <div className="overflow-auto flex-1 text-xs">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 text-[11px] uppercase tracking-wider text-white select-none">
              <tr style={{ backgroundColor: '#002855' }}>
                {/* 1. ALUMNO */}
                <th
                  onClick={() => toggleSort('nombre')}
                  style={{ backgroundColor: '#002855' }}
                  className="py-3 px-4 font-bold cursor-pointer hover:bg-[#003366] transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>ALUMNO</span>
                    {sortField === 'nombre' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#00d1b2]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#00d1b2]" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-300 opacity-60" />
                    )}
                  </div>
                </th>

                {/* 2. INSIGNIA */}
                <th style={{ backgroundColor: '#002855' }} className="py-3 px-3 font-bold text-center">
                  INSIGNIA
                </th>

                {/* 3. USUARIO */}
                <th
                  onClick={() => toggleSort('usuario')}
                  style={{ backgroundColor: '#002855' }}
                  className="py-3 px-3 font-bold cursor-pointer hover:bg-[#003366] transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>USUARIO</span>
                    {sortField === 'usuario' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#00d1b2]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#00d1b2]" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-300 opacity-60" />
                    )}
                  </div>
                </th>

                {/* 4. EMAIL */}
                <th style={{ backgroundColor: '#002855' }} className="py-3 px-3 font-bold">
                  EMAIL
                </th>

                {/* 5. UNIDAD TERMINADA */}
                <th style={{ backgroundColor: '#002855' }} className="py-3 px-3 font-bold text-center">
                  U. TERMINADA
                </th>

                {/* 6. ESTADO ACADÉMICO */}
                <th
                  onClick={() => toggleSort('state')}
                  style={{ backgroundColor: '#002855' }}
                  className="py-3 px-3 font-bold cursor-pointer hover:bg-[#003366] transition-colors text-center"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>ESTADO ACADÉMICO</span>
                    {sortField === 'state' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#00d1b2]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#00d1b2]" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-300 opacity-60" />
                    )}
                  </div>
                </th>

                {/* 7. CAMBIO DETECTADO */}
                <th style={{ backgroundColor: '#002855' }} className="py-3 px-3 font-bold">
                  CAMBIO DETECTADO
                </th>

                {/* 8. ACCIÓN */}
                <th style={{ backgroundColor: '#002855' }} className="py-3 px-3 font-bold text-center">
                  ACCIÓN
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-slate-800">
              {sortedStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 bg-slate-50/50">
                    {searchQuery
                      ? 'No se encontraron alumnos de nuevo ingreso con ese criterio de búsqueda.'
                      : 'No se identificaron alumnos de nuevo ingreso en este corte.'}
                  </td>
                </tr>
              ) : (
                sortedStudents.map((s) => {
                  const badge = getStateBadge(s);
                  const isCopied = (s.usuario || s.email) === copiedId;
                  const unitLabel = s.currentCompletedUnitKey
                    ? formatAcademicUnitIdentifier(s.currentCompletedUnitKey)
                    : s.currentCompletedUnit > 0
                    ? `U${s.currentCompletedUnit}`
                    : '-';

                  return (
                    <tr
                      key={s.usuario || s.email}
                      onClick={() => onSelectStudent(s)}
                      className="hover:bg-slate-50/90 transition-colors cursor-pointer group border-b border-slate-100"
                    >
                      {/* 1. Alumno con línea de borde lateral según su estado académico real */}
                      <td
                        className="py-3 px-4 font-medium"
                        style={{
                          borderLeftWidth: '4px',
                          borderLeftStyle: 'solid',
                          borderLeftColor: badge.borderColor,
                        }}
                      >
                        <div className="font-bold text-slate-900 group-hover:text-[#002855] text-xs">
                          {s.nombreCompleto || `${s.nombre} ${s.apellidos}`}
                        </div>
                        <div className="mt-1">
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-white shadow-2xs"
                            style={{ backgroundColor: '#7F1D1D' }}
                          >
                            <span>🚨</span>
                            <span>NUEVO INGRESO</span>
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {[s.ciudad, s.departamento].filter(Boolean).join(', ')}
                        </div>
                      </td>

                      {/* 2. Insignia */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {getInsigniaBadge(s.insignia)}
                      </td>

                      {/* 3. Usuario */}
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                        {s.usuario}
                      </td>

                      {/* 4. Email */}
                      <td className="py-3 px-3 text-slate-600 truncate max-w-[180px]">
                        {s.email || '-'}
                      </td>

                      {/* 5. Unidad Terminada */}
                      <td className="py-3 px-3 text-center font-bold text-slate-700 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px]">
                          {unitLabel}
                        </span>
                      </td>

                      {/* 6. Estado Académico Real */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      {/* 7. Cambio Detectado */}
                      <td className="py-3 px-3 text-slate-600 max-w-[220px]">
                        <span className="text-xs line-clamp-2">
                          {s.changeDetected || s.changeEventText || 'Nuevo ingreso al curso'}
                        </span>
                      </td>

                      {/* 8. Acción */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={(e) => copyMessage(s, e)}
                            title="Copiar mensaje personalizado"
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                              isCopied
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-200'
                            }`}
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>✓ Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copiar</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectStudent(s);
                            }}
                            title="Ver detalle del alumno"
                            className="p-1 rounded-md hover:bg-slate-200/80 text-slate-600 transition-colors cursor-pointer border border-slate-200"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            Mostrando {sortedStudents.length} de {newEnrollmentStudents.length} alumnos de nuevo ingreso
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
