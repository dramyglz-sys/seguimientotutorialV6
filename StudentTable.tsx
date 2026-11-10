import React, { useState, useMemo } from 'react';
import { AcademicUnit, InsigniaType, ProcessedStudent, TutorialState } from '../types';
import { formatAcademicUnitIdentifier } from '../utils/excelParser';
import { getStudentPersonalizedMessage } from '../utils/messages';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Copy, Check, Eye } from 'lucide-react';
import { FemaleSymbol, MaleSymbol, RevisionSymbol, getInsigniaColorStyles } from './InsigniaIcons';

export type SortField =
  | 'nombre'
  | 'insignia'
  | 'usuario'
  | 'previousCompletedUnit'
  | 'currentCompletedUnit'
  | 'changeDetected'
  | 'state';

export type SortDirection = 'asc' | 'desc';

interface StudentTableProps {
  students: ProcessedStudent[];
  academicUnits?: AcademicUnit[];
  selectedStateFilter: TutorialState | 'ALL';
  onSelectStateFilter: (state: TutorialState | 'ALL') => void;
  onSelectStudent: (student: ProcessedStudent) => void;
  onUpdateInsignia?: (usuario: string, insignia: InsigniaType) => Promise<void> | void;
}

/**
 * Computes numeric rank for academic unit ordering.
 * - Sin unidad (-): returns -1
 * - Units are ordered by curriculum order or (module * 10000 + unitNumber)
 * - Guarantees U10 comes after U9 (not alphabetically between U1 and U2)
 * - Guarantees module M2 units come after module M1 units
 */
export function getAcademicUnitSortRank(
  unitKey?: string | null,
  unitNumber?: number | null,
  unitIndexMap?: Map<string, number>
): number {
  const cleanKey = (unitKey || '').trim();
  const num = typeof unitNumber === 'number' && !isNaN(unitNumber) ? unitNumber : 0;

  // Si no hay unidad completada (muestra '-')
  if ((!cleanKey || cleanKey === '-' || cleanKey === '0') && num <= 0) {
    return -1;
  }

  // 1. Mapeo curricular exacto del curso si está disponible
  if (unitIndexMap && unitIndexMap.size > 0) {
    if (cleanKey) {
      const up = cleanKey.toUpperCase();
      if (unitIndexMap.has(up)) return unitIndexMap.get(up)! + 1;
      const formatted = formatAcademicUnitIdentifier(cleanKey).toUpperCase();
      if (unitIndexMap.has(formatted)) return unitIndexMap.get(formatted)! + 1;
      const cleanNoU = cleanKey.replace(/^U_?/i, '').toUpperCase();
      if (unitIndexMap.has(cleanNoU)) return unitIndexMap.get(cleanNoU)! + 1;
    }
    if (num > 0) {
      const uStr = `U${num}`.toUpperCase();
      if (unitIndexMap.has(uStr)) return unitIndexMap.get(uStr)! + 1;
      if (unitIndexMap.has(String(num))) return unitIndexMap.get(String(num))! + 1;
    }
  }

  // 2. Clave compuesta M<mod>-U<unit> (ej. "U_M1-U1", "M2-U3", "M1_U2")
  const mMatch = cleanKey.match(/M(\d+)[\s_-]*U(\d+)/i);
  if (mMatch) {
    const mod = parseInt(mMatch[1], 10) || 0;
    const u = parseInt(mMatch[2], 10) || 0;
    return mod * 10000 + u;
  }

  // 3. Clave simple U<unit> (ej. "U1", "U10", "U17")
  const uMatch = cleanKey.match(/^U_?(\d+)$/i);
  if (uMatch) {
    const u = parseInt(uMatch[1], 10) || 0;
    return u;
  }

  // 4. Número directo en clave
  const rawNumMatch = cleanKey.match(/^(\d+)$/);
  if (rawNumMatch) {
    return parseInt(rawNumMatch[1], 10) || 0;
  }

  // 5. unitNumber numérico directo
  if (num > 0) {
    return num;
  }

  return -1;
}

/**
 * Comparador seguro para nombres de alumnos (A-Z / Z-A)
 */
function compareAlumno(a: ProcessedStudent, b: ProcessedStudent): number {
  const nameA = String(a.nombreCompleto || a.nombre || '').trim();
  const nameB = String(b.nombreCompleto || b.nombre || '').trim();
  return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
}

