/**
 * Utilidad de procesamiento de audio para transcripción literal (verbatim) de grabaciones extensas
 * (audiencias judiciales, reuniones, entrevistas de hasta 2 horas o más).
 */

export interface AudioChunk {
  index: number;
  totalChunks: number;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  base64: string;
  mimeType: string;
}

export async function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Convierte un rango de muestras de un AudioBuffer mono en un Blob WAV de 16-bit
 */
function samplesToWavBlob(samples: Float32Array, sampleRate: number): Blob {
  const numOfChan = 1;
  const length = samples.length * 2 + 44;
  const outBuffer = new ArrayBuffer(length);
  const view = new DataView(outBuffer);
  let pos = 0;

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }

  // RIFF identifier
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8);
  setUint32(0x45564157); // "WAVE"

  // fmt sub-chunk
  setUint32(0x20746d66); // "fmt "
  setUint32(16);
  setUint16(1); // PCM
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16);

  // data sub-chunk
  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    pos += 2;
  }

  return new Blob([outBuffer], { type: 'audio/wav' });
}

/**
 * Decodifica el archivo de audio/video y lo divide en bloques de 5 minutos (300s) a 8kHz mono (~4.8 MB por bloque).
 * Esto permite transcribir palabra por palabra grabaciones de 30 min, 1 hora o 2+ horas sin cortes ni errores 413.
 */
export async function sliceAudioIntoChunks(
  file: File,
  chunkDurationSec = 300,
  onProgress?: (message: string) => void
): Promise<{ chunks: AudioChunk[]; totalDuration: number }> {
  onProgress?.('Leyendo pista de audio del archivo...');
  const arrayBuffer = await file.arrayBuffer();

  onProgress?.('Decodificando audio completo de la grabación...');
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  const totalDuration = decodedBuffer.duration;

  // Remuestrear a 8000 Hz mono (calidad óptima de voz humana, 4.8 MB cada 5 minutos)
  const targetSampleRate = 8000;
  onProgress?.(
    `Preparando audio (${formatSeconds(totalDuration)}) en bloques para transcripción literal completa...`
  );

  const offlineCtx = new OfflineAudioContext(
    1,
    Math.ceil(totalDuration * targetSampleRate),
    targetSampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = decodedBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  const channelData = renderedBuffer.getChannelData(0);

  const samplesPerChunk = chunkDurationSec * targetSampleRate;
  const totalChunks = Math.ceil(channelData.length / samplesPerChunk);
  const chunks: AudioChunk[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const startSample = i * samplesPerChunk;
    const endSample = Math.min(startSample + samplesPerChunk, channelData.length);
    const sliceSamples = channelData.subarray(startSample, endSample);

    const startSeconds = Math.floor(startSample / targetSampleRate);
    const endSeconds = Math.floor(endSample / targetSampleRate);

    const wavBlob = samplesToWavBlob(sliceSamples, targetSampleRate);
    const base64 = await fileToBase64(wavBlob);

    chunks.push({
      index: i,
      totalChunks,
      startSeconds,
      endSeconds,
      durationSeconds: endSeconds - startSeconds,
      base64,
      mimeType: 'audio/wav',
    });
  }

  try {
    await audioCtx.close();
  } catch (e) {}

  return { chunks, totalDuration };
}

export function formatSeconds(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function parseTimestampToSeconds(ts: string): number {
  const clean = ts.replace(/[^\d:]/g, '');
  const parts = clean.split(':').map((p) => parseInt(p, 10) || 0);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}
