import React from 'react';
import { Info } from 'lucide-react';

interface SingleCutWarningProps {
  sheetName: string;
  formattedDate: string;
}

export const SingleCutWarning: React.FC<SingleCutWarningProps> = ({
  sheetName,
  formattedDate,
}) => {
  return (
    <div className="bg-sky-50/80 backdrop-blur-xs border border-sky-200/80 rounded-xl p-4 mb-6 flex items-start gap-3 text-xs text-sky-900 shadow-2xs">
      <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center shrink-0">
        <Info className="w-4 h-4 text-sky-700" />
      </div>
      <div>
        <h3 className="font-bold text-[#002855] text-sm mb-0.5">
          Primer corte registrado ({formattedDate} - {sheetName})
        </h3>
        <p className="text-sky-900 leading-relaxed font-medium">
          Aún no existe un corte posterior para calcular la evolución de los alumnos.
        </p>
        <p className="text-slate-600 text-[11px] mt-1 leading-normal">
          En este primer corte se identifican estados absolutos (no inició, terminó o evaluaciones que requieren revisión). Los estados de evolución (avanzó, pausa reciente, sin avance) se calcularán automáticamente cuando agregue un segundo corte al libro.
        </p>
      </div>
    </div>
  );
};
