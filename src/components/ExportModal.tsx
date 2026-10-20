import React, { useState } from 'react';
import {
  X,
  FileText,
  FileCode,
  FileSpreadsheet,
  File,
  Copy,
  Check,
  Download,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { MeetingData } from '../types/meeting';
import {
  exportToPDF,
  exportToWord,
  exportToSRT,
  exportToTXT,
  exportToCSV,
  exportTasksToCSV,
} from '../utils/exporter';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  meeting: MeetingData;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, meeting }) => {
  const [copied, setCopied] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = async (format: 'pdf' | 'docx' | 'srt' | 'txt' | 'csv' | 'tasks_csv') => {
    setDownloadingFormat(format);
    try {
      if (format === 'pdf') {
        await exportToPDF(meeting);
      } else if (format === 'docx') {
        await exportToWord(meeting);
      } else if (format === 'srt') {
        exportToSRT(meeting);
      } else if (format === 'txt') {
        exportToTXT(meeting);
      } else if (format === 'csv') {
        exportToCSV(meeting);
      } else if (format === 'tasks_csv') {
        exportTasksToCSV(meeting);
      }
    } catch (err) {
      console.error('Error al exportar:', err);
    } finally {
      setTimeout(() => setDownloadingFormat(null), 500);
    }
  };

  const handleCopyClipboard = () => {
    let md = `# ${meeting.title}\n`;
    md += `**Fecha:** ${meeting.date} | **Duración:** ${meeting.estimatedDuration} | **Idioma:** ${meeting.language}\n\n`;
    md += `## Participantes\n`;
    meeting.participants.forEach((p) => {
      md += `- **${p.name}** (${p.role}) - ${p.speakingPercentage || 0}%\n`;
    });
    md += `\n## Resumen Ejecutivo\n${meeting.executiveSummary.objective}\n\n`;
    md += `### Puntos Clave\n`;
    meeting.executiveSummary.keyPoints.forEach((p) => (md += `- ${p}\n`));
    md += `\n### Decisiones Acordadas\n`;
    meeting.executiveSummary.decisions.forEach((d) => (md += `- ${d}\n`));
    md += `\n## Tareas Pendientes\n`;
    meeting.actionItems.forEach((t) => {
      md += `- [ ] **${t.task}** (Responsable: ${t.assignee} | Prioridad: ${t.priority} | Plazo: ${t.deadline})\n`;
    });
    md += `\n## Transcripción\n`;
    meeting.transcript.forEach((s) => {
      md += `**[${s.timestamp}] ${s.speakerName}:** ${s.text}\n\n`;
    });

    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadAll = async () => {
    await handleExport('pdf');
    await handleExport('docx');
    handleExport('srt');
    handleExport('txt');
    handleExport('csv');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl text-slate-100 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Title */}
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Exportar Resultados de la Reunión</h3>
            <p className="text-xs text-slate-400">
              Formatos compatibles con herramientas de gestión, ofimática y edición de video
            </p>
          </div>
        </div>

        <div className="my-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* PDF */}
          <div
            onClick={() => handleExport('pdf')}
            className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/80 hover:border-rose-500/60 hover:bg-slate-800/80 transition cursor-pointer group flex items-start space-x-3"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h4 className="text-sm font-bold text-slate-100 group-hover:text-rose-300">
                  Documento PDF (.pdf)
                </h4>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300">
                  Formal
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Acta ejecutiva completa con membrete, tabla de compromisos y transcripción.
              </p>
            </div>
          </div>

          {/* Word DOCX */}
          <div
            onClick={() => handleExport('docx')}
            className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/80 hover:border-blue-500/60 hover:bg-slate-800/80 transition cursor-pointer group flex items-start space-x-3"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <File className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h4 className="text-sm font-bold text-slate-100 group-hover:text-blue-300">
                  Microsoft Word (.docx)
                </h4>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300">
                  Editable
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Documento Word con tablas, encabezados nativos y formato estructurado.
              </p>
            </div>
          </div>

          {/* Subtitles SRT */}
          <div
            onClick={() => handleExport('srt')}
            className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/80 hover:border-amber-500/60 hover:bg-slate-800/80 transition cursor-pointer group flex items-start space-x-3"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h4 className="text-sm font-bold text-slate-100 group-hover:text-amber-300">
                  Subtítulos SRT (.srt)
                </h4>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                  Video
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Marcas de tiempo exactas para YouTube, Premiere Pro, DaVinci y VLC.
              </p>
            </div>
          </div>

          {/* CSV Excel */}
          <div
            onClick={() => handleExport('csv')}
            className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/80 hover:border-emerald-500/60 hover:bg-slate-800/80 transition cursor-pointer group flex items-start space-x-3"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h4 className="text-sm font-bold text-slate-100 group-hover:text-emerald-300">
                  Transcripción CSV (.csv)
                </h4>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300">
                  Excel
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Columnas de hablante, segundos, roles y texto para análisis en hojas de cálculo.
              </p>
            </div>
          </div>

          {/* TXT */}
          <div
            onClick={() => handleExport('txt')}
            className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/80 hover:border-cyan-500/60 hover:bg-slate-800/80 transition cursor-pointer group flex items-start space-x-3"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h4 className="text-sm font-bold text-slate-100 group-hover:text-cyan-300">
                  Texto Plano (.txt)
                </h4>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300">
                  Rápido
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Formato limpio sin dependencias para adjuntar en correos o notas.
              </p>
            </div>
          </div>

          {/* Tasks Only CSV */}
          <div
            onClick={() => handleExport('tasks_csv')}
            className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/80 hover:border-purple-500/60 hover:bg-slate-800/80 transition cursor-pointer group flex items-start space-x-3"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h4 className="text-sm font-bold text-slate-100 group-hover:text-purple-300">
                  Solo Tareas en CSV (.csv)
                </h4>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300">
                  Gestión
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Importa directamente las tareas a Jira, Asana, Monday o Notion.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={handleCopyClipboard}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span>¡Copiado al Portapapeles!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-400" />
                <span>Copiar Todo como Markdown</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownloadAll}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 transition hover:scale-[1.02]"
          >
            <Download className="w-4 h-4" />
            <span>Descargar Todos los Formatos</span>
          </button>
        </div>
      </div>
    </div>
  );
};
