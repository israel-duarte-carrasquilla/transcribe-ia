import React from 'react';
import { Sparkles, FileText, Download, History, PlayCircle, RefreshCw } from 'lucide-react';
import { MeetingData } from '../types/meeting';

interface HeaderProps {
  currentMeeting: MeetingData | null;
  onNewMeeting: () => void;
  onOpenExport: () => void;
  onLoadSample: () => void;
  savedMeetingsCount: number;
  onOpenHistory: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentMeeting,
  onNewMeeting,
  onOpenExport,
  onLoadSample,
  savedMeetingsCount,
  onOpenHistory,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={onNewMeeting}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center shadow-md shadow-blue-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                  TranscribeIA
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Español • IA
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Transcripción de Reuniones de 2h • Diarización • Resumen Ejecutivo
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {savedMeetingsCount > 0 && (
              <button
                onClick={onOpenHistory}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
                title="Historial de reuniones guardadas"
              >
                <History className="w-4 h-4 text-slate-400" />
                <span className="hidden md:inline">Historial</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-700 text-[10px] text-slate-200">
                  {savedMeetingsCount}
                </span>
              </button>
            )}

            {!currentMeeting && (
              <button
                onClick={onLoadSample}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 border border-indigo-700/50 transition-all hover:scale-[1.02]"
              >
                <PlayCircle className="w-4 h-4 text-indigo-400" />
                <span>Probar Demo (2 horas)</span>
              </button>
            )}

            {currentMeeting && (
              <>
                <button
                  onClick={onNewMeeting}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Nueva Reunión</span>
                </button>

                <button
                  onClick={onOpenExport}
                  className="flex items-center space-x-2 px-4 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02]"
                >
                  <Download className="w-4 h-4" />
                  <span>Exportar (PDF/Word/SRT/CSV)</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
