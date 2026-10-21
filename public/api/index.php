<?php
@set_time_limit(300);
@ini_set('memory_limit', '512M');
@ini_set('max_execution_time', '300');

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Gemini-Key');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$endpoint = $_GET['endpoint'] ?? '';
$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput, true) ?? [];

$keyFile = __DIR__ . '/.gemini_key.txt';
$defaultKey = base64_decode('QVEuQWI4Uk42Snh3Q2xNNzd3bnRvX2RCZm4xSlpwRnZyZDc2TEJOQzBYWk1PT09HR3Bvcmc=');

function isValidKeyFormat($k) {
    $k = trim($k);
    return (strpos($k, 'AQ.') === 0 || strpos($k, 'AIza') === 0) && strlen($k) > 20;
}

function getApiKey($body) {
    global $keyFile, $defaultKey;
    if (!empty($body['apiKey']) && isValidKeyFormat($body['apiKey'])) {
        $k = trim($body['apiKey']);
        @file_put_contents($keyFile, $k);
        return $k;
    }
    if (!empty($_SERVER['HTTP_X_GEMINI_KEY']) && isValidKeyFormat($_SERVER['HTTP_X_GEMINI_KEY'])) {
        $k = trim($_SERVER['HTTP_X_GEMINI_KEY']);
        @file_put_contents($keyFile, $k);
        return $k;
    }
    if (file_exists($keyFile)) {
        $saved = trim(@file_get_contents($keyFile));
        if (isValidKeyFormat($saved)) {
            return $saved;
        }
    }
    $envKey = getenv('GEMINI_API_KEY') ?: '';
    if (isValidKeyFormat($envKey)) {
        return trim($envKey);
    }
    return $defaultKey;
}

function callGemini($apiKey, $payload, $models = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-3.5-transcribe']) {
    $lastError = 'No se pudo conectar con Gemini';

    foreach ($models as $model) {
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . $model . ':generateContent';
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'x-goog-api-key: ' . trim($apiKey),
            'User-Agent: aistudio-build'
        ]);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE));
        curl_setopt($ch, CURLOPT_TIMEOUT, 240);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($response === false) {
            $lastError = 'Error de conexión cURL: ' . $curlErr;
            continue;
        }

        $decoded = json_decode($response, true);
        if ($httpCode >= 400) {
            $msg = $decoded['error']['message'] ?? ('Error HTTP ' . $httpCode);
            $lastError = "($model) $msg";
            // Si el modelo está ocupado (503/429/404), intentar automáticamente el siguiente modelo
            if (in_array($httpCode, [404, 429, 500, 502, 503, 504])) {
                continue;
            }
            throw new Exception('Error de API de Gemini: ' . $msg);
        }

        // Extraer el texto de las partes de la respuesta
        $parts = $decoded['candidates'][0]['content']['parts'] ?? [];
        $textOut = '';
        foreach ($parts as $p) {
            if (isset($p['text'])) {
                $textOut .= $p['text'];
            }
        }
        if ($textOut !== '') {
            return $textOut;
        }
    }

    throw new Exception($lastError);
}

function cleanJsonText($rawText) {
    $cleaned = preg_replace('/^```json\s*/i', '', trim($rawText));
    $cleaned = preg_replace('/^```\s*/i', '', $cleaned);
    $cleaned = preg_replace('/\s*```$/', '', $cleaned);
    return trim($cleaned);
}

// Endpoint: verificar clave API
if ($endpoint === 'check-key') {
    $key = getApiKey($body);
    echo json_encode([
        'hasKey' => !empty($key),
        'maskedKey' => !empty($key) ? (substr($key, 0, 8) . '...' . substr($key, -4)) : null,
    ]);
    exit;
}

