import React, { useState } from 'react';
import { Bot, Send, User, Sparkles, Loader2, HelpCircle } from 'lucide-react';
import { MeetingData } from '../types/meeting';

interface MeetingChatProps {
  meeting: MeetingData;
}

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

export const MeetingChat: React.FC<MeetingChatProps> = ({ meeting }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: `¡Hola! He analizado toda la reunión "${meeting.title}". Puedes preguntarme cualquier detalle sobre los participantes, acuerdos, plazos o debates específicos. ¿En qué puedo ayudarte?`,
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const suggestedQuestions = [
    '¿Cuáles son las tareas asignadas a Javier?',
    '¿Qué se acordó sobre el presupuesto de Q4?',
    '¿Cuáles fueron los principales riesgos discutidos?',
  ];

  const handleSend = async (questionText?: string) => {
    const q = (questionText || inputQuery).trim();
    if (!q || loading) return;

    setInputQuery('');
    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    setLoading(true);

    try {
      const transcriptText = meeting.transcript
        .map((s) => `[${s.timestamp}] ${s.speakerName}: ${s.text}`)
        .join('\n');

      const summaryContext = `Título: ${meeting.title}\nObjetivo: ${
        meeting.executiveSummary.objective
      }\nAcuerdos: ${meeting.executiveSummary.decisions.join('; ')}`;

      const res = await fetch('./api/ask-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          transcriptText,
          summaryContext,
        }),
      });

      if (!res.ok) {
        throw new Error('Error al consultar al asistente');
      }

      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'assistant', text: data.answer }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Disculpa, no pude procesar tu consulta en este momento. Por favor inténtalo de nuevo.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col h-[520px]">
      {/* Header */}
      <div className="flex items-center space-x-3 pb-4 border-b border-slate-800 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center">
          <Bot className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-100">Consultar a la Reunión</h3>
          <p className="text-xs text-slate-400">
            Pregunta dudas sobre acuerdos, citas textuales o detalles de los participantes
          </p>
        </div>
      </div>

      {/* Suggested chips */}
      <div className="py-2 flex flex-wrap gap-1.5 shrink-0">
        {suggestedQuestions.map((sq, i) => (
          <button
            key={i}
            onClick={() => handleSend(sq)}
            className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            {sq}
          </button>
        ))}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-3 p-2 my-2 pr-3">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex items-start space-x-2.5 ${
              m.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
              }`}
            >
              {m.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>

            <div
              className={`p-3 rounded-2xl text-xs sm:text-sm leading-relaxed max-w-[85%] ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-none'
                  : 'bg-slate-800/80 text-slate-200 border border-slate-700/60 rounded-tl-none'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center space-x-2 text-xs text-slate-400 p-2">
            <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
            <span>Consultando la transcripción de la reunión...</span>
          </div>
        )}
      </div>

      {/* Input row */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="pt-3 border-t border-slate-800 flex items-center space-x-2 shrink-0"
      >
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder="Escribe tu pregunta sobre la reunión..."
          className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          type="submit"
          disabled={!inputQuery.trim() || loading}
          className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white transition shadow-md"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
