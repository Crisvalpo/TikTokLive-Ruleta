export interface ParsedProduct {
  title: string;
  item_type: string;
  character?: string;
  franchise?: string;
  size?: string;
  base_price: number;
  warehouse_location: string;
  condition: 'excelente' | 'bueno' | 'regular';
  transcription?: string;
}

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

const SYSTEM_PROMPT = `
Eres el asistente de IA para el personal de bodega de Luke Live Subastas (Chile).
Tu misión es escuchar audios de voz o leer mensajes de texto del personal y extraer de forma extremadamente precisa la ficha de producto en formato JSON estricto.

Campos requeridos en el JSON:
- "title": Título descriptivo y limpio del producto (ej: "Disfraz Spiderman Infantil Deluxe").
- "item_type": Categoría del artículo. Elige la más adecuada (ej: "Disfraz", "Juguetes Americanos", "Accesorio", "Prenda", "Coleccionables", "Peluches", "Calzado") o una nueva si corresponde.
- "character": Nombre del personaje si aplica (ej: "Spider-Man", "Batman", "Mickey", "Elsa", "Goku"), o null.
- "franchise": Marca o franquicia (ej: "Marvel", "DC Comics", "Disney", "Mattel", "Hasbro", "Nintendo", "Anime"), o null.
- "size": Talla detectada (ej: "4-6 años", "M", "L", "Talla 8", "Estándar").
- "base_price": Precio base en CLP como número entero (ej: 8000). Si dicen "8 mil" o "8k", es 8000. Si dicen "8" suele ser 8000. Por defecto 5000.
- "warehouse_location": Ubicación física en bodega (ej: "Percha A12", "Caja 3", "Estante B", "Bodega Principal").
- "condition": Estado ("excelente", "bueno", "regular"). Por defecto "excelente".
- "transcription": Transcripción literal del audio si vino en formato de voz.

Responde ÚNICAMENTE con el objeto JSON válido.
`;

export async function parseProductWithGeminiAudio(audioBuffer: Buffer, mimeType: string = 'audio/ogg; codecs=opus'): Promise<ParsedProduct> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no configurada');
  }

  const base64Audio = audioBuffer.toString('base64');
  const payload = {
    contents: [{
      parts: [
        { text: 'Extrae la información de esta prenda/artículo de bodega a partir del siguiente audio de voz:' },
        { inlineData: { mimeType: mimeType || 'audio/ogg; codecs=opus', data: base64Audio } }
      ]
    }],
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  };

  const response = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`[Gemini Audio Error] ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';
  const parsed = JSON.parse(rawJson);

  return {
    title: parsed.title || 'Artículo de Bodega',
    item_type: parsed.item_type || 'Prenda',
    character: parsed.character || undefined,
    franchise: parsed.franchise || undefined,
    size: parsed.size || 'Estándar',
    base_price: Number(parsed.base_price) || 5000,
    warehouse_location: parsed.warehouse_location || 'Bodega Principal',
    condition: (parsed.condition === 'bueno' || parsed.condition === 'regular') ? parsed.condition : 'excelente',
    transcription: parsed.transcription
  };
}

export async function parseProductWithGeminiText(text: string): Promise<ParsedProduct> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey) {
    return parseProductHeuristic(text);
  }

  try {
    const payload = {
      contents: [{
        parts: [{ text: `Mensaje del personal de bodega: "${text}"` }]
      }],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    };

    const response = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.warn('[Gemini Text Warn] Fallback a heurístico debido a error:', response.status);
      return parseProductHeuristic(text);
    }

    const data = await response.json();
    const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';
    const parsed = JSON.parse(rawJson);

    return {
      title: parsed.title || 'Artículo de Bodega',
      item_type: parsed.item_type || 'Prenda',
      character: parsed.character || undefined,
      franchise: parsed.franchise || undefined,
      size: parsed.size || 'Estándar',
      base_price: Number(parsed.base_price) || 5000,
      warehouse_location: parsed.warehouse_location || 'Bodega Principal',
      condition: (parsed.condition === 'bueno' || parsed.condition === 'regular') ? parsed.condition : 'excelente'
    };
  } catch (err: any) {
    console.error('[Gemini Text Exception] Usando parser heurístico:', err.message);
    return parseProductHeuristic(text);
  }
}

// Fallback Heurístico local en caso de desconexión
export function parseProductHeuristic(rawText: string): ParsedProduct {
  const text = rawText.trim();
  const lower = text.toLowerCase();

  let item_type = 'Prenda';
  if (lower.includes('disfraz') || lower.includes('traje')) {
    item_type = 'Disfraz';
  } else if (lower.includes('juguete') || lower.includes('figura') || lower.includes('muñeco') || lower.includes('auto')) {
    item_type = 'Juguetes Americanos';
  } else if (lower.includes('accesorio') || lower.includes('máscara') || lower.includes('mascara') || lower.includes('capa')) {
    item_type = 'Accesorio';
  } else if (lower.includes('peluche')) {
    item_type = 'Peluches';
  } else if (lower.includes('coleccionable') || lower.includes('vintage')) {
    item_type = 'Coleccionables';
  } else if (lower.includes('calzado') || lower.includes('zapato') || lower.includes('zapatilla')) {
    item_type = 'Calzado';
  }

  let base_price = 5000;
  const priceMatch = text.match(/(?:precio|base|valor|\$)\s*[:=]?\s*\$?\s*([\d\.]+)(?:\s*mil|\s*k)?/i) || text.match(/\$\s*([\d\.]+)/);
  if (priceMatch && priceMatch[1]) {
    let cleanNum = priceMatch[1].replace(/\./g, '');
    let num = parseInt(cleanNum, 10);
    if (!isNaN(num)) {
      if (priceMatch[0].toLowerCase().includes('mil') || priceMatch[0].toLowerCase().includes('k')) num = num * 1000;
      else if (num < 100) num = num * 1000;
      base_price = num;
    }
  }

  let size = 'Estándar';
  const sizeMatch = text.match(/(?:talla|talle)\s*[:=]?\s*([a-zA-Z0-9\-\s\/\+]{1,15})(?:,|\.|\n|$)/i);
  if (sizeMatch && sizeMatch[1]) size = sizeMatch[1].trim();

  let warehouse_location = 'Bodega Principal';
  const locMatch = text.match(/(?:percha|perchero|caja|estante|repisa)\s*[:=]?\s*([a-zA-Z0-9\-\s]{1,15})(?:,|\.|\n|$)/i);
  if (locMatch && locMatch[1]) warehouse_location = locMatch[0].trim();

  let condition: 'excelente' | 'bueno' | 'regular' = 'excelente';
  if (lower.includes('regular')) condition = 'regular';
  else if (lower.includes('bueno')) condition = 'bueno';

  let title = text
    .replace(/(?:precio|base|valor|\$)\s*[:=]?\s*\$?\s*[\d\.]+(?:\s*mil|\s*k)?/gi, '')
    .replace(/(?:talla|talle)\s*[:=]?\s*[a-zA-Z0-9\-\s\/\+]{1,15}/gi, '')
    .replace(/(?:percha|perchero|caja|estante|repisa)\s*[:=]?\s*[a-zA-Z0-9\-\s]{1,15}/gi, '')
    .trim();

  if (title.length < 4) title = `${item_type} en Bodega`;

  return {
    title: title.charAt(0).toUpperCase() + title.slice(1),
    item_type,
    size,
    base_price,
    warehouse_location,
    condition
  };
}
