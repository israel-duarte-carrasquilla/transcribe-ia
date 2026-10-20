import React from 'react';
import { Target, CheckCircle, Lightbulb, Compass, Sparkles } from 'lucide-react';
import { ExecutiveSummary } from '../types/meeting';

interface ExecutiveSummaryViewProps {
  summary: ExecutiveSummary;
}

export const ExecutiveSummaryView: React.FC<ExecutiveSummaryViewProps> = ({ summary }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-xl">
      <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-slate-800">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center shadow-md">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-100">Resumen Ejecutivo de la Reunión</h2>
          <p className="text-xs text-slate-400">
            Síntesis estratégica automatizada con Gemini: objetivos, temas tratados y acuerdos
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Objetivo */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 sm:p-5">
          <div className="flex items-center space-x-2 text-blue-400 mb-2">
            <Target className="w-4 h-4" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Objetivo de la Sesión</h3>
          </div>
          <p className="text-sm text-slate-200 leading-relaxed font-normal">
            {summary.objective}
          </p>
        </div>

        {/* Grid: Puntos Clave & Decisiones */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Puntos Clave */}
          <div className="bg-slate-800/30 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center space-x-2 text-amber-400 mb-3">
              <Lightbulb className="w-4 h-4" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Puntos Clave Discutidos</h3>
            </div>
            <ul className="space-y-2.5">
              {summary.keyPoints.map((point, index) => (
                <li key={index} className="flex items-start space-x-2.5 text-xs sm:text-sm text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80 mt-2 shrink-0" />
                  <span className="leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Decisiones y Acuerdos */}
          <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-xl p-5">
            <div className="flex items-center space-x-2 text-emerald-400 mb-3">
              <CheckCircle className="w-4 h-4" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Decisiones y Acuerdos Firmes</h3>
            </div>
            <ul className="space-y-2.5">
              {summary.decisions.map((decision, index) => (
                <li key={index} className="flex items-start space-x-2.5 text-xs sm:text-sm text-emerald-200">
                  <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <span className="leading-relaxed font-medium">{decision}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Dinámica y Sentimiento */}
        {summary.sentiment && (
          <div className="flex items-center space-x-3 bg-slate-800/40 px-4 py-3 rounded-xl border border-slate-800 text-xs text-slate-400">
            <Compass className="w-4 h-4 text-indigo-400 shrink-0" />
            <div>
              <span className="font-semibold text-slate-300">Tono y Dinámica del Encuentro: </span>
              <span>{summary.sentiment}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
