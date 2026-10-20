import React, { useState } from 'react';
import {
  MessageSquare,
  Search,
  Play,
  Edit3,
  Check,
  Copy,
  Tag,
  Share2,
} from 'lucide-react';
import { TranscriptSegment, Participant } from '../types/meeting';

interface TranscriptViewProps {
  transcript: TranscriptSegment[];
  participants: Participant[];
  currentAudioSeconds: number;
  onSeekAudio: (seconds: number) => void;
  onUpdateSegmentText: (segmentId: string, newText: string) => void;
  selectedParticipantId: string | null;
}

export const TranscriptView: React.FC<TranscriptViewProps> = ({
  transcript,
  participants,
  currentAudioSeconds,
  onSeekAudio,
  onUpdateSegmentText,
  selectedParticipantId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getParticipant = (speakerId: string, speakerName: string) => {
    return (
      participants.find((p) => p.id === speakerId || p.name === speakerName) || {
        name: speakerName,
        role: 'Participante',
        avatarColor: '#3b82f6',
      }
    );
  };

  const handleStartEdit = (seg: TranscriptSegment) => {
    setEditingSegmentId(seg.id);
    setEditText(seg.text);
  };

  const handleSaveEdit = (segmentId: string) => {
    if (editText.trim()) {
      onUpdateSegmentText(segmentId, editText.trim());
    }
    setEditingSegmentId(null);
  };

  const handleCopyText = (seg: TranscriptSegment) => {
    navigator.clipboard.writeText(`[${seg.timestamp}] ${seg.speakerName}: ${seg.text}`);
    setCopiedId(seg.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredTranscript = transcript.filter((seg) => {
    if (selectedParticipantId && seg.speakerId !== selectedParticipantId) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const inText = seg.text.toLowerCase().includes(q);
      const inSpeaker = seg.speakerName.toLowerCase().includes(q);
      const inTopic = seg.topic?.toLowerCase().includes(q);
      return inText || inSpeaker || inTopic;
    }
    return true;
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      {/* Header and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white flex items-center justify-center shadow-md">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-slate-100">Transcripción Completa Diarizada</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                {transcript.length} intervenciones
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Haz clic en cualquier marca de tiempo para saltar al momento exacto en el audio
            </p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar en la transcripción..."
            className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Transcript Segments List */}
      <div className="space-y-4">
        {filteredTranscript.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No se encontraron intervenciones con la búsqueda "{searchQuery}".
          </div>
        ) : (
          filteredTranscript.map((seg, index) => {
            const participant = getParticipant(seg.speakerId, seg.speakerName);
            const isEditing = editingSegmentId === seg.id;
            const isCurrentActive =
              currentAudioSeconds >= seg.seconds &&
              (index === filteredTranscript.length - 1 ||
                currentAudioSeconds < (filteredTranscript[index + 1]?.seconds || seg.seconds + 60));

            return (
              <div
                key={seg.id}
                className={`p-4 rounded-xl border transition-all ${
                  isCurrentActive
                    ? 'border-blue-500/80 bg-blue-500/10 shadow-lg shadow-blue-500/10'
                    : 'border-slate-800/80 bg-slate-800/30 hover:border-slate-700 hover:bg-slate-800/60'
                }`}
              >
                {/* Meta Row: Speaker + Timestamp + Topic */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center space-x-2.5">
                    {/* Avatar circle */}
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-sm"
                      style={{ backgroundColor: participant.avatarColor || '#3b82f6' }}
                    >
                      {seg.speakerName.charAt(0).toUpperCase()}
                    </div>

                    <span className="text-sm font-bold text-slate-100">
                      {seg.speakerName}
                    </span>

                    <span className="text-[11px] text-slate-400 hidden sm:inline">
                      • {participant.role}
                    </span>

                    {/* Timestamp Jump Button */}
                    <button
                      type="button"
                      onClick={() => onSeekAudio(seg.seconds)}
                      className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-800 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 font-mono text-[11px] border border-slate-700 transition"
                      title="Reproducir desde este momento"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>{seg.timestamp}</span>
                    </button>
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* Topic Badge */}
                    {seg.topic && (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                        <Tag className="w-2.5 h-2.5 text-slate-500" />
                        <span>{seg.topic}</span>
                      </span>
                    )}

                    {/* Copy Button */}
                    <button
                      type="button"
                      onClick={() => handleCopyText(seg)}
                      className="p-1 text-slate-400 hover:text-slate-200 transition"
                      title="Copiar texto de esta intervención"
                    >
                      {copiedId === seg.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Edit Button */}
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => handleStartEdit(seg)}
                        className="p-1 text-slate-400 hover:text-slate-200 transition"
                        title="Corregir texto"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Body Text */}
                {isEditing ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                      className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => setEditingSegmentId(null)}
                        className="px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(seg.id)}
                        className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-1"
                      >
                        <Check className="w-3 h-3" />
                        <span>Guardar</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-300 leading-relaxed pl-9 font-normal">
                    {seg.text}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
