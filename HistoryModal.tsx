import React from 'react';
import { DateDDMMYY, HistoricalCutStep } from '../types';
import { X, Calendar, ArrowRight, CheckCircle, Clock } from 'lucide-react';

interface HistoryModalProps {
  validSheets: DateDDMMYY[];
  history: HistoricalCutStep[];
  allCutSheetsData?: Record<string, import('../types').StudentAcademicRecord[]>;
  onClose: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  validSheets,
  history,
  allCutSheetsData,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/80 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#002855] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#00d1b2]">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white uppercase tracking-wide">
                HISTORIAL DE CORTES REGISTRADOS
              </h3>
              <p className="text-xs text-slate-300">
                {validSheets.length} cortes cronológicos identificados en el libro
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

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
          {/* Timeline of valid sheets */}
          <div className="p-3.5 bg-slate-50/80 backdrop-blur-xs rounded-xl border border-slate-200/80 shadow-2xs">
            <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-2">
              Línea de tiempo de cortes (Hojas DDMMYY)
            </h4>
            <div className="flex flex-wrap items-center gap-2">
              {validSheets.map((s, idx) => (
                <React.Fragment key={s.raw}>
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-200 shadow-2xs">
                    <Calendar className="w-3.5 h-3.5 text-[#002855]" />
                    <span className="font-bold text-slate-800">{s.formatted}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({s.raw})</span>
                  </div>
                  {idx < validSheets.length - 1 && (
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Historical comparisons */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
              Evolución comparativa paso a paso
            </h4>

            {history.length === 0 ? (
              <div className="p-4 text-center bg-slate-50/80 rounded-xl border border-slate-200/80 text-slate-500">
                Solo existe 1 corte registrado en este libro. Se requieren al menos 2 cortes para mostrar evoluciones históricas.
              </div>
            ) : (
              <div className="space-y-2.5">
                {history.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-slate-200/80 bg-white/90 shadow-2xs space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                        <span>Paso {idx + 1}:</span>
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[#002855]">
                          {step.fromDate} ({step.fromSheet})
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[#002855]">
                          {step.toDate} ({step.toSheet})
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Diferencia: <strong>{step.diffDays} {step.diffDays === 1 ? 'día' : 'días'}</strong>
                      </span>
                    </div>

                    {/* Step Metrics */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1 text-center">
                      <div className="p-1.5 rounded-lg bg-red-50/80 border border-red-100">
                        <span className="block text-[10px] font-bold text-red-600">🔴 SIN INICIO</span>
                        <span className="font-black text-sm text-red-700">{step.counts.rojo}</span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-amber-50/80 border border-amber-100">
                        <span className="block text-[10px] font-bold text-amber-600">🟡 PAUSA</span>
                        <span className="font-black text-sm text-amber-700">{step.counts.amarillo}</span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-orange-50/80 border border-orange-100">
                        <span className="block text-[10px] font-bold text-orange-600">🟠 SIN AVANCE</span>
                        <span className="font-black text-sm text-orange-700">{step.counts.naranja}</span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-emerald-50/80 border border-emerald-100">
                        <span className="block text-[10px] font-bold text-emerald-600">🟢 AVANZANDO</span>
                        <span className="font-black text-sm text-emerald-700">{step.counts.verde}</span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-blue-50/80 border border-blue-100">
                        <span className="block text-[10px] font-bold text-blue-600">🔵 TERMINÓ</span>
                        <span className="font-black text-sm text-blue-700">{step.counts.azul}</span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-slate-100 border border-slate-200">
                        <span className="block text-[10px] font-bold text-slate-800">⚫ REV. CALIF.</span>
                        <span className="font-black text-sm text-slate-900">{step.counts.negro}</span>
                      </div>
                    </div>

                    {/* Indicador administrativo de nuevos ingresos en este paso */}
                    {(() => {
                      const count = typeof step.newEnrollmentCount === 'number'
                        ? step.newEnrollmentCount
                        : (() => {
                            if (!allCutSheetsData) return 0;
                            const prevD = allCutSheetsData[step.fromSheet] || [];
                            const currD = allCutSheetsData[step.toSheet] || [];
                            const prevSet = new Set<string>();
                            prevD.forEach((r) => {
                              const u = (r.usuario || '').trim().toLowerCase();
                              if (u) prevSet.add(u);
                            });
                            let c = 0;
                            currD.forEach((r) => {
                              const u = (r.usuario || '').trim().toLowerCase();
                              if (u && !prevSet.has(u)) c++;
                            });
                            return c;
                          })();

                      if (count > 0) {
                        return (
                          <div className="flex items-center justify-between mt-2 px-3 py-2 rounded-lg border border-red-200 bg-red-50/80 text-red-950 text-xs">
                            <div className="flex items-center gap-1.5 font-bold">
                              <span>🚨</span>
                              <span className="tracking-wide">NUEVOS INGRESOS:</span>
                              <span className="px-2 py-0.5 rounded text-xs font-black bg-[#7F1D1D] text-white shadow-2xs">
                                {count}
                              </span>
                            </div>
                            <span className="text-[11px] text-red-700 font-medium">
                              {count === 1
                                ? '1 alumno incorporado desde el corte anterior'
                                : `${count} alumnos incorporados desde el corte anterior`}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div className="flex items-center justify-between mt-2 px-3 py-1.5 rounded-lg border border-slate-200/80 bg-slate-50 text-slate-500 text-xs">
                          <div className="flex items-center gap-1.5 font-medium">
                            <span className="text-slate-400">🚨</span>
                            <span>Nuevos ingresos:</span>
                            <span className="font-bold text-slate-700">0</span>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            Sin nuevas incorporaciones entre estos cortes
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50/80 border-t border-slate-200/80 flex justify-end">
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
