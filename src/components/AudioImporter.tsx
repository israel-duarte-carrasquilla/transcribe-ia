import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  Mic,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Play,
  Square,
  Volume2,
  Key,
  FileText,
  Trash2,
  Plus,
  Layers,
  GitMerge,
  Download,
  Eye,
  FileSpreadsheet,
  FileCode,
  File as FileIcon,
} from 'lucide-react';
import { sliceAudioIntoChunks, formatSeconds } from '../utils/audioProcessor';
import {
  transcribeAudioChunkDirect,
  summarizeTranscriptDirect,
  callGeminiDirect,
} from '../utils/geminiClient';
import {
  exportToPDF,
  exportToWord,
  exportToSRT,
  exportToTXT,
  exportToCSV,
} from '../utils/exporter';
import { MeetingData, TranscriptSegment, Participant } from '../types/meeting';

interface AudioImporterProps {
  onTranscribeSuccess: (meeting: MeetingData) => void;
  onSaveBatchItem?: (meeting: MeetingData) => void;
  onLoadSample: () => void;
}

interface BatchItemStatus {
  file: File;
  status: 'pending' | 'processing' | 'done' | 'error';
  progressText: string;
  progressPercent: number;
  result?: MeetingData;
  error?: string;
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
  onSaveBatchItem,
  onLoadSample,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste' | 'mic'>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [batchMode, setBatchMode] = useState<'separate' | 'merge'>('separate');
  const [batchItems, setBatchItems] = useState<BatchItemStatus[]>([]);
  const [completedResults, setCompletedResults] = useState<MeetingData[]>([]);

