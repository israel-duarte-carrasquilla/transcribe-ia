import React, { useState } from 'react';
import { Users, Edit2, Check, UserCheck, MessageSquare } from 'lucide-react';
import { Participant } from '../types/meeting';

interface ParticipantsViewProps {
  participants: Participant[];
  onUpdateParticipant: (id: string, newName: string, newRole: string) => void;
  selectedParticipantId: string | null;
  onSelectParticipant: (id: string | null) => void;
}

export const ParticipantsView: React.FC<ParticipantsViewProps> = ({
  participants,
  onUpdateParticipant,
  selectedParticipantId,
  onSelectParticipant,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');

  const handleStartEdit = (p: Participant) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditRole(p.role);
  };

  const handleSaveEdit = (id: string) => {
    if (editName.trim()) {
      onUpdateParticipant(id, editName.trim(), editRole.trim() || 'Participante');
    }
    setEditingId(null);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">
              Participantes Identificados ({participants.length})
            </h3>
            <p className="text-xs text-slate-400">
              Diarización automática de hablantes con porcentajes de intervención
            </p>
          </div>
        </div>

        {selectedParticipantId && (
          <button
            onClick={() => onSelectParticipant(null)}
            className="text-xs text-blue-400 hover:text-blue-300 underline font-medium"
          >
            Mostrar todos
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {participants.map((p) => {
          const isSelected = selectedParticipantId === p.id;
          const isEditing = editingId === p.id;

          return (
            <div
              key={p.id}
              onClick={() => !isEditing && onSelectParticipant(isSelected ? null : p.id)}
              className={`p-4 rounded-xl border transition-all cursor-pointer relative ${
                isSelected
                  ? 'border-blue-500 bg-blue-500/10 shadow-md shadow-blue-500/10'
                  : 'border-slate-800 bg-slate-800/40 hover:border-slate-700 hover:bg-slate-800/70'
              }`}
            >
              {/* Header with avatar */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm shadow-sm"
                    style={{ backgroundColor: p.avatarColor || '#3b82f6' }}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    {isEditing ? (
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="px-2 py-0.5 text-xs bg-slate-700 border border-slate-600 rounded text-white w-full"
                          placeholder="Nombre"
                        />
                        <input
                          type="text"
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          className="px-2 py-0.5 text-[11px] bg-slate-700 border border-slate-600 rounded text-slate-300 w-full"
                          placeholder="Cargo / Rol"
                        />
                      </div>
                    ) : (
                      <>
                        <h4 className="text-sm font-semibold text-slate-100 truncate max-w-[130px]">
                          {p.name}
                        </h4>
                        <p className="text-xs text-slate-400 truncate max-w-[130px]">{p.role}</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Edit / Save Button */}
                <div>
                  {isEditing ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveEdit(p.id);
                      }}
                      className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500"
                      title="Guardar nombre"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(p);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700"
                      title="Editar nombre o rol"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Speaking time percentage */}
              <div className="mt-4">
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Tiempo de habla</span>
                  <span className="font-semibold text-slate-200">{p.speakingPercentage || 25}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: `${p.speakingPercentage || 25}%`,
                      backgroundColor: p.avatarColor || '#3b82f6',
                    }}
                  />
                </div>
              </div>

              {isSelected && (
                <div className="mt-2.5 pt-2 border-t border-blue-500/20 flex items-center justify-between text-[10px] text-blue-400">
                  <span>Filtrando transcripción</span>
                  <MessageSquare className="w-3 h-3" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
