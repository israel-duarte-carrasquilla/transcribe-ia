const DEFAULT_ENCODED_KEY =
  'QVEuQWI4Uk42Snh3Q2xNNzd3bnRvX2RCZm4xSlpwRnZyZDc2TEJOQzBYWk1PT09HR3Bvcmc=';

export function getActiveGeminiKey(customKey?: string): string {
  const candidate = (
    customKey ||
    localStorage.getItem('transcribeia_gemini_key') ||
    ''
  ).trim();
  if (
    (candidate.startsWith('AQ.') || candidate.startsWith('AIza')) &&
    candidate.length > 20
  ) {
    return candidate;
  }
  return atob(DEFAULT_ENCODED_KEY);
}

function cleanJsonText(rawText: string): string {
  return rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

export async function callGeminiDirect(
  payload: any,
  customKey?: string,
  models: string[] = ['gemini-3.8-flash', 'gemini-3.1-flash-lite']
): Promise<string> {
  const apiKey = getActiveGeminiKey(customKey);
  let lastError = 'Error al conectar con el motor de IA';

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error?.message || `HTTP ${res.status}`;
        lastError = `(${model}) ${msg}`;
        if ([404, 429, 500, 502, 503, 504].includes(res.status)) {
          continue;
        }
        throw new Error(msg);
      }

      const parts = data?.candidates?.[0]?.content?.parts || [];
      const text = parts.map((p: any) => p.text || '').join('');
      if (text) {
        return text;
      }
    } catch (err: any) {
      lastError = err.message || lastError;
    }
  }

  throw new Error(lastError);
}

export async function transcribeAudioChunkDirect(params: {
  audioBase64: string;
  mimeType: string;
  chunkIndex: number;
  totalChunks: number;
  startSeconds: number;
  endSeconds: number;
  previousSpeakers: string[];
  apiKey?: string;
}): Promise<{
  segments: Array<{
    speakerName: string;
    relativeSeconds: number;
    text: string;
    topic?: string;
  }>;
}> {
  const {
    audioBase64,
    mimeType,
    chunkIndex,
    totalChunks,
    startSeconds,
    endSeconds,
    previousSpeakers,
    apiKey,
  } = params;

  const speakersHint =
    previousSpeakers.length > 0
      ? `Oradores ya identificados en bloques previos (mantén exactamente los mismos nombres si vuelven a hablar): ${previousSpeakers.join(', ')}.`
      : `Identifica a cada orador por su nombre y rol si se menciona en el audio (por ejemplo: 'Señor Juez (Orador 1)', 'Dra. María Alejandra Betar', 'Don Leonardo Fabián Rojas', 'Valentina', 'Orador 1', 'Orador 2', etc.).`;

  const prompt = `Eres un transcriptor forense, judicial y profesional de máxima precisión en español.
Estás transcribiendo el bloque ${chunkIndex + 1} de ${totalChunks} de una grabación (desde el segundo ${startSeconds} hasta el segundo ${endSeconds}).
${speakersHint}

INSTRUCCIONES ESTRICTAS E INQUEBRANTABLES:
1. Transcribe PALABRA POR PALABRA (verbatim, de manera 100% literal e íntegra) absolutamente TODO lo que se dice en este audio en español.
2. PROHIBIDO resumir, acortar, parafrasear o inventar textos que no estén en el audio. Si una intervención es larga, transcríbela completa palabra por palabra tal como fue pronunciada.
3. Incluye datos exactos mencionados: nombres completos, números de radicado, cédulas, direcciones, teléfonos, correos, artículos de ley, fechas y horas.
4. Para cada intervención o cambio de hablante, indica el segundo relativo dentro de este fragmento (\`relativeSeconds\`, entre 0 y ${endSeconds - startSeconds}).

Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta:
{
  "segments": [
    {
      "speakerName": "Nombre o Rol del Orador",
      "relativeSeconds": 0,
      "text": "Transcripción literal palabra por palabra de toda su intervención...",
      "topic": "Breve etiqueta del momento"
    }
  ]
}`;

  const rawText = await callGeminiDirect(
    {
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    },
    apiKey,
    ['gemini-3.8-flash', 'gemini-3.1-flash-lite']
  );

  const parsed = JSON.parse(cleanJsonText(rawText));
  return {
    segments: Array.isArray(parsed?.segments) ? parsed.segments : [],
  };
}

export async function summarizeTranscriptDirect(params: {
  transcriptText: string;
  meetingTitle: string;
  durationFormatted: string;
  apiKey?: string;
}): Promise<any> {
  const { transcriptText, meetingTitle, durationFormatted, apiKey } = params;

  const prompt = `A continuación tienes la transcripción real y literal de una sesión/audiencia/reunión en español titulada preliminarmente "${meetingTitle}" (Duración: ${durationFormatted}).

TRANSCRIPCIÓN REAL:
${transcriptText}

Con base EXCLUSIVAMENTE en los hechos reales de esta transcripción (NO inventes nada ajeno al texto; si es una audiencia judicial usa la terminología jurídica exacta del caso, radicado, partes, pretensiones, decisiones del juez, etc.), genera un objeto JSON con:
1. "title": Título formal y descriptivo del caso, audiencia o reunión.
2. "participants": Lista de todos los intervinientes identificados con:
   - "id": "p1", "p2", etc.
   - "name": Nombre completo o identificador del orador.
   - "role": Rol real en la audiencia o reunión (ej. Juez / Despacho, Apoderada Demandante, Apoderada Demandado, Demandante, Demandado, Secretario/Asistente).
   - "speakingPercentage": Porcentaje estimado de participación (la suma debe ser 100).
   - "avatarColor": Color hexadecimal distinto para cada uno (ej. "#2563eb", "#059669", "#7c3aed", "#d97706", "#dc2626").
3. "executiveSummary":
   - "objective": Objeto real de la audiencia o reunión (incluyendo radicado, proceso y partes si aplica).
   - "keyPoints": Lista detallada de 5 a 10 puntos clave reales ocurridos en la sesión.
   - "decisions": Lista de decisiones, autos, resoluciones o acuerdos reales adoptados en la sesión.
   - "sentiment": Tono real de la sesión.
4. "actionItems": Lista de actuaciones siguientes, etapas procesales o compromisos pendientes reales derivados de la sesión:
   - "id": "t1", "t2", etc.
   - "task": Descripción de la actuación o tarea.
   - "assignee": Responsable real.
   - "priority": "Alta", "Media" o "Baja".
   - "deadline": Plazo o momento procesal mencionado.
   - "status": "pendiente".`;

  const rawText = await callGeminiDirect(
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    },
    apiKey,
    ['gemini-3.1-flash-lite', 'gemini-3.8-flash']
  );

  return JSON.parse(cleanJsonText(rawText));
}

export async function askTranscriptDirect(params: {
  question: string;
  transcriptText: string;
  summaryContext: string;
  apiKey?: string;
}): Promise<string> {
  const { question, transcriptText, summaryContext, apiKey } = params;
  const prompt = `Contexto:\n${summaryContext}\n\nTranscripción completa:\n${transcriptText}\n\nPregunta del usuario:\n"${question}"\n\nResponde en español con total fidelidad a la transcripción, citando a los intervinientes y marcas de tiempo.`;

  return await callGeminiDirect(
    {
      contents: [{ parts: [{ text: prompt }] }],
    },
    apiKey,
    ['gemini-3.1-flash-lite', 'gemini-3.8-flash']
  );
}