  const [meetingTitle, setMeetingTitle] = useState('');
  const [pastedTranscript, setPastedTranscript] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [progressPercent, setProgressPercent] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Gemini API Key state (pre-configured with user's Free Tier key)
  const [apiKey, setApiKey] = useState<string>(
    () => localStorage.getItem('transcribeia_gemini_key') || ''
  );
  const [maskedServerKey, setMaskedServerKey] = useState<string>('AQ.Ab8RN...porg');
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
    const saved = localStorage.getItem('transcribeia_gemini_key');
    if (saved && saved.length > 15) {
      setMaskedServerKey(`${saved.slice(0, 8)}...${saved.slice(-4)}`);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const handleSaveApiKey = async () => {
    const clean = apiKey.trim();
    if (!clean.startsWith('AQ.') && !clean.startsWith('AIza')) {
      setErrorMessage('La clave de API de Gemini debe comenzar por "AQ." o "AIza".');
      return;
    }
    setSavingKey(true);
    setErrorMessage('');
    try {
      await callGeminiDirect(
        { contents: [{ parts: [{ text: 'Responde OK' }] }] },
        clean,
        ['gemini-3.1-flash-lite', 'gemini-3.8-flash']
      );
      localStorage.setItem('transcribeia_gemini_key', clean);
      setMaskedServerKey(`${clean.slice(0, 8)}...${clean.slice(-4)}`);
      setShowKeyConfig(false);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSavingKey(false);
    }
  };

  const addFilesToQueue = (newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    if (arr.length === 0) return;

    setSelectedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => `${f.name}_${f.size}`));
      const uniqueNew = arr.filter((f) => !existingNames.has(`${f.name}_${f.size}`));
      const combined = [...prev, ...uniqueNew];
      if (!meetingTitle && combined.length === 1) {
        setMeetingTitle(combined[0].name.replace(/\.[^/.]+$/, ''));
      }
      return combined;
    });
    setCompletedResults([]);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(e.target.files);
      e.target.value = '';
    }
  };

  const removeFileAt = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
    setBatchItems([]);
    setCompletedResults([]);
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
        setSelectedFiles([recordedFile]);
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

  /**
   * Procesa un único archivo de principio a fin devolviendo su MeetingData
   */
  const processSingleFileToMeeting = async (
    file: File,
    customTitle: string,
    customKey: string | undefined,
    onUpdateProgress: (msg: string, pct: number) => void
  ): Promise<MeetingData> => {
    const { chunks, totalDuration } = await sliceAudioIntoChunks(file, 300, (msg) =>
      onUpdateProgress(msg, 5)
    );

    const allSegments: TranscriptSegment[] = [];
    const knownSpeakers = new Set<string>();
    const speakerIdMap = new Map<string, string>();

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const pct = Math.max(8, Math.round(((i + 0.2) / chunks.length) * 85));
      onUpdateProgress(
        `Transcribiendo bloque ${i + 1}/${chunks.length} (${formatSeconds(
          chunk.startSeconds
        )} - ${formatSeconds(chunk.endSeconds)}) — ${allSegments.length} intervenciones...`,
        pct
      );

      const chunkData = await transcribeAudioChunkDirect({
        audioBase64: chunk.base64,
        mimeType: chunk.mimeType,
        chunkIndex: chunk.index,
        totalChunks: chunk.totalChunks,
        startSeconds: chunk.startSeconds,
        endSeconds: chunk.endSeconds,
        previousSpeakers: Array.from(knownSpeakers),
        apiKey: customKey,
      });

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
      throw new Error('No se detectó voz audible en el archivo.');
    }

    onUpdateProgress(
      `Generando resumen ejecutivo, participantes y compromisos (${allSegments.length} intervenciones)...`,
      92
    );

    const fullTranscriptText = allSegments
      .map((s) => `[${s.timestamp}] ${s.speakerName}: ${s.text}`)
      .join('\n\n');

    const durationFormatted = formatSeconds(totalDuration);

    let summaryData: any = {};
    try {
      summaryData = await summarizeTranscriptDirect({
        transcriptText: fullTranscriptText.slice(0, 120000),
        meetingTitle: customTitle,
        durationFormatted,
        apiKey: customKey,
      });
    } catch (sumErr) {
      console.warn('Resumen opcional con advertencia:', sumErr);
    }

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
              (p: any) => p.name?.toLowerCase() === name.toLowerCase() || p.id === id
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

    onUpdateProgress('¡Completado!', 100);

    return {
      id: 'meeting-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      title: summaryData.title || customTitle,
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
      audioFileName: file.name,
      audioBlobUrl: URL.createObjectURL(file),
    };
  };

  // Procesar uno o múltiples archivos (por separado o fusionados)
  const handleProcess = async () => {
    setLoading(true);
    setErrorMessage('');
    setProgressPercent(2);

    const customKey = localStorage.getItem('transcribeia_gemini_key') || apiKey.trim() || undefined;

    try {
      if (activeTab === 'upload' || (activeTab === 'mic' && selectedFiles.length > 0)) {
        if (selectedFiles.length === 0) {
          setErrorMessage('Por favor selecciona uno o varios archivos de audio o video.');
          setLoading(false);
          return;
        }

        // CASO 1: Un solo archivo -> flujo directo que abre el resultado al terminar
        if (selectedFiles.length === 1) {
          const singleFile = selectedFiles[0];
          const baseTitle = meetingTitle.trim() || singleFile.name.replace(/\.[^/.]+$/, '');
          const meetingResult = await processSingleFileToMeeting(
            singleFile,
            baseTitle,
            customKey,
            (msg, pct) => {
              setStatusMessage(msg);
              setProgressPercent(pct);
            }
          );
          onTranscribeSuccess(meetingResult);
          return;
        }

        // CASO 2: Múltiples archivos en modo FUSIÓN (Parte 1 + Parte 2 + Parte 3 -> 1 sola Acta)
        if (batchMode === 'merge') {
          const allSegments: TranscriptSegment[] = [];
          const knownSpeakers = new Set<string>();
          const speakerIdMap = new Map<string, string>();
          let cumulativeDurationOffset = 0;

          for (let fIdx = 0; fIdx < selectedFiles.length; fIdx++) {
            const file = selectedFiles[fIdx];
            setStatusMessage(
              `Archivo ${fIdx + 1} de ${selectedFiles.length} (${file.name}): extrayendo audio...`
            );

            const { chunks, totalDuration } = await sliceAudioIntoChunks(file, 300, (msg) =>
              setStatusMessage(`Archivo ${fIdx + 1}/${selectedFiles.length}: ${msg}`)
            );

            for (let i = 0; i < chunks.length; i++) {
              const chunk = chunks[i];
              const overallPct = Math.round(
                (((fIdx + (i + 0.5) / chunks.length) / selectedFiles.length) * 85)
              );
              setProgressPercent(overallPct);
              setStatusMessage(
                `Archivo ${fIdx + 1}/${selectedFiles.length} (${file.name}) • Bloque ${i + 1}/${
                  chunks.length
                } — ${allSegments.length} intervenciones acumuladas...`
              );

              const chunkData = await transcribeAudioChunkDirect({
                audioBase64: chunk.base64,
                mimeType: chunk.mimeType,
                chunkIndex: chunk.index,
                totalChunks: chunk.totalChunks,
                startSeconds: chunk.startSeconds,
                endSeconds: chunk.endSeconds,
                previousSpeakers: Array.from(knownSpeakers),
                apiKey: customKey,
              });

              const rawSegments = Array.isArray(chunkData.segments) ? chunkData.segments : [];
              for (const seg of rawSegments) {
                const text = (seg.text || '').trim();
                if (!text) continue;

                const speakerName = (seg.speakerName || 'Orador 1').trim();
                knownSpeakers.add(speakerName);

                if (!speakerIdMap.has(speakerName)) {
                  speakerIdMap.set(speakerName, `p${speakerIdMap.size + 1}`);
                }

                const absSeconds = Math.floor(
                  cumulativeDurationOffset +
                    chunk.startSeconds +
                    (Number(seg.relativeSeconds) || 0)
                );

                allSegments.push({
                  id: `s${allSegments.length + 1}`,
                  speakerId: speakerIdMap.get(speakerName)!,
                  speakerName,
                  timestamp: formatSeconds(absSeconds),
                  seconds: absSeconds,
                  text,
                  topic: seg.topic ? `${file.name}: ${seg.topic}` : file.name,
                });
              }
            }

            cumulativeDurationOffset += totalDuration;
          }

          setProgressPercent(92);
          setStatusMessage('Consolidando resumen ejecutivo unificado de todos los archivos...');

          const fullTranscriptText = allSegments
            .map((s) => `[${s.timestamp}] ${s.speakerName}: ${s.text}`)
            .join('\n\n');
          const durationFormatted = formatSeconds(cumulativeDurationOffset);
          const mergedTitle =
            meetingTitle.trim() ||
            `Audiencia Consolidada (${selectedFiles.length} archivos)`;

          const summaryData = await summarizeTranscriptDirect({
            transcriptText: fullTranscriptText.slice(0, 120000),
            meetingTitle: mergedTitle,
            durationFormatted,
            apiKey: customKey,
          });

          const participants: Participant[] = Array.from(speakerIdMap.entries()).map(
            ([name, id], idx) => ({
              id,
              name,
              role: 'Interviniente',
              speakingPercentage: Math.round(100 / Math.max(1, speakerIdMap.size)),
              avatarColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
            })
          );

          const mergedMeeting: MeetingData = {
            id: 'meeting-merged-' + Date.now(),
            title: summaryData.title || mergedTitle,
            date: new Date().toISOString().slice(0, 10),
            estimatedDuration: durationFormatted,
            language: 'Español',
            participants:
              Array.isArray(summaryData.participants) && summaryData.participants.length > 0
                ? summaryData.participants
                : participants,
            executiveSummary: summaryData.executiveSummary || {
              objective: 'Transcripción consolidada de múltiples archivos.',
              keyPoints: [],
              decisions: [],
            },
            actionItems: Array.isArray(summaryData.actionItems) ? summaryData.actionItems : [],
            transcript: allSegments,
            sourceType: 'file',
            audioFileName: `${selectedFiles.length} archivos unidos`,
            audioBlobUrl: URL.createObjectURL(selectedFiles[0]),
          };

          onTranscribeSuccess(mergedMeeting);
          return;
        }

        // CASO 3: Múltiples archivos por SEPARADO (Cola de Lotes con descarga individual y masiva)
        const initialBatch: BatchItemStatus[] = selectedFiles.map((f) => ({
          file: f,
          status: 'pending',
          progressText: 'En cola de espera',
          progressPercent: 0,
        }));
        setBatchItems(initialBatch);
        const resultsList: MeetingData[] = [];

        for (let fIdx = 0; fIdx < selectedFiles.length; fIdx++) {
          const file = selectedFiles[fIdx];
          const itemTitle = file.name.replace(/\.[^/.]+$/, '');

          setBatchItems((prev) =>
            prev.map((item, idx) =>
              idx === fIdx
                ? { ...item, status: 'processing', progressText: 'Iniciando...', progressPercent: 5 }
                : item
            )
          );

          try {
            const result = await processSingleFileToMeeting(
              file,
              meetingTitle.trim() ? `${meetingTitle.trim()} - ${itemTitle}` : itemTitle,
              customKey,
              (msg, pct) => {
                setStatusMessage(`Archivo ${fIdx + 1} de ${selectedFiles.length} (${file.name}): ${msg}`);
                const globalPct = Math.round(((fIdx + pct / 100) / selectedFiles.length) * 100);
                setProgressPercent(globalPct);
                setBatchItems((prev) =>
                  prev.map((item, idx) =>
                    idx === fIdx ? { ...item, progressText: msg, progressPercent: pct } : item
                  )
                );
              }
            );

            resultsList.push(result);
            setCompletedResults([...resultsList]);
            onSaveBatchItem?.(result);

            setBatchItems((prev) =>
              prev.map((item, idx) =>
                idx === fIdx
                  ? {
                      ...item,
                      status: 'done',
                      progressText: `Completado (${result.transcript.length} intervenciones)`,
                      progressPercent: 100,
                      result,
                    }
                  : item
              )
            );
          } catch (fileErr: any) {
            setBatchItems((prev) =>
              prev.map((item, idx) =>
                idx === fIdx
                  ? {
                      ...item,
                      status: 'error',
                      progressText: fileErr.message || 'Error al procesar archivo',
                      error: fileErr.message,
                    }
                  : item
              )
            );
          }
        }
      } else if (activeTab === 'paste') {
        if (!pastedTranscript.trim()) {
          setErrorMessage('Por favor pega el texto de la transcripción que deseas estructurar y analizar.');
          setLoading(false);
          return;
        }

        setStatusMessage('Estructurando intervenciones y generando resumen judicial/ejecutivo con IA...');
        setProgressPercent(50);

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

        const summaryData = await summarizeTranscriptDirect({
          transcriptText: pastedTranscript.slice(0, 120000),
          meetingTitle: meetingTitle.trim() || 'Audiencia / Reunión Transcrita',
          durationFormatted: formatSeconds(currentSeconds || 1800),
          apiKey: customKey,
        });

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

  // Descarga masiva de todos los archivos completados del lote en el formato elegido
  const handleDownloadAllBatch = async (format: 'pdf' | 'docx' | 'srt' | 'txt' | 'csv') => {
    for (const meeting of completedResults) {
      if (format === 'pdf') await exportToPDF(meeting);
      else if (format === 'docx') await exportToWord(meeting);
      else if (format === 'srt') exportToSRT(meeting);
      else if (format === 'txt') exportToTXT(meeting);
      else if (format === 'csv') exportToCSV(meeting);
      await new Promise((r) => setTimeout(r, 350));
    }
  };

  return (
    <div className="max-w-4xl mx-auto my-8 px-4">
      {/* Hero Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Soporte para Múltiples Archivos por Lotes • Sin Límite de 30 Minutos (Hasta 2 Horas por Archivo)</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
          Transcripción Forense, Judicial y Ejecutiva en Español
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
          Carga uno o múltiples archivos de audiencias judiciales, comités o reuniones.
          El sistema los procesa automáticamente en cola y te permite descargar todos los resultados en Word, PDF, SRT, TXT o CSV.
        </p>
      </div>

      {/* API Key Status Bar */}
      <div className="mb-6 bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-3.5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5 text-xs">
            <Key className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-300 font-medium">
              Motor IA de Transcripción Literal Activo ({maskedServerKey})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowKeyConfig(!showKeyConfig)}
            className="text-xs font-medium px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            {showKeyConfig ? 'Ocultar' : 'Cambiar Clave IA (Opcional)'}
          </button>
        </div>

        {showKeyConfig && (
          <div className="mt-3 pt-3 border-t border-slate-800 flex flex-col sm:flex-row gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AQ.Ab8RN... o AIzaSy..."
              className="flex-1 px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleSaveApiKey}
              disabled={savingKey}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition flex items-center justify-center space-x-1.5"
            >
              {savingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>Guardar Clave</span>
            </button>
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
            <span>Subir Uno o Múltiples Archivos (Lotes)</span>
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
            Nombre del Expediente, Proceso o Reunión (Opcional)
          </label>
          <input
            type="text"
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            placeholder="Ej. Expediente Radicado 133 de 2026, Audiencia Juzgado de Familia..."
            className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        {/* Tab 1: Single & Multiple File Upload */}
        {activeTab === 'upload' && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-blue-400 bg-blue-500/10'
                  : selectedFiles.length > 0
                  ? 'border-emerald-500/60 bg-emerald-500/5'
                  : 'border-slate-700 hover:border-slate-600 bg-slate-800/40 hover:bg-slate-800/70'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.ogg,.webm,.mp4,.mov,.mkv,.flac,.avi"
                className="hidden"
                onChange={handleFileSelect}
              />

              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-2.5">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="font-medium text-slate-200 text-sm sm:text-base">
                  Arrastra aquí <strong>uno o varios archivos</strong> a la vez o{' '}
                  <span className="text-blue-400 font-semibold">haz clic para seleccionarlos</span>
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-md">
                  Puedes seleccionar múltiples grabaciones (MP4, MP3, WAV, M4A, MKV, MOV) manteniendo presionada la tecla <strong>Ctrl</strong> o <strong>Shift</strong>.
                </p>
              </div>
            </div>

            {/* Lista de archivos seleccionados en cola */}
            {selectedFiles.length > 0 && (
              <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Archivos en Cola ({selectedFiles.length})
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading}
                      className="inline-flex items-center space-x-1 text-xs font-medium text-blue-400 hover:text-blue-300 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar más archivos</span>
                    </button>
                    <button
                      type="button"
                      onClick={clearAllFiles}
                      disabled={loading}
                      className="text-xs text-slate-400 hover:text-rose-400 px-2 py-1"
                    >
                      Vaciar lista
                    </button>
                  </div>
                </div>

                {/* Selector de modo cuando hay 2 o más archivos */}
                {selectedFiles.length > 1 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <div
                      onClick={() => !loading && setBatchMode('separate')}
                      className={`p-3 rounded-xl border cursor-pointer transition flex items-start space-x-2.5 ${
                        batchMode === 'separate'
                          ? 'border-blue-500 bg-blue-500/10 text-slate-100'
                          : 'border-slate-700/80 bg-slate-900/50 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Layers className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold">Procesar por Separado (Lote)</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Genera un resultado y acta independiente por cada archivo para descargarlos todos al final.
                        </p>
                      </div>
                    </div>

                    <div
                      onClick={() => !loading && setBatchMode('merge')}
                      className={`p-3 rounded-xl border cursor-pointer transition flex items-start space-x-2.5 ${
                        batchMode === 'merge'
                          ? 'border-indigo-500 bg-indigo-500/10 text-slate-100'
                          : 'border-slate-700/80 bg-slate-900/50 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <GitMerge className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold">Unir en una Sola Audiencia Continua</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Une Parte 1, Parte 2, Parte 3... en una única transcripción continua y una sola acta.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Filas de archivos */}
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {selectedFiles.map((file, idx) => {
                    const bItem = batchItems[idx];
                    return (
                      <div
                        key={`${file.name}-${idx}`}
                        className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-semibold text-slate-200 truncate">
                                {file.name}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                {formatFileSize(file.size)}
                                {bItem ? ` • ${bItem.progressText}` : ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            {bItem?.status === 'done' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Completado
                              </span>
                            )}
                            {bItem?.status === 'processing' && (
                              <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                            )}
                            {!loading && (
                              <button
                                type="button"
                                onClick={() => removeFileAt(idx)}
                                className="p-1 text-slate-500 hover:text-rose-400 transition"
                                title="Quitar archivo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {bItem && bItem.status === 'processing' && (
                          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${bItem.progressPercent}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PANEL DE RESULTADOS DEL LOTE PARA DESCARGA INDIVIDUAL O MASIVA */}
            {completedResults.length > 0 && (
              <div className="mt-6 bg-emerald-950/20 border border-emerald-500/40 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-500/20">
                  <div className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-white">
                        ¡Archivos Procesados Listos para Descargar ({completedResults.length})!
                      </h3>
                      <p className="text-xs text-slate-300">
                        Descarga todos los resultados juntos en un clic o descarga/abre cada archivo individualmente:
                      </p>
                    </div>
                  </div>
                </div>

                {/* Botones de Descarga Masiva de Todo el Lote */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-emerald-300 mr-1">
                    Descargar TODOS ({completedResults.length}):
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDownloadAllBatch('docx')}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Todos en Word (.docx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadAllBatch('pdf')}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Todos en PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadAllBatch('srt')}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Todos en SRT</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadAllBatch('csv')}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Todos en CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadAllBatch('txt')}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-700 hover:bg-slate-600 text-white shadow transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Todos en TXT</span>
                  </button>
                </div>

                {/* Lista individual de resultados con acciones rápidas */}
                <div className="space-y-2.5 pt-2">
                  {completedResults.map((resItem, idx) => (
                    <div
                      key={resItem.id}
                      className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                          {idx + 1}. {resItem.title}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Archivo: {resItem.audioFileName} • Duración: {resItem.estimatedDuration} •{' '}
                          {resItem.transcript.length} intervenciones
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => exportToWord(resItem)}
                          className="px-2.5 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-xs font-semibold border border-blue-500/30"
                          title="Descargar Word (.docx)"
                        >
                          Word
                        </button>
                        <button
                          type="button"
                          onClick={() => exportToPDF(resItem)}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold border border-rose-500/30"
                          title="Descargar PDF"
                        >
                          PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => exportToSRT(resItem)}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold border border-amber-500/30"
                          title="Descargar SRT"
                        >
                          SRT
                        </button>
                        <button
                          type="button"
                          onClick={() => exportToCSV(resItem)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold border border-emerald-500/30"
                          title="Descargar CSV"
                        >
                          CSV
                        </button>
                        <button
                          type="button"
                          onClick={() => exportToTXT(resItem)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700"
                          title="Descargar TXT"
                        >
                          TXT
                        </button>
                        <button
                          type="button"
                          onClick={() => onTranscribeSuccess(resItem)}
                          className="inline-flex items-center space-x-1 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver Acta</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
            {!isRecording && selectedFiles.length === 0 && (
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

            {!isRecording && selectedFiles.length > 0 && (
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
                {selectedFiles.length > 1
                  ? `Procesando Lote de ${selectedFiles.length} Archivos con IA`
                  : 'Transcribiendo Audio Literalmente con Inteligencia Artificial'}
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
            <span>Ver ejemplo de demostración (Audiencia Rad. 133-2026)</span>
          </button>

          <button
            type="button"
            onClick={handleProcess}
            disabled={
              loading ||
              (activeTab === 'upload' && selectedFiles.length === 0) ||
              (activeTab === 'paste' && !pastedTranscript.trim())
            }
            className={`w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all shadow-lg ${
              loading ||
              (activeTab === 'upload' && selectedFiles.length === 0) ||
              (activeTab === 'paste' && !pastedTranscript.trim())
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-blue-500/25 hover:scale-[1.02]'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Procesando...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>
                  {selectedFiles.length > 1
                    ? batchMode === 'merge'
                      ? `Unir y Transcribir ${selectedFiles.length} Archivos`
                      : `Procesar Lote de ${selectedFiles.length} Archivos`
                    : 'Transcribir Palabra por Palabra'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
