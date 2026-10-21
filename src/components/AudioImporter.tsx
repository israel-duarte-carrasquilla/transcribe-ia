import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  Link2,
  Mic,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Youtube,
  Cloud,
  Play,
  Square,
  Volume2,
  HardDrive,
  Key,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { sliceAudioIntoChunks, formatSeconds } from '../utils/audioProcessor';
import { MeetingData, TranscriptSegment, Participant } from '../types/meeting';

interface AudioImporterProps {
  onTranscribeSuccess: (meeting: MeetingData) => void;
  onLoadSample: () => void;
}

const AVATAR_COLORS = [
  '#2563eb',
  '#059669',
  '#7c3aed',
  '#d97706',
  '#dc2626',
  '#0891b2',
  '#4f46e5',
  '#be185d',
];

export const AudioImporter: React.FC<AudioImporterProps> = ({
  onTranscribeSuccess,
  onLoadSample,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste' | 'mic'>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [pastedTranscript, setPastedTranscript] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [progressPercent, setProgressPercent] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Gemini API Key state for self-hosted deployments (Spaceship, etc.)
  const [apiKey, setApiKey] = useState<string>(
    () => localStorage.getItem('transcribeia_gemini_key') || ''
  );
  const [hasServerKey, setHasServerKey] = useState<boolean>(true);
  const [maskedServerKey, setMaskedServerKey] = useState<string | null>('AQ.Ab8RN...porg');
  const [showKeyConfig, setShowKeyConfig] = useState<boolean>(false);
  const [savingKey, setSavingKey] = useState<boolean>(false);

  // Microphone recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('transcribeia_gemini_key') || '';
    fetch('./api/check-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: saved }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.hasKey) {
          setHasServerKey(true);
          setMaskedServerKey(data.maskedKey);
        } else {
          setShowKeyConfig(true);
        }
      })
      .catch(() => {
        if (!saved) setShowKeyConfig(true);
      });

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const handleSaveApiKey = async () => {
    const clean = apiKey.trim();
    if (!clean.startsWith('AQ.') && !clean.startsWith('AIza')) {
      setErrorMessage('La clave de API de Gemini debe comenzar por "AQ." o "AIza". Créala gratis en aistudio.google.com/apikey');
      return;
    }
    setSavingKey(true);
    setErrorMessage('');
    try {
      const res = await fetch('./api/save-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: clean }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo validar la clave de API.');
      }
      localStorage.setItem('transcribeia_gemini_key', clean);
      setHasServerKey(true);
      setMaskedServerKey(data.maskedKey);
      setShowKeyConfig(false);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSavingKey(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      if (!meetingTitle) {
        setMeetingTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!meetingTitle) {
        setMeetingTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024) {
      return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const startRecording = async () => {
    try {
      setErrorMessage('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const recordedFile = new File(
          [audioBlob],
          `Grabacion_${new Date().toISOString().slice(0, 10)}.webm`,
          { type: 'audio/webm' }
        );
        setSelectedFile(recordedFile);
        if (!meetingTitle) {
          setMeetingTitle(`Sesión Grabada (${new Date().toLocaleDateString('es-ES')})`);
        }
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      setErrorMessage('No se pudo acceder al micrófono. Por favor revisa los permisos del navegador.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  // Transcripción literal bloque por bloque (sin límite de 30 minutos y sin textos inventados)
  const handleProcess = async () => {
    setLoading(true);
    setErrorMessage('');
    setProgressPercent(0);

    const activeKey = localStorage.getItem('transcribeia_gemini_key') || apiKey.trim();

    try {
      if (activeTab === 'upload' || (activeTab === 'mic' && selectedFile)) {
        if (!selectedFile) {
          setErrorMessage('Por favor selecciona o sube un archivo de audio o video.');
          setLoading(false);
          return;
        }

        // 1. Dividir el audio en bloques de 5 minutos (300s) a 8kHz mono (~4.8 MB por bloque)
        const { chunks, totalDuration } = await sliceAudioIntoChunks(
          selectedFile,
          300,
          (msg) => setStatusMessage(msg)
        );

        const allSegments: TranscriptSegment[] = [];
        const knownSpeakers = new Set<string>();
        const speakerIdMap = new Map<string, string>();

        // 2. Transcribir PALABRA POR PALABRA cada bloque de 5 minutos
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const pct = Math.round(((i) / chunks.length) * 85);
          setProgressPercent(pct);
          setStatusMessage(
            `Transcribiendo palabra por palabra bloque ${i + 1} de ${chunks.length} (${formatSeconds(
              chunk.startSeconds
            )} a ${formatSeconds(chunk.endSeconds)}) — ${allSegments.length} intervenciones transcritas...`
          );

          const chunkRes = await fetch('./api/transcribe-chunk', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(activeKey ? { 'X-Gemini-Key': activeKey } : {}),
            },
            body: JSON.stringify({
              apiKey: activeKey,
              audioBase64: chunk.base64,
              mimeType: chunk.mimeType,
              chunkIndex: chunk.index,
              totalChunks: chunk.totalChunks,
              startSeconds: chunk.startSeconds,
              endSeconds: chunk.endSeconds,
              previousSpeakers: Array.from(knownSpeakers),
            }),
          });

          const chunkData = await chunkRes.json().catch(() => ({}));
          if (!chunkRes.ok) {
            if (chunkRes.status === 401) {
              setShowKeyConfig(true);
            }
            throw new Error(
              chunkData.error || `Error en bloque ${i + 1}/${chunks.length} (HTTP ${chunkRes.status})`
            );
          }

          const rawSegments = Array.isArray(chunkData.segments) ? chunkData.segments : [];
          for (const seg of rawSegments) {
            const text = (seg.text || '').trim();
            if (!text) continue;

            const speakerName = (seg.speakerName || 'Orador 1').trim();
            knownSpeakers.add(speakerName);

            if (!speakerIdMap.has(speakerName)) {
              speakerIdMap.set(speakerName, `p${speakerIdMap.size + 1}`);
            }

            const absSeconds = Math.max(
              chunk.startSeconds,
              chunk.startSeconds + (Number(seg.relativeSeconds) || 0)
            );

            allSegments.push({
              id: `s${allSegments.length + 1}`,
              speakerId: speakerIdMap.get(speakerName)!,
              speakerName,
              timestamp: formatSeconds(absSeconds),
              seconds: absSeconds,
              text,
              topic: seg.topic || undefined,
            });
          }
        }

        if (allSegments.length === 0) {
          throw new Error(
            'No se detectó voz audible en la grabación o el audio está en silencio.'
          );
        }

        // 3. Generar Resumen Ejecutivo, Participantes Reales y Compromisos a partir de la transcripción real completa
        setProgressPercent(92);
        setStatusMessage(
          `Analizando las ${allSegments.length} intervenciones reales para extraer participantes, resumen y actuaciones...`
        );

        const fullTranscriptText = allSegments
          .map((s) => `[${s.timestamp}] ${s.speakerName}: ${s.text}`)
          .join('\n\n');

        const durationFormatted = formatSeconds(totalDuration);

        const summaryRes = await fetch('./api/summarize-transcript', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(activeKey ? { 'X-Gemini-Key': activeKey } : {}),
          },
          body: JSON.stringify({
            apiKey: activeKey,
            transcriptText: fullTranscriptText.slice(0, 120000),
            meetingTitle: meetingTitle.trim() || selectedFile.name.replace(/\.[^/.]+$/, ''),
            durationFormatted,
          }),
        });

        const summaryData = await summaryRes.json().catch(() => ({}));

        // Calcular porcentajes reales de palabras habladas por cada orador
        const wordCounts = new Map<string, number>();
        let totalWords = 0;
        allSegments.forEach((s) => {
          const w = s.text.split(/\s+/).length;
          totalWords += w;
          wordCounts.set(s.speakerName, (wordCounts.get(s.speakerName) || 0) + w);
        });

        const participants: Participant[] = Array.from(speakerIdMap.entries()).map(
          ([name, id], idx) => {
            const aiMatch = Array.isArray(summaryData.participants)
              ? summaryData.participants.find(
                  (p: any) =>
                    p.name?.toLowerCase() === name.toLowerCase() || p.id === id
                )
              : null;
            const words = wordCounts.get(name) || 0;
            const pct = totalWords > 0 ? Math.max(1, Math.round((words / totalWords) * 100)) : 25;

            return {
              id,
              name,
              role: aiMatch?.role || 'Interviniente',
              speakingPercentage: pct,
              avatarColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
            };
          }
        );

        const meetingResult: MeetingData = {
          id: 'meeting-' + Date.now(),
          title:
            summaryData.title ||
            meetingTitle.trim() ||
            selectedFile.name.replace(/\.[^/.]+$/, ''),
          date: new Date().toISOString().slice(0, 10),
          estimatedDuration: durationFormatted,
          language: 'Español',
          participants,
          executiveSummary: summaryData.executiveSummary || {
            objective: 'Transcripción literal completa de la grabación.',
            keyPoints: ['Transcripción íntegra realizada palabra por palabra.'],
            decisions: [],
            sentiment: 'Formal',
          },
          actionItems: Array.isArray(summaryData.actionItems) ? summaryData.actionItems : [],
          transcript: allSegments,
          sourceType: activeTab === 'mic' ? 'mic' : 'file',
          audioFileName: selectedFile.name,
          audioBlobUrl: URL.createObjectURL(selectedFile),
        };

        setProgressPercent(100);
        onTranscribeSuccess(meetingResult);
      } else if (activeTab === 'paste') {
        if (!pastedTranscript.trim()) {
          setErrorMessage('Por favor pega el texto de la transcripción que deseas estructurar y analizar.');
          setLoading(false);
          return;
        }

        setStatusMessage('Estructurando intervenciones y generando resumen judicial/ejecutivo con IA...');
        setProgressPercent(50);

        // Parsear bloques tipo [Orador X] (mm:ss - mm:ss) o líneas de diálogo
        const lines = pastedTranscript.split(/\r?\n/);
        const parsedSegments: TranscriptSegment[] = [];
        const speakerIdMap = new Map<string, string>();
        let currentSpeaker = 'Orador 1';
        let currentTimestamp = '00:00:00';
        let currentSeconds = 0;
        let currentBuffer: string[] = [];

        const flushSegment = () => {
          const text = currentBuffer.join(' ').trim();
          if (!text) return;
          if (!speakerIdMap.has(currentSpeaker)) {
            speakerIdMap.set(currentSpeaker, `p${speakerIdMap.size + 1}`);
          }
          parsedSegments.push({
            id: `s${parsedSegments.length + 1}`,
            speakerId: speakerIdMap.get(currentSpeaker)!,
            speakerName: currentSpeaker,
            timestamp: currentTimestamp,
            seconds: currentSeconds,
            text,
          });
          currentBuffer = [];
        };

        const headerRegex = /^\[([^\]]+)\]\s*\((\d+:\d+(?::\d+)?)/;
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.includes('Transcrito por TurboScribe')) continue;
          const match = trimmed.match(headerRegex);
          if (match) {
            flushSegment();
            currentSpeaker = match[1].trim();
            const rawTime = match[2].trim();
            const parts = rawTime.split(':').map(Number);
            currentSeconds =
              parts.length === 3
                ? parts[0] * 3600 + parts[1] * 60 + parts[2]
                : parts[0] * 60 + parts[1];
            currentTimestamp = formatSeconds(currentSeconds);
          } else {
            currentBuffer.push(trimmed);
          }
        }
        flushSegment();

        const summaryRes = await fetch('./api/summarize-transcript', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(activeKey ? { 'X-Gemini-Key': activeKey } : {}),
          },
          body: JSON.stringify({
            apiKey: activeKey,
            transcriptText: pastedTranscript.slice(0, 120000),
            meetingTitle: meetingTitle.trim() || 'Audiencia / Reunión Transcrita',
            durationFormatted: formatSeconds(currentSeconds || 1800),
          }),
        });

        const summaryData = await summaryRes.json().catch(() => ({}));
        if (!summaryRes.ok) {
          if (summaryRes.status === 401) setShowKeyConfig(true);
          throw new Error(summaryData.error || 'Error al analizar la transcripción.');
        }

        const participants: Participant[] = Array.from(speakerIdMap.entries()).map(
          ([name, id], idx) => ({
            id,
            name,
            role: 'Interviniente',
            speakingPercentage: Math.round(100 / Math.max(1, speakerIdMap.size)),
            avatarColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
          })
        );

        onTranscribeSuccess({
          id: 'meeting-' + Date.now(),
          title: summaryData.title || meetingTitle.trim() || 'Audiencia / Reunión Analizada',
          date: new Date().toISOString().slice(0, 10),
          estimatedDuration: formatSeconds(currentSeconds || 1800),
          language: 'Español',
          participants:
            Array.isArray(summaryData.participants) && summaryData.participants.length > 0
              ? summaryData.participants
              : participants,
          executiveSummary: summaryData.executiveSummary || {
            objective: 'Análisis de transcripción.',
            keyPoints: [],
            decisions: [],
          },
          actionItems: summaryData.actionItems || [],
          transcript: parsedSegments,
          sourceType: 'file',
        });
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Ocurrió un error al transcribir el audio.');
    } finally {
      setLoading(false);
      setStatusMessage('');
      setProgressPercent(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto my-8 px-4">
      {/* Hero Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Transcripción Literal Palabra por Palabra • Sin Límite de 30 Minutos (Hasta 2 Horas)</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
          Transcripción Forense, Judicial y Ejecutiva en Español
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
          Sube grabaciones de audiencias judiciales, comités o reuniones de hasta 2 horas.
          Transcribe palabra por palabra cada intervención identificando a los oradores, decisiones y compromisos sin recortes.
        </p>
      </div>

      {/* API Key Status / Configuration Bar */}
      <div className="mb-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5 text-xs">
            <Key className={`w-4 h-4 ${hasServerKey ? 'text-emerald-400' : 'text-amber-400'}`} />
            {hasServerKey ? (
              <span className="text-slate-300">
                Motor IA de Transcripción Literal activo ({maskedServerKey})
              </span>
            ) : (
              <span className="text-amber-300 font-medium">
                Configura tu clave gratuita de Google Gemini API para transcribir audio real palabra por palabra
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowKeyConfig(!showKeyConfig)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 transition"
          >
            {showKeyConfig ? 'Ocultar configuración' : hasServerKey ? 'Cambiar Clave IA' : 'Configurar Clave IA'}
          </button>
        </div>

        {showKeyConfig && (
          <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
            <p className="text-xs text-slate-400">
              Para transcribir grabaciones reales sin límites de tiempo en tu servidor, pega tu clave gratuita de{' '}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:underline inline-flex items-center space-x-1 font-semibold"
              >
                <span>Google AI Studio (aistudio.google.com/apikey)</span>
                <ExternalLink className="w-3 h-3 ml-0.5" />
              </a>
              :
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="flex-1 px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleSaveApiKey}
                disabled={savingKey}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition flex items-center justify-center space-x-1.5"
              >
                {savingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>Guardar y Activar Clave</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Importer Card */}
      <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl p-6 sm:p-8">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 mb-6 overflow-x-auto">
          <button
            onClick={() => {
              setActiveTab('upload');
              setErrorMessage('');
            }}
            className={`flex items-center space-x-2 py-3 px-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'upload'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Subir Audio o Video (Audiencias / Reuniones)</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('paste');
              setErrorMessage('');
            }}
            className={`flex items-center space-x-2 py-3 px-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'paste'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Pegar Transcripción para Analizar/Exportar</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('mic');
              setErrorMessage('');
            }}
            className={`flex items-center space-x-2 py-3 px-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'mic'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>Grabar en Vivo</span>
          </button>
        </div>

        {/* Meeting Title Input */}
        <div className="mb-6">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
            Título del Expediente, Audiencia o Reunión (Opcional)
          </label>
          <input
            type="text"
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            placeholder="Ej. 020GrabaciónAudiencia - Radicado 133 de 2026, Comité Directivo..."
            className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        {/* Tab 1: File Upload */}
        {activeTab === 'upload' && (
          <div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-blue-400 bg-blue-500/10'
                  : selectedFile
                  ? 'border-emerald-500/60 bg-emerald-500/5'
                  : 'border-slate-700 hover:border-slate-600 bg-slate-800/40 hover:bg-slate-800/70'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.ogg,.webm,.mp4,.mov,.mkv,.flac,.avi"
                className="hidden"
                onChange={handleFileSelect}
              />

              {selectedFile ? (
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <p className="font-semibold text-slate-200 text-base">{selectedFile.name}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Tamaño: <strong className="text-emerald-300">{formatFileSize(selectedFile.size)}</strong> • Se procesará en bloques de 5 min para transcripción literal completa
                  </p>
                  <span className="mt-3 text-xs text-blue-400 hover:underline">Haz clic para cambiar de archivo</span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <p className="font-medium text-slate-200 text-sm sm:text-base">
                    Arrastra aquí la grabación de la audiencia/reunión o{' '}
                    <span className="text-blue-400 font-semibold">examina tus archivos</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1.5 max-w-md">
                    Formatos compatibles: MP4, MP3, WAV, M4A, MKV, MOV, WebM, OGG.
                    <br />
                    <span className="text-emerald-400 font-medium">
                      Transcribe el 100% del audio palabra por palabra (sin el corte de 30 minutos de otras páginas).
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Paste Existing Transcript */}
        {activeTab === 'paste' && (
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Pega aquí la transcripción (de TurboScribe u otra fuente) para identificar partes, generar acta/resumen y exportar a Word/PDF/SRT/CSV:
            </label>
            <textarea
              rows={8}
              value={pastedTranscript}
              onChange={(e) => setPastedTranscript(e.target.value)}
              placeholder="[Orador 1] (0:13 - 0:18) Gracias, Valentina. Hola, buenos días..."
              className="w-full p-3.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Tab 3: Live Microphone Recording */}
        {activeTab === 'mic' && (
          <div className="p-6 text-center border border-slate-800 bg-slate-800/30 rounded-2xl">
            {!isRecording && !selectedFile && (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center mb-4">
                  <Mic className="w-8 h-8" />
                </div>
                <h3 className="text-base font-semibold text-slate-200">Graba tu audiencia o reunión en vivo</h3>
                <button
                  type="button"
                  onClick={startRecording}
                  className="mt-5 inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-sm shadow-lg shadow-red-600/30 transition-all hover:scale-105"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Comenzar a Grabar</span>
                </button>
              </div>
            )}

            {isRecording && (
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-red-600 text-white flex items-center justify-center mb-4 shadow-lg shadow-red-600/40">
                  <Volume2 className="w-10 h-10 animate-pulse" />
                </div>
                <span className="text-2xl font-mono font-bold text-red-400 tracking-wider">
                  {formatSeconds(recordingSeconds)}
                </span>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="mt-5 inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium text-sm transition"
                >
                  <Square className="w-4 h-4 fill-white" />
                  <span>Detener y Guardar Grabación</span>
                </button>
              </div>
            )}

            {!isRecording && selectedFile && (
              <div className="flex flex-col items-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-2" />
                <p className="font-semibold text-slate-200 text-sm">Grabación lista ({formatSeconds(recordingSeconds)})</p>
              </div>
            )}
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs sm:text-sm flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
            <div>
              <p className="font-semibold text-red-200">Atención</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Loading Progress State */}
        {loading && (
          <div className="mt-6 p-5 rounded-xl bg-blue-950/40 border border-blue-800/60 text-center">
            <div className="flex items-center justify-center space-x-3 mb-2">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
              <span className="text-sm font-semibold text-blue-200">
                Transcribiendo Audio Literalmente con Inteligencia Artificial
              </span>
            </div>

            <p className="text-xs text-blue-300 max-w-lg mx-auto font-medium">
              {statusMessage || 'Procesando bloques de audio...'}
            </p>

            {progressPercent !== null && (
              <div className="w-full bg-slate-800 rounded-full h-2.5 mt-3 overflow-hidden border border-slate-700">
                <div
                  className="bg-gradient-to-r from-blue-500 to-emerald-400 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Actions Button */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onLoadSample}
            disabled={loading}
            className="w-full sm:w-auto text-xs font-medium text-slate-400 hover:text-slate-200 flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg hover:bg-slate-800 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Ver ejemplo de demostración</span>
          </button>

          <button
            type="button"
            onClick={handleProcess}
            disabled={
              loading ||
              (activeTab === 'upload' && !selectedFile) ||
              (activeTab === 'paste' && !pastedTranscript.trim())
            }
            className={`w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all shadow-lg ${
              loading ||
              (activeTab === 'upload' && !selectedFile) ||
              (activeTab === 'paste' && !pastedTranscript.trim())
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-blue-500/25 hover:scale-[1.02]'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Transcribiendo...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Transcribir Palabra por Palabra</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