if ($endpoint === 'save-key') {
    $key = trim($body['apiKey'] ?? '');
    if (!isValidKeyFormat($key)) {
        http_response_code(400);
        echo json_encode(['error' => 'La clave de API de Google Gemini debe comenzar con "AQ." o "AIza".']);
        exit;
    }
    try {
        callGemini($key, [
            'contents' => [['parts' => [['text' => 'Responde OK']]]]
        ], ['gemini-3.1-flash-lite', 'gemini-3.8-flash']);
        @file_put_contents($keyFile, $key);
        echo json_encode(['success' => true, 'maskedKey' => substr($key, 0, 8) . '...' . substr($key, -4)]);
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// Endpoint: transcribir un bloque de audio palabra por palabra (verbatim)
if ($endpoint === 'transcribe-chunk') {
    $apiKey = getApiKey($body);
    $audioBase64 = $body['audioBase64'] ?? '';
    $mimeType = $body['mimeType'] ?? 'audio/wav';
    $chunkIndex = intval($body['chunkIndex'] ?? 0);
    $totalChunks = intval($body['totalChunks'] ?? 1);
    $startSeconds = intval($body['startSeconds'] ?? 0);
    $endSeconds = intval($body['endSeconds'] ?? 300);
    $previousSpeakers = $body['previousSpeakers'] ?? [];

    if (empty($audioBase64)) {
        http_response_code(400);
        echo json_encode(['error' => 'No se recibió audio en el bloque.']);
        exit;
    }

    $speakersHint = !empty($previousSpeakers)
        ? "Oradores ya identificados en bloques previos (mantén exactamente los mismos nombres si vuelven a hablar): " . implode(', ', $previousSpeakers) . "."
        : "Identifica a cada orador por su nombre y rol si se menciona en el audio (por ejemplo: 'Señor Juez (Orador 1)', 'Dra. María Alejandra Betar', 'Don Leonardo Fabián Rojas', 'Valentina', 'Orador 1', 'Orador 2', etc.).";

    $prompt = "Eres un transcriptor forense, judicial y profesional de máxima precisión en español.
Estás transcribiendo el bloque " . ($chunkIndex + 1) . " de " . $totalChunks . " de una grabación (desde el segundo $startSeconds hasta el segundo $endSeconds).
$speakersHint

INSTRUCCIONES ESTRICTAS E INQUEBRANTABLES:
1. Transcribe PALABRA POR PALABRA (verbatim, de manera 100% literal e íntegra) absolutamente TODO lo que se dice en este audio en español.
2. PROHIBIDO resumir, acortar, parafrasear o inventar textos que no estén en el audio. Si una intervención es larga, transcríbela completa palabra por palabra tal como fue pronunciada.
3. Incluye datos exactos mencionados: nombres completos, números de radicado, cédulas, direcciones, teléfonos, correos, artículos de ley, fechas y horas.
4. Para cada intervención o cambio de hablante, indica el segundo relativo dentro de este fragmento (`relativeSeconds`, entre 0 y " . ($endSeconds - $startSeconds) . ").

Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta:
{
  \"segments\": [
    {
      \"speakerName\": \"Nombre o Rol del Orador\",
      \"relativeSeconds\": 0,
      \"text\": \"Transcripción literal palabra por palabra de toda su intervención...\",
      \"topic\": \"Breve etiqueta del momento\"
    }
  ]
}";

    try {
        $rawResponse = callGemini($apiKey, [
            'contents' => [
                [
                    'parts' => [
                        [
                            'inlineData' => [
                                'mimeType' => $mimeType,
                                'data' => $audioBase64,
                            ]
                        ],
                        ['text' => $prompt]
                    ]
                ]
            ],
            'generationConfig' => [
                'temperature' => 0.1,
                'responseMimeType' => 'application/json',
            ]
        ], ['gemini-3.8-flash', 'gemini-3.1-flash-lite']);

        $cleaned = cleanJsonText($rawResponse);
        $parsed = json_decode($cleaned, true);
        if (!is_array($parsed) || !isset($parsed['segments'])) {
            $parsed = ['segments' => []];
        }
        echo json_encode($parsed, JSON_UNESCAPED_UNICODE);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// Endpoint: generar resumen ejecutivo, participantes y compromisos a partir de la transcripción real completa
if ($endpoint === 'summarize-transcript') {
    $apiKey = getApiKey($body);
    $transcriptText = $body['transcriptText'] ?? '';
    $meetingTitle = $body['meetingTitle'] ?? 'Grabación Transcrita';
    $durationFormatted = $body['durationFormatted'] ?? '00:30:00';

    $prompt = "A continuación tienes la transcripción real y literal de una sesión/audiencia/reunión en español titulada preliminarmente \"$meetingTitle\" (Duración: $durationFormatted).

TRANSCRIPCIÓN REAL:
$transcriptText

Con base EXCLUSIVAMENTE en los hechos reales de esta transcripción (NO inventes nada ajeno al texto; si es una audiencia judicial usa la terminología jurídica exacta del caso, radicado, partes, pretensiones, decisiones del juez, etc.), genera un objeto JSON con:
1. \"title\": Título formal y descriptivo del caso, audiencia o reunión.
2. \"participants\": Lista de todos los intervinientes identificados con:
   - \"id\": \"p1\", \"p2\", etc.
   - \"name\": Nombre completo o identificador del orador.
   - \"role\": Rol real en la audiencia o reunión (ej. Juez / Despacho, Apoderada Demandante, Apoderada Demandado, Demandante, Demandado, Secretario/Asistente).
   - \"speakingPercentage\": Porcentaje estimado de participación (la suma debe ser 100).
   - \"avatarColor\": Color hexadecimal distinto para cada uno (ej. \"#2563eb\", \"#059669\", \"#7c3aed\", \"#d97706\", \"#dc2626\").
3. \"executiveSummary\":
   - \"objective\": Objeto real de la audiencia o reunión (incluyendo radicado, proceso y partes si aplica).
   - \"keyPoints\": Lista detallada de 5 a 10 puntos clave reales ocurridos en la sesión.
   - \"decisions\": Lista de decisiones, autos, resoluciones o acuerdos reales adoptados en la sesión.
   - \"sentiment\": Tono real de la sesión.
4. \"actionItems\": Lista de actuaciones siguientes, etapas procesales o compromisos pendientes reales derivados de la sesión:
   - \"id\": \"t1\", \"t2\", etc.
   - \"task\": Descripción de la actuación o tarea.
   - \"assignee\": Responsable real.
   - \"priority\": \"Alta\", \"Media\" o \"Baja\".
   - \"deadline\": Plazo o momento procesal mencionado.
   - \"status\": \"pendiente\".";

    try {
        $rawResponse = callGemini($apiKey, [
            'contents' => [
                ['parts' => [['text' => $prompt]]]
            ],
            'generationConfig' => [
                'temperature' => 0.2,
                'responseMimeType' => 'application/json',
            ]
        ], ['gemini-3.1-flash-lite', 'gemini-3.8-flash']);

        $cleaned = cleanJsonText($rawResponse);
        $parsed = json_decode($cleaned, true);
        echo json_encode($parsed ?: new stdClass(), JSON_UNESCAPED_UNICODE);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

if ($endpoint === 'ask-transcript') {
    $apiKey = getApiKey($body);
    $question = $body['question'] ?? '';
    $transcriptText = $body['transcriptText'] ?? '';
    $summaryContext = $body['summaryContext'] ?? '';

    $prompt = "Contexto:\n$summaryContext\n\nTranscripción completa:\n$transcriptText\n\nPregunta del usuario:\n\"$question\"\n\nResponde en español con total fidelidad a la transcripción, citando a los intervinientes y marcas de tiempo.";

    try {
        $answer = callGemini($apiKey, [
            'contents' => [['parts' => [['text' => $prompt]]]]
        ], ['gemini-3.1-flash-lite', 'gemini-3.8-flash']);
        echo json_encode(['answer' => $answer], JSON_UNESCAPED_UNICODE);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

echo json_encode(['status' => 'ok', 'service' => 'TranscribeIA Verbatim API']);
