import React, { useState } from 'react';
import { CutComparisonResult, TutorialState } from '../types';
import { INTERVENTIONS } from '../utils/messages';
import { Copy, Check, Users } from 'lucide-react';

interface InterventionsSectionProps {
  comparison: CutComparisonResult;
  onFilterByState: (state: TutorialState) => void;
}

export const InterventionsSection: React.FC<InterventionsSectionProps> = ({
  comparison,
  onFilterByState,
}) => {
  const [copiedState, setCopiedState] = useState<string | null>(null);

  // States to display in order: Rojo, Amarillo, Naranja, Verde, Azul, Negro
  const stateOrder: TutorialState[] = ['ROJO', 'AMARILLO', 'NARANJA', 'VERDE', 'AZUL', 'NEGRO'];

  const getStudentCount = (state: TutorialState) => {
    switch (state) {
      case 'ROJO':
        return comparison.counts.rojo;
      case 'AMARILLO':
        return comparison.counts.amarillo;
      case 'NARANJA':
        return comparison.counts.naranja;
      case 'VERDE':
        return comparison.counts.verde;
      case 'AZUL':
        return comparison.counts.azul;
      case 'NEGRO':
        return comparison.counts.negro;
      default:
        return 0;
    }
  };

  const handleCopyBaseMessage = (state: TutorialState, message: string) => {
    navigator.clipboard.writeText(message);
    setCopiedState(state);
    setTimeout(() => setCopiedState(null), 2500);
  };

  // Only show blocks for states with active students
  const activeStates = stateOrder.filter((st) => getStudentCount(st) > 0);

  if (activeStates.length === 0) {
    return null;
  }

  return (
    <div id="intervenciones-sugeridas" className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-[#002855] uppercase tracking-wider">
            INTERVENCIONES SUGERIDAS
          </h2>
          <p className="text-xs text-slate-500">
            Pautas de comunicación tutorial personalizadas por estado de avance
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeStates.map((state) => {
          const info = INTERVENTIONS[state];
          const count = getStudentCount(state);
          const isCopied = copiedState === state;

          return (
            <div
              key={state}
              id={`block-intervencion-${state.toLowerCase()}`}
              className="bg-white/80 backdrop-blur-md rounded-xl border border-white/80 p-4 flex flex-col justify-between shadow-sm transition-all"
            >
              {/* Header */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${info.badgeBg} shadow-2xs`}
                  >
                    <span>{info.emoji}</span>
                    <span>{info.title}</span>
                  </span>

                  <span className="text-xs font-bold text-[#002855] bg-white/90 px-2.5 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                    {count} {count === 1 ? 'alumno' : 'alumnos'}
                  </span>
                </div>

                {/* Objetivo */}
                <div className="mb-2.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Objetivo:
                  </span>
                  <p className="text-xs text-slate-700 italic font-normal leading-snug">
                    {info.objective}
                  </p>
                </div>

                {/* Mensaje Base */}
                <div className="mb-3 bg-white/90 backdrop-blur-xs rounded-lg border border-slate-200/80 p-3 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Mensaje base:
                  </span>
                  <p className="text-xs text-slate-700 italic leading-relaxed whitespace-pre-line">
                    "{info.baseMessage}"
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                <button
                  id={`btn-ver-alumnos-${state.toLowerCase()}`}
                  onClick={() => {
                    onFilterByState(state);
                    const tableEl = document.querySelector('#input-buscar-alumno');
                    if (tableEl) {
                      tableEl.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#002855] hover:text-[#00d1b2] transition-colors cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  Ver alumnos
                </button>

                <button
                  id={`btn-copiar-mensaje-${state.toLowerCase()}`}
                  onClick={() => handleCopyBaseMessage(state, info.baseMessage)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition-all cursor-pointer ${
                    isCopied
                      ? 'bg-[#00d1b2] text-white shadow-sm'
                      : 'bg-[#002855] text-white hover:bg-[#001f42]'
                  }`}
                >
                  {isCopied ? (
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
          );
        })}
      </div>
    </div>
  );
};