/**
 * Comparador seguro para categorías de insignia (MUJER, HOMBRE, REVISIÓN)
 */
const INSIGNIA_ORDER: Record<string, number> = {
  MUJER: 1,
  HOMBRE: 2,
  REVISION: 3,
};

function compareInsignia(insA?: InsigniaType | null, insB?: InsigniaType | null): number {
  const valA = insA && INSIGNIA_ORDER[insA] ? INSIGNIA_ORDER[insA] : 3;
  const valB = insB && INSIGNIA_ORDER[insB] ? INSIGNIA_ORDER[insB] : 3;
  return valA - valB;
}

/**
 * Comparador numérico seguro para usuarios (conservando el identificador original)
 */
function compareUsers(userA?: string | null, userB?: string | null): number {
  const strA = String(userA ?? '').trim();
  const strB = String(userB ?? '').trim();

  if (!strA && !strB) return 0;
  if (!strA) return 1;
  if (!strB) return -1;

  const numA = Number(strA);
  const numB = Number(strB);

  const isNumA = !isNaN(numA) && strA !== '';
  const isNumB = !isNaN(numB) && strB !== '';

  if (isNumA && isNumB) {
    return numA - numB;
  }

  return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Comparador seguro para estados académicos por categoría existente
 */
const STATE_ORDER: Record<string, number> = {
  ROJO: 1,      // SIN INICIO
  AMARILLO: 2,  // PAUSA
  NARANJA: 3,   // SIN AVANCE
  VERDE: 4,     // AVANZANDO
  AZUL: 5,      // TERMINÓ
  NEGRO: 6,     // REV. CALIF.
  INICIADO_PRIMER_CORTE: 7,
};

function compareState(stateA?: TutorialState | string | null, stateB?: TutorialState | string | null): number {
  const rankA = stateA && STATE_ORDER[stateA] ? STATE_ORDER[stateA] : 99;
  const rankB = stateB && STATE_ORDER[stateB] ? STATE_ORDER[stateB] : 99;
  return rankA - rankB;
}

/**
 * Comparador seguro para cambio detectado (A-Z / Z-A)
 */
function compareChangeDetected(changeA?: string | null, changeB?: string | null): number {
  const strA = String(changeA ?? '').trim();
  const strB = String(changeB ?? '').trim();
  return strA.localeCompare(strB, 'es', { sensitivity: 'base' });
}

export const StudentTable: React.FC<StudentTableProps> = ({
  students,
  academicUnits,
  selectedStateFilter,
  onSelectStateFilter,
  onSelectStudent,
  onUpdateInsignia,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
  const [selectedInsigniaFilter, setSelectedInsigniaFilter] = useState<InsigniaType | 'ALL'>('ALL');
  const [sortField, setSortField] = useState<SortField>('nombre');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [selectedTaskFilter, setSelectedTaskFilter] = useState<'ALL' | 'PENDING' | 'FAILED' | 'APPROVED'>('ALL');

  // Mapeo ordenado de unidades académicas del curso para secuencia curricular exacta
  const unitIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    if (academicUnits && Array.isArray(academicUnits)) {
      academicUnits.forEach((u, index) => {
        if (u.unitKey) {
          map.set(u.unitKey.toUpperCase(), index);
          map.set(formatAcademicUnitIdentifier(u.unitKey).toUpperCase(), index);
          map.set(u.unitKey.replace(/^U_?/i, '').toUpperCase(), index);
        }
        if (u.unitNumber) {
          map.set(`U${u.unitNumber}`.toUpperCase(), index);
          map.set(String(u.unitNumber), index);
        }
      });
    }
    return map;
  }, [academicUnits]);

  // Extract all distinct completed units available, ordenadas por secuencia académica
  const availableUnits = useMemo(() => {
    const units = new Set<string>();
    students.forEach((s) => {
      if (s.currentCompletedUnitKey) {
        units.add(formatAcademicUnitIdentifier(s.currentCompletedUnitKey));
      } else if (s.currentCompletedUnit > 0) {
        units.add(`U${s.currentCompletedUnit}`);
      }
    });
    return Array.from(units).sort((a, b) => {
      return (
        getAcademicUnitSortRank(a, null, unitIndexMap) -
        getAcademicUnitSortRank(b, null, unitIndexMap)
      );
    });
  }, [students, unitIndexMap]);

  const isTutorizado = students.some((s) => s.courseType === 'TUTORIZADO');

  // 1. Filtrar primero los alumnos sin mutar los datos originales
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      // 1. State filter
      if (selectedStateFilter !== 'ALL' && s.state !== selectedStateFilter) {
        return false;
      }

      // 2. Unit filter (based on completed unit key or number)
      if (selectedUnit !== 'ALL') {
        if (selectedUnit === '0') {
          if (s.currentCompletedUnit > 0 || s.currentCompletedUnitKey) return false;
        } else {
          const matchKey = s.currentCompletedUnitKey || `U${s.currentCompletedUnit}`;
          if (matchKey !== selectedUnit && String(s.currentCompletedUnit) !== selectedUnit) {
            return false;
          }
        }
      }

      // 3. Insignia filter
      if (selectedInsigniaFilter !== 'ALL') {
        const studentInsignia = s.insignia || 'REVISION';
        if (studentInsignia !== selectedInsigniaFilter) return false;
      }

      // 4. Task status filter (for TUTORIZADO)
      if (selectedTaskFilter !== 'ALL' && s.tasksSummary) {
        if (selectedTaskFilter === 'PENDING' && s.tasksSummary.pendingTasks === 0) return false;
        if (selectedTaskFilter === 'FAILED' && s.tasksSummary.failedTasks === 0) return false;
        if (selectedTaskFilter === 'APPROVED' && (s.tasksSummary.pendingTasks > 0 || s.tasksSummary.failedTasks > 0)) return false;
      }

      // 5. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = String(s.nombreCompleto || '').toLowerCase().includes(q);
        const matchesUser = String(s.usuario || '').toLowerCase().includes(q);
        const matchesEmail = String(s.email || '').toLowerCase().includes(q);
        const matchesCity = String(s.ciudad || '').toLowerCase().includes(q);
        const matchesNewEnrollment = Boolean(s.isNewEnrollment && ('nuevo ingreso'.includes(q) || 'ingreso'.includes(q)));
        return matchesName || matchesUser || matchesEmail || matchesCity || matchesNewEnrollment;
      }

      return true;
    });
  }, [students, selectedStateFilter, selectedUnit, selectedInsigniaFilter, selectedTaskFilter, searchQuery]);

  // 2. Ordenar una copia de los registros filtrados de forma completamente segura
  const sortedStudents = useMemo(() => {
    try {
      return [...filteredStudents].sort((a, b) => {
        let diff = 0;

        switch (sortField) {
          case 'nombre':
            diff = compareAlumno(a, b);
            break;
          case 'insignia':
            diff = compareInsignia(a.insignia, b.insignia);
            break;
          case 'usuario':
            diff = compareUsers(a.usuario, b.usuario);
            break;
          case 'previousCompletedUnit': {
            const rankA = getAcademicUnitSortRank(a.previousCompletedUnitKey, a.previousCompletedUnit, unitIndexMap);
            const rankB = getAcademicUnitSortRank(b.previousCompletedUnitKey, b.previousCompletedUnit, unitIndexMap);
            diff = rankA - rankB;
            break;
          }
          case 'currentCompletedUnit': {
            const rankA = getAcademicUnitSortRank(a.currentCompletedUnitKey, a.currentCompletedUnit, unitIndexMap);
            const rankB = getAcademicUnitSortRank(b.currentCompletedUnitKey, b.currentCompletedUnit, unitIndexMap);
            diff = rankA - rankB;
            break;
          }
          case 'changeDetected':
            diff = compareChangeDetected(a.changeDetected, b.changeDetected);
            break;
          case 'state':
            diff = compareState(a.state, b.state);
            break;
          default:
            diff = compareAlumno(a, b);
            break;
        }

        // Si son iguales en el campo principal y no es la columna nombre, usar nombre como desempate secundario
        if (diff === 0 && sortField !== 'nombre') {
          return compareAlumno(a, b);
        }

        return sortDirection === 'asc' ? diff : -diff;
      });
    } catch (err) {
      console.error('Error al ordenar la lista de alumnos:', err);
      return filteredStudents;
    }
  }, [filteredStudents, sortField, sortDirection, unitIndexMap]);

  // Alterna entre orden ascendente y descendente en cada clic
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Renderiza el icono visual con la dirección activa o el símbolo neutro ↕
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return (
        <ArrowUpDown className="w-3.5 h-3.5 text-slate-300 opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
      );
    }
    if (sortDirection === 'asc') {
      return (
        <ArrowUp className="w-3.5 h-3.5 text-[#00d1b2] font-bold shrink-0" />
      );
    }
    return (
      <ArrowDown className="w-3.5 h-3.5 text-[#00d1b2] font-bold shrink-0" />
    );
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
          bg: 'bg-red-50 text-red-700 border-red-200',
          dot: 'bg-red-500',
          label: 'SIN INICIO',
          borderClass: 'border-l-4 border-l-red-500',
          borderColor: '#ef4444',
        };
      case 'AMARILLO':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          dot: 'bg-amber-500',
          label: 'PAUSA',
          borderClass: 'border-l-4 border-l-amber-400',
          borderColor: '#fbbf24',
        };
      case 'NARANJA':
        return {
          bg: 'bg-orange-50 text-orange-800 border-orange-200',
          dot: 'bg-orange-500',
          label: 'SIN AVANCE',
          borderClass: 'border-l-4 border-l-orange-500',
          borderColor: '#f97316',
        };
      case 'VERDE':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          dot: 'bg-emerald-500',
          label: 'AVANZANDO',
          borderClass: 'border-l-4 border-l-emerald-500',
          borderColor: '#10b981',
        };
      case 'AZUL':
        return {
          bg: 'bg-blue-50 text-blue-800 border-blue-200',
          dot: 'bg-blue-500',
          label: 'TERMINÓ',
          borderClass: 'border-l-4 border-l-blue-600',
          borderColor: '#2563eb',
        };
      case 'NEGRO': {
        const isNA =
          student.tutorialResolution === 'N.A' ||
          student.tutorialResolution === 'Reprobó';
        const isSegundoIntento =
          student.tutorialResolution === 'Segundo intento otorgado';

        if (isNA) {
          return {
            bg: 'bg-purple-700 text-white border-purple-800 shadow-sm',
            dot: 'bg-purple-200',
            label: 'REV. CALIF. · N.A',
            borderClass: 'border-l-4 border-l-purple-600',
            borderColor: '#9333ea',
          };
        }

        if (isSegundoIntento) {
          return {
            bg: 'bg-slate-900 text-white border-slate-950',
            dot: 'bg-white',
            label: 'REV. CALIF. · 2.º INTENTO',
            borderClass: 'border-l-4 border-l-slate-900',
            borderColor: '#0f172a',
          };
        }

        return {
          bg: 'bg-slate-900 text-white border-slate-950',
          dot: 'bg-white',
          label: 'REV. CALIF.',
          borderClass: 'border-l-4 border-l-slate-900',
          borderColor: '#0f172a',
        };
      }
      case 'INICIADO_PRIMER_CORTE':
      default:
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-300',
          dot: 'bg-slate-500',
          label: 'INICIADO',
          borderClass: 'border-l-4 border-l-slate-400',
          borderColor: '#94a3b8',
        };
    }
  };

  return (
    <div className="bg-white/85 backdrop-blur-md rounded-xl shadow-sm border border-white/80 overflow-hidden mb-6 flex flex-col">
      {/* Controls Header: Search & Filters */}
      <div className="px-4 py-3 bg-slate-50/70 backdrop-blur-xs border-b border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-buscar-alumno"
            type="text"
            placeholder="Búsqueda por usuario, nombre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white/90 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#002855] focus:border-[#002855] shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          {/* Unit Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Unidad:</span>
            <select
              id="select-filtro-unidad"
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="bg-white/90 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#002855] shadow-2xs cursor-pointer"
            >
              <option value="ALL">Todas las unidades</option>
              <option value="0">Sin iniciar (-)</option>
              {availableUnits.map((u) => (
                <option key={u} value={String(u)}>
                  Unidad {u}
                </option>
              ))}
            </select>
          </div>

          {/* Insignia Filter Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Insignia:</span>
            <select
              id="select-filtro-insignia"
              value={selectedInsigniaFilter}
              onChange={(e) => setSelectedInsigniaFilter(e.target.value as InsigniaType | 'ALL')}
              className="bg-white/90 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#002855] shadow-2xs cursor-pointer"
            >
              <option value="ALL">Todas las insignias</option>
              <option value="MUJER">♀ Mujeres</option>
              <option value="HOMBRE">♂ Hombres</option>
              <option value="REVISION">● Revisión</option>
            </select>
          </div>

          {/* Task Status Filter (Tutorizado) */}
          {isTutorizado && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Tareas:</span>
              <select
                id="select-filtro-tareas"
                value={selectedTaskFilter}
                onChange={(e) => setSelectedTaskFilter(e.target.value as 'ALL' | 'PENDING' | 'FAILED' | 'APPROVED')}
                className="bg-white/90 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#002855] shadow-2xs cursor-pointer"
              >
                <option value="ALL">Todas las tareas</option>
                <option value="PENDING">Con tareas pendientes</option>
                <option value="FAILED">Con tareas &lt; 80</option>
                <option value="APPROVED">Todas aprobadas</option>
              </select>
            </div>
          )}

          {/* State Filter Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Estado:</span>
            <select
              id="select-filtro-estado"
              value={selectedStateFilter}
              onChange={(e) => onSelectStateFilter(e.target.value as TutorialState | 'ALL')}
              className="bg-white/90 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#002855] shadow-2xs cursor-pointer"
            >
              <option value="ALL">Todos los estados</option>
              <option value="ROJO">🔴 SIN INICIO</option>
              <option value="AMARILLO">🟡 PAUSA</option>
              <option value="NARANJA">🟠 SIN AVANCE</option>
              <option value="VERDE">🟢 AVANZANDO</option>
              <option value="AZUL">🔵 TERMINÓ</option>
              <option value="NEGRO">⚫ REV. CALIF.</option>
            </select>
          </div>

          {/* Clear Filters Button */}
          {(selectedStateFilter !== 'ALL' || selectedUnit !== 'ALL' || selectedInsigniaFilter !== 'ALL' || selectedTaskFilter !== 'ALL' || searchQuery) && (
            <button
              id="btn-limpiar-filtros-tabla"
              onClick={() => {
                onSelectStateFilter('ALL');
                setSelectedUnit('ALL');
                setSelectedInsigniaFilter('ALL');
                setSelectedTaskFilter('ALL');
                setSearchQuery('');
              }}
              className="text-xs font-semibold text-[#002855] bg-white border border-slate-200 hover:bg-slate-100 px-2.5 py-1 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-[#002855] text-white uppercase tracking-wider text-[11px] font-bold sticky top-0 z-20 select-none shadow-xs" style={{ backgroundColor: '#002855', color: '#ffffff' }}>
            <tr className="bg-[#002855] text-white" style={{ backgroundColor: '#002855', color: '#ffffff' }}>
              {/* ALUMNO */}
              <th
                className="py-2.5 px-4 border-r border-slate-700/60 cursor-pointer hover:bg-[#003366] transition-colors group bg-[#002855] text-white sticky top-0 z-20"
                style={{ backgroundColor: '#002855', color: '#ffffff' }}
                onClick={() => handleSort('nombre')}
                title="Ordenar por alumno (A-Z / Z-A)"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-bold">Alumno</span>
                  {renderSortIcon('nombre')}
                </div>
              </th>

              {/* INSIGNIA */}
              <th
                className="py-2.5 px-3 border-r border-slate-700/60 text-center cursor-pointer hover:bg-[#003366] transition-colors group bg-[#002855] text-white sticky top-0 z-20"
                style={{ backgroundColor: '#002855', color: '#ffffff' }}
                onClick={() => handleSort('insignia')}
                title="Ordenar por insignia (Mujer, Hombre, Revisión)"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-white font-bold">INS</span>
                  {renderSortIcon('insignia')}
                </div>
              </th>

              {/* USUARIO */}
              <th
                className="py-2.5 px-3 border-r border-slate-700/60 cursor-pointer hover:bg-[#003366] transition-colors group bg-[#002855] text-white sticky top-0 z-20"
                style={{ backgroundColor: '#002855', color: '#ffffff' }}
                onClick={() => handleSort('usuario')}
                title="Ordenar por identificador de usuario numéricamente"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-bold">Usuario</span>
                  {renderSortIcon('usuario')}
                </div>
              </th>

              {/* EMAIL */}
              <th
                className="py-2.5 px-3 border-r border-slate-700/60 hidden lg:table-cell bg-[#002855] text-white sticky top-0 z-20"
                style={{ backgroundColor: '#002855', color: '#ffffff' }}
              >
                <span className="text-white font-bold">Email</span>
              </th>

              {/* U. PREVIA */}
              <th
                className="py-2.5 px-2 border-r border-slate-700/60 text-center cursor-pointer hover:bg-[#003366] transition-colors group bg-[#002855] text-white sticky top-0 z-20"
                style={{ backgroundColor: '#002855', color: '#ffffff' }}
                onClick={() => handleSort('previousCompletedUnit')}
                title="Ordenar por última unidad completada en el corte previo"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-white font-bold">U. Previa</span>
                  {renderSortIcon('previousCompletedUnit')}
                </div>
              </th>

              {/* U. TERMINADA */}
              <th
                className="py-2.5 px-2 border-r border-slate-700/60 text-center cursor-pointer hover:bg-[#003366] transition-colors group bg-[#002855] text-white sticky top-0 z-20"
                style={{ backgroundColor: '#002855', color: '#ffffff' }}
                onClick={() => handleSort('currentCompletedUnit')}
                title="Ordenar por última unidad completada en el corte actual"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-white font-bold">U. Terminada</span>
                  {renderSortIcon('currentCompletedUnit')}
                </div>
              </th>

              {/* CAMBIO DETECTADO */}
              <th
                className="py-2.5 px-3 border-r border-slate-700/60 cursor-pointer hover:bg-[#003366] transition-colors group bg-[#002855] text-white sticky top-0 z-20"
                style={{ backgroundColor: '#002855', color: '#ffffff' }}
                onClick={() => handleSort('changeDetected')}
                title="Ordenar por cambio detectado (A-Z / Z-A)"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-bold">Cambio detectado</span>
                  {renderSortIcon('changeDetected')}
                </div>
              </th>

              {/* ESTADO */}
              <th
                className="py-2.5 px-3 border-r border-slate-700/60 cursor-pointer hover:bg-[#003366] transition-colors group bg-[#002855] text-white sticky top-0 z-20"
                style={{ backgroundColor: '#002855', color: '#ffffff' }}
                onClick={() => handleSort('state')}
                title="Ordenar por categoría de estado académico"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-bold">Estado</span>
                  {renderSortIcon('state')}
                </div>
              </th>

              {/* ACCIÓN */}
              <th
                className="py-2.5 px-3 text-center bg-[#002855] text-white sticky top-0 z-20"
                style={{ backgroundColor: '#002855', color: '#ffffff' }}
              >
                <span className="text-white font-bold">Acción</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {sortedStudents.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-500">
                  No se encontraron alumnos con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              sortedStudents.map((s) => {
                const badge = getStateBadge(s);
                const isCopied = (s.usuario || s.email) === copiedId;
                const isNewlyCompleted = s.state === 'AZUL' && s.newlyCompleted;
                const isNew = s.isNewInState || isNewlyCompleted;
                const currentInsignia: InsigniaType = s.insignia || 'REVISION';
                const insigniaStyles = getInsigniaColorStyles(currentInsignia);

                const prevULabel = s.previousCompletedUnitKey
                  ? formatAcademicUnitIdentifier(s.previousCompletedUnitKey)
                  : s.previousCompletedUnit > 0
                  ? `U${s.previousCompletedUnit}`
                  : '-';
                const currULabel = s.currentCompletedUnitKey
                  ? formatAcademicUnitIdentifier(s.currentCompletedUnitKey)
                  : s.currentCompletedUnit > 0
                  ? `U${s.currentCompletedUnit}`
                  : '-';

                return (
                  <tr
                    key={s.usuario || s.email}
                    onClick={() => onSelectStudent(s)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group border-b border-slate-100"
                  >
                    {/* Alumno con línea vertical de color según estado académico */}
                    <td
                      className={`py-2.5 px-4 font-medium ${badge.borderClass}`}
                      style={{
                        borderLeftWidth: '4px',
                        borderLeftStyle: 'solid',
                        borderLeftColor: badge.borderColor,
                      }}
                    >
                      <div className="font-bold text-slate-900 group-hover:text-[#002855] flex items-center gap-1.5 flex-wrap">
                        <span>{s.nombreCompleto || s.nombre}</span>
                        {isNew && !s.isNewEnrollment && (
                          <span className="px-1.5 py-0.2 rounded bg-slate-900 text-[#00d1b2] text-[9px] font-bold">
                            NUEVO
                          </span>
                        )}
                      </div>
                      {s.isNewEnrollment && (
                        <div className="mt-0.5">
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-white shadow-2xs"
                            style={{ backgroundColor: '#7F1D1D' }}
                          >
                            <span>🚨</span>
                            <span>NUEVO INGRESO</span>
                          </span>
                        </div>
                      )}
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {[s.ciudad, s.departamento].filter(Boolean).join(', ')}
                      </div>
                      {/* Compact Task Tracking for TUTORIZADO */}
                      {s.courseType === 'TUTORIZADO' && s.tasksSummary && s.tasksSummary.totalTasks > 0 && (
                        <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                          <span className={s.tasksSummary.pendingTasks === 0 ? 'text-emerald-700 font-semibold' : 'text-slate-600'}>
                            Tareas: {s.tasksSummary.approvedTasks}/{s.tasksSummary.totalTasks} aprobadas
                          </span>
                          {s.tasksSummary.failedTasks > 0 && (
                            <span className="text-red-600 font-bold">({s.tasksSummary.failedTasks} &lt; 80)</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Insignia editable directamente en la tabla */}
                    <td
                      className="py-2 px-3 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center justify-center gap-1.5">
                        {currentInsignia === 'MUJER' && (
                          <FemaleSymbol size={19} className="text-red-600" />
                        )}
                        {currentInsignia === 'HOMBRE' && (
                          <MaleSymbol size={19} className="text-blue-600" />
                        )}
                        {currentInsignia === 'REVISION' && (
                          <RevisionSymbol size={11} className="text-amber-500" />
                        )}
                        <select
                          value={currentInsignia}
                          onChange={(e) => {
                            e.stopPropagation();
                            if (onUpdateInsignia) {
                              onUpdateInsignia(s.usuario, e.target.value as InsigniaType);
                            }
                          }}
                          aria-label={`Insignia de ${s.nombreCompleto || s.nombre}`}
                          className={`text-xs font-bold py-1 px-2 rounded-lg border shadow-2xs transition-colors cursor-pointer focus:outline-none focus:ring-1 ${insigniaStyles.selectBg}`}
                        >
                          <option value="MUJER">♀ MUJER</option>
                          <option value="HOMBRE">♂ HOMBRE</option>
                          <option value="REVISION">● REVISIÓN</option>
                        </select>
                      </div>
                    </td>

                    {/* Usuario */}
                    <td className="py-2.5 px-3 font-mono text-xs text-slate-700">
                      {s.usuario || '-'}
                    </td>

                    {/* Email */}
                    <td className="py-2.5 px-3 text-slate-600 hidden lg:table-cell truncate max-w-[180px]">
                      {s.email || '-'}
                    </td>

                    {/* Unidad Previa (Terminada) */}
                    <td className="py-2.5 px-2 text-center text-slate-500 font-medium font-mono">
                      {prevULabel}
                    </td>

                    {/* Unidad Terminada */}
                    <td className="py-2.5 px-2 text-center font-bold text-slate-900 font-mono">
                      {currULabel !== '-' ? (
                        <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[#002855] font-bold">
                          {currULabel}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* Cambio detectado */}
                    <td className="py-2.5 px-3 text-slate-700">
                      <span className="text-xs font-normal">{s.changeDetected || '-'}</span>
                    </td>

                    {/* Estado */}
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          isNewlyCompleted ? 'bg-blue-100 text-blue-900 border-blue-300' : badge.bg
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            isNewlyCompleted ? 'bg-blue-600' : badge.dot
                          }`}
                        />
                        <span>{badge.label}</span>
                        {isNewlyCompleted && (
                          <span className="text-[9px] font-bold text-blue-700">• NUEVO</span>
                        )}
                      </span>
                    </td>

                    {/* Intervención & Quick Actions */}
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={(e) => copyMessage(s, e)}
                          title="Copiar mensaje personalizado"
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                            isCopied
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
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
                          onClick={() => onSelectStudent(s)}
                          title="Ver detalle del alumno"
                          className="p-1 rounded-md hover:bg-slate-200/70 text-slate-500 transition-colors cursor-pointer"
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

      {/* Footer info */}
      <div className="p-3 bg-slate-50/80 border-t border-slate-200/80 text-xs text-slate-500 flex justify-between items-center shrink-0">
        <span>
          Mostrando <strong>{sortedStudents.length}</strong> de <strong>{students.length}</strong> alumnos
        </span>
        <span className="text-[11px] text-slate-400 italic">
          Haga clic en cualquier fila para ver el detalle académico completo
        </span>
      </div>
    </div>
  );
};
