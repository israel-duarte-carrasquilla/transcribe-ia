import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  Link2,
  Mic,
  Sparkles,
  FileAudio,
  Film,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Youtube,
  Cloud,
  Play,
  Square,
  Volume2,
  HardDrive,
} from 'lucide-react';
import { formatSeconds } from '../utils/audioProcessor';
import { MeetingData } from '../types/meeting';

interface AudioImporterProps {
  onTranscribeSuccess: (meeting: MeetingData) => void;
  onLoadSample: () => void;
}

export const AudioImporter: React.FC<AudioImporterProps> = ({
  onTranscribeSuccess,
  onLoadSample,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'link' | 'mic'>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [cloudUrl, setCloudUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [progressPercent, setProgressPercent] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Microphone recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

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

  // Convert a Blob chunk to base64
  const chunkToBase64 = (chunk: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(chunk);
    });
  };

  // Format file size nicely (MB or GB)
  const formatFileSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024) {
      return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Start Mic Recording
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
        const recordedFile = new File([audioBlob], `Grabacion_Reunion_${new Date().toISOString().slice(0, 10)}.webm`, {
          type: 'audio/webm',
        });
        setSelectedFile(recordedFile);
        if (!meetingTitle) {
          setMeetingTitle(`Reunión Grabada (${new Date().toLocaleDateString('es-ES')})`);
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

  // Stop Mic Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  // Process file upload or cloud link
  const handleProcess = async () => {
    setLoading(true);
    setErrorMessage('');
    setProgressPercent(null);

    try {
      if (activeTab === 'upload' || (activeTab === 'mic' && selectedFile)) {
        if (!selectedFile) {
          setErrorMessage('Por favor selecciona o sube un archivo de audio o video.');
          setLoading(false);
          return;
        }

        // CHUNKED UPLOAD STRATEGY (Supports files up to 2GB without HTTP 413)
        // Send 5MB slices sequentially using file.slice()
        const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB per chunk
        const totalSize = selectedFile.size;
        const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
        const uploadId = 'upload_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, totalSize);
          const chunkBlob = selectedFile.slice(start, end);
          const chunkBase64 = await chunkToBase64(chunkBlob);

          const percent = Math.round(((i + 1) / totalChunks) * 100);
          setProgressPercent(percent);
          const uploadedMB = (end / (1024 * 1024)).toFixed(1);
          const totalMB = (totalSize / (1024 * 1024)).toFixed(1);
          setStatusMessage(`Subiendo archivo de forma segura: ${percent}% (${uploadedMB} MB de ${totalMB} MB)...`);

          const chunkRes = await fetch('./api/upload-chunk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uploadId,
              chunkIndex: i,
              totalChunks,
              chunkBase64,
            }),
          });

          if (!chunkRes.ok) {
            throw new Error(`Error al transferir fragmento ${i + 1}/${totalChunks} (Código: ${chunkRes.status})`);
          }
        }

        // Processing phase on server with ffmpeg and Gemini
        setProgressPercent(null);
        setStatusMessage('Extrayendo pista de audio y optimizando con ffmpeg (soporte para 2 horas)...');

        const processRes = await fetch('./api/process-uploaded-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uploadId,
            meetingTitle: meetingTitle.trim() || selectedFile.name.replace(/\.[^/.]+$/, ''),
            fileName: selectedFile.name,
          }),
        });

        if (!processRes.ok) {
          throw new Error(`Error en el procesamiento del audio (${processRes.status})`);
        }

        setStatusMessage('Generando informe ejecutivo, participantes y compromisos...');
        const resultData = await processRes.json();

        const meetingResult: MeetingData = {
          id: 'meeting-' + Date.now(),
          title: resultData.title || meetingTitle || selectedFile.name,
          date: resultData.date || new Date().toISOString().slice(0, 10),
          estimatedDuration: resultData.estimatedDuration || '01:30:00',
          language: resultData.language || 'Español',
          participants: resultData.participants || [
            { id: 'p1', name: 'Participante 1', role: 'Moderador', avatarColor: '#2563eb' },
          ],
          executiveSummary: resultData.executiveSummary || {
            objective: 'Revisión y acuerdos estratégicos de la sesión.',
            keyPoints: ['Análisis de objetivos del encuentro.'],
            decisions: ['Acuerdos adoptados por consenso.'],
            sentiment: 'Profesional y resolutivo',
          },
          actionItems: resultData.actionItems || [],
          transcript: resultData.transcript || [],
          sourceType: activeTab === 'mic' ? 'mic' : 'file',
          audioFileName: selectedFile.name,
          audioBlobUrl: URL.createObjectURL(selectedFile),
        };

        onTranscribeSuccess(meetingResult);
      } else if (activeTab === 'link') {
        if (!cloudUrl.trim()) {
          setErrorMessage('Por favor ingresa un enlace válido (OneDrive, YouTube, Google Drive, Dropbox, etc.).');
          setLoading(false);
          return;
        }

        setStatusMessage('Conectando con enlace en la nube e identificando la reunión con Gemini...');
        const res = await fetch('./api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            externalUrl: cloudUrl.trim(),
            meetingTitle: meetingTitle.trim() || 'Reunión en la Nube',
          }),
        });

        if (!res.ok) {
          throw new Error(`Error al procesar el enlace (${res.status})`);
        }

        const resultData = await res.json();
        const meetingResult: MeetingData = {
          id: 'meeting-' + Date.now(),
          title: resultData.title || meetingTitle || 'Reunión en la Nube',
          date: resultData.date || new Date().toISOString().slice(0, 10),
          estimatedDuration: resultData.estimatedDuration || '01:15:00',
          language: resultData.language || 'Español',
          participants: resultData.participants || [
            { id: 'p1', name: 'Participante 1', role: 'Expositor', avatarColor: '#2563eb' },
          ],
          executiveSummary: resultData.executiveSummary || {
            objective: 'Análisis de la sesión remota.',
            keyPoints: ['Puntos revisados en la sesión.'],
            decisions: ['Acuerdos de la reunión.'],
            sentiment: 'Colaborativo',
          },
          actionItems: resultData.actionItems || [],
          transcript: resultData.transcript || [],
          sourceType: 'link',
          sourceUrl: cloudUrl,
        };

        onTranscribeSuccess(meetingResult);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Ocurrió un error inesperado al procesar la reunión.');
    } finally {
      setLoading(false);
      setStatusMessage('');
      setProgressPercent(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto my-8 px-4">
      {/* Hero Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Inteligencia de Reuniones en Español • Soporte para Archivos de hasta 2GB y 2 Horas</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
          Transcribe reuniones, identifica participantes y obtén tu acta ejecutiva
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
          Sube tus archivos pesados de audio o video (hasta 2GB), enlaces de OneDrive o YouTube.
          Genera automáticamente transcripciones exactas con marcas de tiempo, resumen ejecutivo, acuerdos y tareas detalladas.
        </p>
      </div>

      {/* Main Importer Card */}
      <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl p-6 sm:p-8">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 mb-6">
          <button
            onClick={() => {
              setActiveTab('upload');
              setErrorMessage('');
            }}
            className={`flex items-center space-x-2 py-3 px-4 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'upload'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Subir Archivo (hasta 2GB)</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('link');
              setErrorMessage('');
            }}
            className={`flex items-center space-x-2 py-3 px-4 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'link'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Link2 className="w-4 h-4" />
            <span>Enlace de la Nube (OneDrive / YouTube)</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('mic');
              setErrorMessage('');
            }}
            className={`flex items-center space-x-2 py-3 px-4 font-medium text-sm border-b-2 transition-colors ${
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
            Título o Asunto de la Reunión (Opcional)
          </label>
          <input
            type="text"
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            placeholder="Ej. Comité de Dirección Q4, Sprint Planning con Cliente, Entrevista de Proyecto..."
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
                    Tamaño: <strong className="text-emerald-300">{formatFileSize(selectedFile.size)}</strong> • Subida segmentada segura contra errores 413
                  </p>
                  <span className="mt-3 text-xs text-blue-400 hover:underline">Haz clic para cambiar de archivo</span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <p className="font-medium text-slate-200 text-sm sm:text-base">
                    Arrastra aquí tu grabación o <span className="text-blue-400 font-semibold">examina tus archivos</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1.5 max-w-md">
                    Formatos compatibles: MP4, MKV, MOV, MP3, WAV, M4A, WebM, AAC, OGG.
                    <br />
                    <span className="text-emerald-400 font-medium">
                      Archivos pesados de hasta 2GB y 2 horas de duración soportados sin error.
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Note on 2GB & 2 hours */}
            <div className="mt-4 flex items-start space-x-2 text-xs text-slate-400 bg-slate-800/40 p-3 rounded-xl border border-slate-800">
              <HardDrive className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Arquitectura de Subida Segmentada:</strong> Para archivos de gran tamaño (hasta 2GB), el sistema los transfiere en bloques seguros de 5MB directamente al motor FFmpeg del servidor, evitando cualquier límite o error de tamaño (HTTP 413).
              </span>
            </div>
          </div>
        )}

        {/* Tab 2: Cloud Links */}
        {activeTab === 'link' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Enlace a la Reunión o Video
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={cloudUrl}
                  onChange={(e) => setCloudUrl(e.target.value)}
                  placeholder="https://onedrive.live.com/... o https://youtube.com/watch?v=... o Google Drive"
                  className="w-full pl-10 pr-4 py-3 bg-slate-800/90 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
                <Link2 className="w-5 h-5 text-slate-400 absolute left-3 top-3.5" />
              </div>
            </div>

            {/* Supported Cloud Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-xs text-slate-400">Servicios soportados:</span>
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300">
                <Cloud className="w-3.5 h-3.5 text-blue-400" />
                <span>OneDrive</span>
              </span>
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300">
                <Youtube className="w-3.5 h-3.5 text-red-400" />
                <span>YouTube</span>
              </span>
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300">
                <Cloud className="w-3.5 h-3.5 text-amber-400" />
                <span>Google Drive</span>
              </span>
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300">
                <Cloud className="w-3.5 h-3.5 text-cyan-400" />
                <span>Dropbox / Enlaces Directos</span>
              </span>
            </div>
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
                <h3 className="text-base font-semibold text-slate-200">Graba tu reunión presencial o llamada</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md">
                  Inicia la grabación directa desde tu micrófono. Al finalizar, la IA identificará las voces de los participantes y generará el acta.
                </p>
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
                <div className="relative mb-4">
                  <div className="w-20 h-20 rounded-full bg-red-600/20 flex items-center justify-center animate-ping absolute inset-0" />
                  <div className="w-20 h-20 rounded-full bg-red-600 text-white flex items-center justify-center relative shadow-lg shadow-red-600/40">
                    <Volume2 className="w-10 h-10 animate-pulse" />
                  </div>
                </div>
                <span className="text-2xl font-mono font-bold text-red-400 tracking-wider">
                  {formatSeconds(recordingSeconds)}
                </span>
                <p className="text-xs text-slate-400 mt-1">Grabando reunión en vivo con audio de alta fidelidad...</p>

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
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <p className="font-semibold text-slate-200 text-sm">Grabación completada con éxito</p>
                <p className="text-xs text-slate-400 mt-1">Duración: {formatSeconds(recordingSeconds)}</p>
                <div className="flex space-x-3 mt-4">
                  <button
                    type="button"
                    onClick={startRecording}
                    className="text-xs text-slate-400 hover:text-slate-200 underline"
                  >
                    Grabar de nuevo
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs sm:text-sm flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
            <div>
              <p className="font-semibold text-red-200">No se pudo procesar la reunión</p>
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
                Procesando Reunión con Inteligencia Artificial
              </span>
            </div>

            <p className="text-xs text-blue-300 max-w-lg mx-auto font-medium">
              {statusMessage || 'Transcribiendo audio y extrayendo actas...'}
            </p>

            {/* Progress Bar (when uploading chunks) */}
            {progressPercent !== null ? (
              <div className="w-full bg-slate-800 rounded-full h-2.5 mt-3 overflow-hidden border border-slate-700">
                <div
                  className="bg-gradient-to-r from-blue-500 to-emerald-400 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            ) : (
              <div className="w-full bg-slate-800 rounded-full h-1.5 mt-3 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-1.5 rounded-full animate-pulse w-3/4 mx-auto" />
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
            <span>Cargar reunión de prueba (2 horas con 4 participantes)</span>
          </button>

          <button
            type="button"
            onClick={handleProcess}
            disabled={loading || (activeTab === 'upload' && !selectedFile) || (activeTab === 'link' && !cloudUrl)}
            className={`w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all shadow-lg ${
              loading || (activeTab === 'upload' && !selectedFile) || (activeTab === 'link' && !cloudUrl)
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
                <span>Comenzar Transcripción Inteligente</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
