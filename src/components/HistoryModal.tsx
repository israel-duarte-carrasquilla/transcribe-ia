import React from 'react';
import { X, History, Trash2, Calendar, Clock, Users, ArrowRight } from 'lucide-react';
import { MeetingData } from '../types/meeting';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetings: MeetingData[];
  onSelectMeeting: (m: MeetingData) => void;
  onDeleteMeeting: (id: string) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  meetings,
  onSelectMeeting,
  onDeleteMeeting,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl text-slate-100 relative max-h-[85vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-slate-800 text-blue-400 flex items-center justify-center border border-slate-700">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Historial de Reuniones Guardadas</h3>
            <p className="text-xs text-slate-400">Reuniones transcritas almacenadas en tu navegador</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 my-2 pr-2">
          {meetings.length === 0 ? (
            <p className="text-center py-8 text-xs text-slate-500">
              No tienes reuniones en el historial todavía.
            </p>
          ) : (
            meetings.map((m) => (
              <div
                key={m.id}
                className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 transition flex items-center justify-between group"
              >
                <div
                  className="flex-1 min-w-0 cursor-pointer mr-3"
                  onClick={() => {
                    onSelectMeeting(m);
                    onClose();
                  }}
                >
                  <h4 className="text-sm font-semibold text-slate-100 truncate group-hover:text-blue-300">
                    {m.title}
                  </h4>
                  <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      <span>{m.date}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{m.estimatedDuration}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Users className="w-3 h-3 text-slate-500" />
                      <span>{m.participants.length}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => {
                      onSelectMeeting(m);
                      onClose();
                    }}
                    className="p-2 rounded-xl bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white transition"
                    title="Cargar esta reunión"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteMeeting(m.id);
                    }}
                    className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                    title="Eliminar de historial"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
