/**
 * Utility for handling and compressing audio files for long meetings (up to 2 hours)
 */

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data:audio/xyz;base64, prefix if present
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Converts an AudioBuffer to a 16-bit Mono WAV Blob
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = 1; // mono for speech
  const length = buffer.length * numOfChan * 2 + 44;
  const outBuffer = new ArrayBuffer(length);
  const view = new DataView(outBuffer);
  const channels: Float32Array[] = [];
  let sampleRate = buffer.sampleRate;
  let offset = 0;
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
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  // fmt sub-chunk
  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // subchunk1size (16 for PCM)
  setUint16(1); // PCM
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * 2 * numOfChan); // byte rate
  setUint16(numOfChan * 2); // block align
  setUint16(16); // bits per sample

  // data sub-chunk
  setUint32(0x61746164); // "data" chunk
  setUint32(length - pos - 4);

  // Mix channels to mono if multi-channel
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (offset < buffer.length) {
    let sample = 0;
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      sample += channels[i][offset];
    }
    sample = sample / buffer.numberOfChannels;
    sample = Math.max(-1, Math.min(1, sample));
    // 16-bit PCM
    view.setInt16(pos, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    pos += 2;
    offset++;
  }

  return new Blob([outBuffer], { type: 'audio/wav' });
}

/**
 * Optimizes an uploaded audio or video file:
 * - If already small audio (< 15MB), returns base64 directly
 * - If large video or heavy audio, extracts audio track and downsamples to 16kHz mono WAV
 */
export async function optimizeAudioForTranscription(
  file: File,
  onProgress?: (message: string) => void
): Promise<{ base64: string; mimeType: string; duration: number }> {
  const isVideo = file.type.startsWith('video/') || /\.(mp4|mkv|mov|avi|webm)$/i.test(file.name);
  const isLarge = file.size > 15 * 1024 * 1024; // > 15MB

  if (!isVideo && !isLarge) {
    onProgress?.('Preparando audio para el análisis...');
    const base64 = await fileToBase64(file);
    return {
      base64,
      mimeType: file.type || 'audio/mp3',
      duration: 0,
    };
  }

  // Large file or video: extract audio via Web Audio API
  try {
    onProgress?.('Extrayendo pista de audio de la reunión...');
    const arrayBuffer = await file.arrayBuffer();
    
    onProgress?.('Decodificando ondas sonoras (puede tomar unos segundos para grabaciones de 2 horas)...');
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const durationSec = decodedBuffer.duration;

    onProgress?.(`Optimizando frecuencia para reconocimiento de voz (Duración: ${formatSeconds(durationSec)})...`);

    // Target 16kHz mono for optimal speech recognition
    const targetSampleRate = 16000;
    const offlineCtx = new OfflineAudioContext(
      1,
      Math.ceil(durationSec * targetSampleRate),
      targetSampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = decodedBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    onProgress?.('Generando flujo de audio comprimido...');
    const wavBlob = audioBufferToWav(renderedBuffer);

    // Convert blob to base64
    const wavFile = new File([wavBlob], 'audio_optimizado.wav', { type: 'audio/wav' });
    const base64 = await fileToBase64(wavFile);

    return {
      base64,
      mimeType: 'audio/wav',
      duration: durationSec,
    };
  } catch (err) {
    console.warn('Fallo en optimización con AudioContext, usando archivo original:', err);
    onProgress?.('Enviando archivo directamente...');
    const base64 = await fileToBase64(file);
    return {
      base64,
      mimeType: file.type || 'audio/mp3',
      duration: 0,
    };
  }
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
  const parts = ts.split(':').map((p) => parseInt(p, 10) || 0);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}
