import React from 'react';
import { ArrowRight } from 'lucide-react';

interface NewEnrollmentBannerProps {
  count: number;
  onOpenModal: () => void;
}

export const NewEnrollmentBanner: React.FC<NewEnrollmentBannerProps> = ({
  count,
  onOpenModal,
}) => {
  if (count <= 0) return null;

  return (
    <div
      role="alert"
      aria-label="Alerta de nuevos ingresos detectados"
      className="w-full mb-6 p-4 sm:p-5 rounded-2xl text-white shadow-md border border-red-900/60 relative overflow-hidden transition-all animate-alert-glow flex flex-col md:flex-row md:items-center justify-between gap-4"
      style={{ backgroundColor: '#7F1D1D' }}
    >
      {/* Contenido descriptivo y contador */}
      <div className="flex items-start sm:items-center gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center text-2xl shrink-0 shadow-inner">
          <span className="motion-safe:animate-pulse">🚨</span>
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black uppercase tracking-wider text-red-200">
              🚨 NUEVOS INGRESOS DETECTADOS
            </span>
          </div>
          <div className="text-base sm:text-lg font-bold leading-tight mt-0.5 text-white flex items-center gap-2 flex-wrap">
            <span className="text-xl sm:text-2xl font-black text-white px-2.5 py-0.5 rounded-lg bg-black/25 border border-white/20 shadow-xs">
              {count}
            </span>
            <span>
              {count === 1
                ? 'alumno incorporado desde el último corte'
                : 'alumnos incorporados desde el último corte'}
            </span>
          </div>
          <p className="text-xs sm:text-[13px] text-red-100/90 mt-1 font-medium">
            Atención tutorial prioritaria: identifique a los alumnos incorporados y valore su seguimiento.
          </p>
        </div>
      </div>

      {/* Botón de acción */}
      <div className="shrink-0 flex items-center self-end md:self-center">
        <button
          onClick={onOpenModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-white hover:bg-red-50 text-[#7F1D1D] shadow-sm hover:shadow transition-all cursor-pointer uppercase tracking-wider active:scale-98"
        >
          <span>VER NUEVOS INGRESOS</span>
          <ArrowRight className="w-4 h-4 text-[#7F1D1D]" />
        </button>
      </div>
    </div>
  );
};
