import React from 'react';
import { CutComparisonResult, TutorialState } from '../types';
import { XCircle, PauseCircle, MinusCircle, Search } from 'lucide-react';

interface StateCardsProps {
  comparison: CutComparisonResult;
  selectedStateFilter: TutorialState | 'ALL';
  onSelectState: (state: TutorialState | 'ALL') => void;
}

// Custom Vector SVG for Persona Caminando (AVANZANDO)
const WalkingPersonIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="13.5" cy="4.5" r="2" />
    <path d="m15.5 8.5-3.5 4.5-3-2-3 4" />
    <path d="M12 13l2.5 8" />
    <path d="M9 17l-3 4" />
    <path d="M12 9l3.5 1.5 2.5-1.5" />
  </svg>
);

// Custom Vector SVG for Persona Festejando (TERMINÓ)
const CelebratingPersonIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="4.5" r="2" />
    <path d="M7 8l5 3 5-3" />
    <path d="M12 11v6" />
    <path d="M9 21l3-4 3 4" />
    <path d="M5.5 5l2.5 4" />
    <path d="M18.5 5l-2.5 4" />
  </svg>
);

interface CardConfig {
  state: TutorialState;
  title: string;
  count: number;
  percentage: number;
  icon: React.ReactNode;
  textColor: string;
  iconColor: string;
  iconBg: string;
  cardBorder: string;
  hoverBg: string;
  activeRing: string;
}

export const StateCards: React.FC<StateCardsProps> = ({
  comparison,
  selectedStateFilter,
  onSelectState,
}) => {
  const cards: CardConfig[] = [
    {
      state: 'ROJO',
      title: 'SIN INICIO',
      count: comparison.counts.rojo,
      percentage: comparison.percentages.rojo,
      icon: <XCircle className="w-5 h-5" />,
      textColor: 'text-red-700',
      iconColor: 'text-red-600',
      iconBg: 'bg-red-50',
      cardBorder: 'border-red-200/80',
      hoverBg: 'hover:bg-red-50/40',
      activeRing: 'ring-2 ring-red-500 bg-red-50/60 shadow-md',
    },
    {
      state: 'AMARILLO',
      title: 'PAUSA',
      count: comparison.counts.amarillo,
      percentage: comparison.percentages.amarillo,
      icon: <PauseCircle className="w-5 h-5" />,
      textColor: 'text-amber-700',
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
      cardBorder: 'border-amber-200/80',
      hoverBg: 'hover:bg-amber-50/40',
      activeRing: 'ring-2 ring-amber-500 bg-amber-50/60 shadow-md',
    },
    {
      state: 'NARANJA',
      title: 'SIN AVANCE',
      count: comparison.counts.naranja,
      percentage: comparison.percentages.naranja,
      icon: <MinusCircle className="w-5 h-5" />,
      textColor: 'text-orange-700',
      iconColor: 'text-orange-600',
      iconBg: 'bg-orange-50',
      cardBorder: 'border-orange-200/80',
      hoverBg: 'hover:bg-orange-50/40',
      activeRing: 'ring-2 ring-orange-500 bg-orange-50/60 shadow-md',
    },
    {
      state: 'VERDE',
      title: 'AVANZANDO',
      count: comparison.counts.verde,
      percentage: comparison.percentages.verde,
      icon: <WalkingPersonIcon className="w-5 h-5" />,
      textColor: 'text-emerald-700',
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
      cardBorder: 'border-emerald-200/80',
      hoverBg: 'hover:bg-emerald-50/40',
      activeRing: 'ring-2 ring-emerald-500 bg-emerald-50/60 shadow-md',
    },
    {
      state: 'AZUL',
      title: 'TERMINÓ',
      count: comparison.counts.azul,
      percentage: comparison.percentages.azul,
      icon: <CelebratingPersonIcon className="w-5 h-5" />,
      textColor: 'text-blue-700',
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50',
      cardBorder: 'border-blue-200/80',
      hoverBg: 'hover:bg-blue-50/40',
      activeRing: 'ring-2 ring-blue-500 bg-blue-50/60 shadow-md',
    },
    {
      state: 'NEGRO',
      title: 'REV. CALIF.',
      count: comparison.counts.negro,
      percentage: comparison.percentages.negro,
      icon: <Search className="w-5 h-5" />,
      textColor: 'text-slate-900',
      iconColor: 'text-slate-900',
      iconBg: 'bg-slate-100',
      cardBorder: 'border-slate-300',
      hoverBg: 'hover:bg-slate-100/60',
      activeRing: 'ring-2 ring-slate-900 bg-slate-100 shadow-md',
    },
  ];

  return (
    <div id="estado-general-alumnos" className="mb-6">
      <div className="flex items-center justify-between mb-3.5">
        <div>
          <h2 className="text-sm sm:text-base font-bold uppercase tracking-wider text-[#002855]">
            ESTADO GENERAL DE ALUMNOS
            <span className="text-slate-400 font-normal text-xs ml-2">
              ({comparison.totalStudents} {comparison.totalStudents === 1 ? 'alumno' : 'alumnos'})
            </span>
          </h2>
        </div>

        {selectedStateFilter !== 'ALL' && (
          <button
            id="btn-limpiar-filtro-estado"
            onClick={() => onSelectState('ALL')}
            className="text-xs font-semibold text-[#002855] hover:text-[#00d1b2] cursor-pointer bg-white/90 backdrop-blur-xs border border-slate-200/80 px-2.5 py-1 rounded-lg shadow-2xs transition-colors"
          >
            Limpiar filtro (Ver todos)
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {cards.map((card) => {
          const isSelected = selectedStateFilter === card.state;
          const isAzulWithNew = card.state === 'AZUL' && comparison.newlyCompletedCount > 0;

          return (
            <button
              key={card.state}
              id={`card-filter-${card.state.toLowerCase()}`}
              onClick={() => onSelectState(isSelected ? 'ALL' : card.state)}
              className={`bg-white/85 backdrop-blur-md rounded-xl p-4 border shadow-xs flex flex-col justify-between cursor-pointer transition-all duration-150 text-left min-h-[135px] ${
                card.cardBorder
              } ${isSelected ? card.activeRing : `${card.hoverBg} hover:shadow-md hover:-translate-y-0.5`}`}
            >
              <div>
                {/* 1. Icono con su color semántico */}
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-1.5 rounded-lg ${card.iconBg} ${card.iconColor} shadow-2xs`}>
                    {card.icon}
                  </div>

                  {isSelected && (
                    <span className="text-[9px] font-bold text-[#002855] bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs">
                      Activo
                    </span>
                  )}
                </div>

                {/* 2. Título (exacto) */}
                <span className={`text-xs font-bold tracking-wider uppercase ${card.textColor}`}>
                  {card.title}
                </span>
              </div>

              <div>
                {/* 3. Cantidad de alumnos (número protagonista) */}
                <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-none">
                  {card.count}
                </div>

                {/* 4. Porcentaje y texto opcional de nuevos terminados */}
                <div className="mt-1 flex flex-col">
                  <span className="text-xs font-semibold text-slate-500">
                    {card.percentage.toFixed(0)} %
                  </span>
                  {isAzulWithNew && (
                    <span className="text-[10px] font-bold text-blue-700 leading-tight mt-0.5">
                      +{comparison.newlyCompletedCount} desde el último corte
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
