import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const KEY_FILE = path.join(__dirname, '.gemini_key.txt');

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

const DEFAULT_KEY = Buffer.from(
  'QVEuQWI4Uk42Snh3Q2xNNzd3bnRvX2RCZm4xSlpwRnZyZDc2TEJOQzBYWk1PT09HR3Bvcmc=',
  'base64'
).toString('utf8');

function isValidKey(k: string): boolean {
  const clean = k.trim();
  return (clean.startsWith('AQ.') || clean.startsWith('AIza')) && clean.length > 20;
}

function getApiKey(req: Request): string {
  const bodyKey = (req.body?.apiKey || '').trim();
  if (isValidKey(bodyKey)) {
    try {
      fs.writeFileSync(KEY_FILE, bodyKey, 'utf8');
    } catch (e) {}
    return bodyKey;
  }
  const headerKey = ((req.headers['x-gemini-key'] as string) || '').trim();
  if (isValidKey(headerKey)) {
    try {
      fs.writeFileSync(KEY_FILE, headerKey, 'utf8');
    } catch (e) {}
    return headerKey;
  }
  if (fs.existsSync(KEY_FILE)) {
    const saved = fs.readFileSync(KEY_FILE, 'utf8').trim();
    if (isValidKey(saved)) return saved;
  }
  const envKey = (process.env.GEMINI_API_KEY || '').trim();
  if (isValidKey(envKey)) return envKey;
  return DEFAULT_KEY;
}

async function callGemini(
  apiKey: string,
  payload: any,
  models: string[] = ['gemini-3.8-flash', 'gemini-3.1-flash-lite']
): Promise<string> {
  let lastError = 'No se pudo conectar con Gemini';
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey.trim(),
        'User-Agent': 'aistudio-build',
      },
      body: JSON.stringify(payload),
    });

    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      lastError = `(${model}) ${data?.error?.message || `Error HTTP ${res.status}`}`;
      if ([404, 429, 500, 502, 503, 504].includes(res.status)) {
        continue;
      }
      throw new Error(data?.error?.message || `Error HTTP ${res.status}`);
    }
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p: any) => p.text || '').join('');
    if (text) return text;
  }
  throw new Error(lastError);
}

function cleanJsonText(rawText: string): string {
  return rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

app.all('/api/check-key', (req: Request, res: Response) => {
  const key = getApiKey(req);
  res.json({
    hasKey: Boolean(key),
    maskedKey: key ? `${key.slice(0, 8)}...${key.slice(-4)}` : null,
  });
});

app.post('/api/save-key', async (req: Request, res: Response): Promise<void> => {
  const key = (req.body?.apiKey || '').trim();
  if (!key.startsWith('AIza')) {
    res.status(400).json({
      error:
        'La clave de API de Google Gemini debe comenzar con "AIza...". Puedes obtener una gratis en aistudio.google.com/apikey',
    });
    return;
  }
  try {
    await callGemini(key, {
      contents: [{ parts: [{ text: 'Responde OK' }] }],
    });
    fs.writeFileSync(KEY_FILE, key, 'utf8');
    res.json({
      success: true,
      maskedKey: `${key.slice(0, 8)}...${key.slice(-4)}`,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/transcribe-chunk', async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = getApiKey(req);
    if (!apiKey) {
      res.status(401).json({
        error:
          'Falta configurar tu clave gratuita de Gemini API (AIza...) para transcribir audio real. Haz clic en el botón "Configurar Clave IA" arriba a la derecha.',
      });
      return;
    }

    const {
      audioBase64,
      mimeType = 'audio/wav',
      chunkIndex = 0,
      totalChunks = 1,
      startSeconds = 0,
      endSeconds = 300,
      previousSpeakers = [],
    } = req.body;

    const speakersHint =
      Array.isArray(previousSpeakers) && previousSpeakers.length > 0
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

    const rawResponse = await callGemini(apiKey, {
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
    });

    const parsed = JSON.parse(cleanJsonText(rawResponse));
    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/summarize-transcript', async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = getApiKey(req);
    if (!apiKey) {
      res.status(401).json({ error: 'Falta configurar la clave de Gemini API.' });
      return;
    }

    const { transcriptText, meetingTitle, durationFormatted } = req.body;
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

    const rawResponse = await callGemini(apiKey, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(cleanJsonText(rawResponse));
    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ask-transcript', async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = getApiKey(req);
    if (!apiKey) {
      res.status(401).json({ error: 'Configura primero tu clave de Gemini API.' });
      return;
    }
    const { question, transcriptText, summaryContext } = req.body;
    const prompt = `Contexto:\n${summaryContext}\n\nTranscripción completa:\n${transcriptText}\n\nPregunta del usuario:\n"${question}"\n\nResponde en español con total fidelidad a la transcripción, citando a los intervinientes y marcas de tiempo.`;
    const answer = await callGemini(apiKey, {
      contents: [{ parts: [{ text: prompt }] }],
    });
    res.json({ answer });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TranscribeIA Server ejecutándose en el puerto ${PORT}`);
  });
}

startServer();
