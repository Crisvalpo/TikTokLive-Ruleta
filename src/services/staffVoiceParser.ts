import { SupabaseService } from '../db/supabase';

export interface ParsedProduct {
  title?: string;
  item_type?: string;
  character?: string;
  franchise?: string;
  size?: string;
  base_price?: number;
  warehouse_location?: string;
  condition?: 'excelente' | 'bueno' | 'regular';
  transcription?: string;
  missingFields: string[];
}

export type StaffIntentType = 
  | 'REGISTRAR_PRODUCTO'
  | 'INICIAR_REGISTRO'
  | 'COMPLETAR_DATOS'
  | 'CONSULTAR_STOCK'
  | 'APRENDER_REGLA'
  | 'SALUDO_O_AYUDA';

export interface StaffAIResult {
  intent: StaffIntentType;
  product?: ParsedProduct;
  isComplete: boolean;
  missingFields: string[];
  conversationalPrompt?: string;
  learnedRule?: {
    concept: string;
    instruction: string;
    category: string;
  };
  queryResponse?: string;
  rawTranscription?: string;
}

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

let cachedWorldMap: { prompt: string; timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 segundos de caché en memoria

/**
 * MAPA DEL MUNDO DINÁMICO:
 * Inyecta el estado actual de la bodega, categorías y reglas aprendidas en el prompt de Gemini con caché ultra-rápida.
 */
export async function buildWorldMapSystemPrompt(supabase: SupabaseService): Promise<string> {
  const now = Date.now();
  if (cachedWorldMap && (now - cachedWorldMap.timestamp) < CACHE_TTL_MS) {
    return cachedWorldMap.prompt;
  }

  let categoriesText = '- Disfraz, Juguetes Americanos, Accesorio, Prenda, Coleccionables, Peluches, Calzado, Decoración';
  let locationsText = '- 🧥 P1 • Perchero A, 🧥 P1 • Perchero B, 📦 P1 • Cajón 01, 🧥 P2 • Perchero A, 📦 P2 • Cajón 01, 🗄️ P2 • Estante 01';
  let memoryRulesText = '- Ninguna regla adicional aprendida todavía.';

  try {
    const [cats, locs, rules] = await Promise.all([
      supabase.getCategories().catch(() => []),
      supabase.getWarehouseLocations().catch(() => []),
      supabase.getAIMemory().catch(() => [])
    ]);

    if (cats.length > 0) categoriesText = cats.map(c => `- ${c}`).join('\n');
    if (locs.length > 0) locationsText = locs.map(l => `- ${l.name} (${l.floor})`).join('\n');
    if (rules.length > 0) memoryRulesText = rules.map(r => `• [${r.category.toUpperCase()}] ${r.concept}: ${r.instruction}`).join('\n');
  } catch (err) {
    console.warn('[WorldMap] Error cargando contexto dinámico:', err);
  }

  const prompt = `
Eres el ASISTENTE INTELIGENTE DE BODEGA de "Luke Live Subastas" (Chile).
Tu misión es asegurar que los productos se registren con TODOS sus datos reales y exactos.

⚠️ REGLAS ESTRICTAS DE CONTROL DE CALIDAD (PROHIBIDO ASUMIR O INVENTAR DATOS):
1. NO ASUMAS PRECIOS POR DEFECTO: Si el personal no dijo el precio, pon "base_price": null y agrega "base_price" a "missingFields".
2. NO ASUMAS ESTADO/CALIDAD: Si no dijo si está Excelente, Bueno o Regular, pon "condition": null y agrega "condition" a "missingFields".
3. NO ASUMAS TALLA: Para Disfraces, Prendas o Calzado, la talla es obligatoria. Si no la dijo, pon "size": null y agrega "size" a "missingFields".
4. NO ASUMAS UBICACIÓN: Si no dijo perchero o cajón, pon "warehouse_location": null y agrega "warehouse_location" a "missingFields".
5. NO GUARDES REGISTROS GENÉRICOS / BASURA: Si el mensaje es una orden para empezar como "Agrega un producto", "Nuevo producto", "Quiero ingresar algo", el intent es "INICIAR_REGISTRO" y product es null.

🗺️ MAPA DEL MUNDO ACTUAL (ESTADO EN TIEMPO REAL):

📦 CATEGORÍAS VÁLIDAS:
${categoriesText}

📍 UBICACIONES ESTANDARIZADAS DE BODEGA:
${locationsText}

🧠 REGLAS DE NEGOCIO APRENDIDAS:
${memoryRulesText}

FORMATO DE RESPUESTA JSON ESTRICTO:
{
  "intent": "REGISTRAR_PRODUCTO" | "INICIAR_REGISTRO" | "COMPLETAR_DATOS" | "APRENDER_REGLA" | "CONSULTAR_STOCK" | "SALUDO_O_AYUDA",
  "isComplete": true | false,
  "missingFields": ["size", "base_price", "warehouse_location", "condition"], // Lista con lo que falta. Vacío [] si TODO fue declarado.
  "conversationalPrompt": "Texto personalizado y cordial en español chileno pidiendo los datos faltantes o animando a enviar las fotos",
  "product": {
    "title": "Nombre descriptivo real (ej: Disfraz Spiderman Infantil Deluxe)",
    "item_type": "Categoría exacta",
    "character": "Personaje o null",
    "franchise": "Franquicia o null",
    "size": "Talla exacta declarada o null",
    "base_price": 8000, // o null si no se declaró
    "warehouse_location": "Ubicación exacta de la lista o null",
    "condition": "excelente" | "bueno" | "regular", // o null si no se declaró
    "transcription": "Texto literal si fue audio"
  },
  "learnedRule": {
    "concept": "tema",
    "instruction": "regla",
    "category": "clasificacion"
  },
  "queryResponse": "Texto si fue consulta o saludo"
}
`;

  cachedWorldMap = { prompt, timestamp: Date.now() };
  return prompt;
}

/**
 * Procesa mensaje de voz de staff con Gemini 2.5 Flash + Mapa del Mundo
 */
export async function parseStaffVoiceWithWorldMap(
  supabase: SupabaseService,
  audioBuffer: Buffer,
  mimeType: string = 'audio/ogg; codecs=opus',
  previousDraft?: Partial<ParsedProduct>
): Promise<StaffAIResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada');

  const systemPrompt = await buildWorldMapSystemPrompt(supabase);
  const base64Audio = audioBuffer.toString('base64');

  const contextNote = previousDraft 
    ? `\n\nCONTEXTO: El staff está completando un borrador previo con estos datos ya conocidos: ${JSON.stringify(previousDraft)}.`
    : '';

  const payload = {
    contents: [{
      parts: [
        { text: `Analiza, valida y extrae la información de este audio de bodega:${contextNote}` },
        { inlineData: { mimeType: mimeType || 'audio/ogg; codecs=opus', data: base64Audio } }
      ]
    }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
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

  return formatAIResult(parsed, previousDraft);
}

/**
 * Procesa mensaje de texto de staff con Gemini 2.5 Flash + Mapa del Mundo
 */
export async function parseStaffTextWithWorldMap(
  supabase: SupabaseService,
  text: string,
  previousDraft?: Partial<ParsedProduct>
): Promise<StaffAIResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey) {
    return {
      intent: 'INICIAR_REGISTRO',
      isComplete: false,
      missingFields: ['title', 'size', 'base_price', 'warehouse_location', 'condition'],
      conversationalPrompt: '🎙️ Por favor indícame la prenda, talla, ubicación, precio y estado para registrarla.'
    };
  }

  try {
    const systemPrompt = await buildWorldMapSystemPrompt(supabase);

    const contextNote = previousDraft 
      ? `\nCONTEXTO PREVIO: El staff está completando este borrador: ${JSON.stringify(previousDraft)}.`
      : '';

    const payload = {
      contents: [{
        parts: [{ text: `Mensaje del personal de bodega: "${text}"${contextNote}` }]
      }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
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
      console.warn('[Gemini Text Warn] Error en respuesta de Gemini:', response.status);
      return {
        intent: 'INICIAR_REGISTRO',
        isComplete: false,
        missingFields: ['title'],
        conversationalPrompt: '🎙️ Por favor cuéntame qué prenda deseas registrar con su talla, precio, ubicación y estado.'
      };
    }

    const data = await response.json();
    const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';
    const parsed = JSON.parse(rawJson);

    return formatAIResult(parsed, previousDraft, text);
  } catch (err: any) {
    console.error('[Gemini Text Error]:', err.message);
    return {
      intent: 'INICIAR_REGISTRO',
      isComplete: false,
      missingFields: ['title'],
      conversationalPrompt: '🎙️ Por favor indícame la prenda, talla, ubicación, precio y estado.'
    };
  }
}

function formatAIResult(raw: any, previousDraft?: Partial<ParsedProduct>, sourceText?: string): StaffAIResult {
  const intent: StaffIntentType = raw.intent || 'INICIAR_REGISTRO';
  const missingFields: string[] = Array.isArray(raw.missingFields) ? raw.missingFields : [];

  let product: ParsedProduct | undefined = undefined;

  const rawProd = raw.product || {};
  const rawTranscription = sourceText || raw.rawTranscription || rawProd.transcription || '';
  const transLower = rawTranscription.toLowerCase();

  const mergedTitle = rawProd.title || previousDraft?.title;

  if (mergedTitle && !mergedTitle.toLowerCase().includes('artículo de bodega')) {
    const mergedType = rawProd.item_type || previousDraft?.item_type || 'Prenda';
    
    // Talla
    let mergedSize = rawProd.size || previousDraft?.size;
    if (!mergedSize && transLower.includes('talla')) {
      const sm = rawTranscription.match(/talla\s+([a-zA-Z0-9\s\-\+]+?)(?:\s+(?:perchero|percha|caja|cajon|precio|estado)|$)/i);
      if (sm && sm[1]) mergedSize = sm[1].trim();
    }

    // Precio
    let mergedPrice = rawProd.base_price || previousDraft?.base_price;
    if (!mergedPrice && (transLower.includes('precio') || transLower.includes('mil') || transLower.includes('lucas'))) {
      const pm = rawTranscription.match(/(?:precio|valor|\$)\s*[:=]?\s*(\d+)(?:\s*mil|\s*k)?/i);
      if (pm && pm[1]) {
        let num = parseInt(pm[1], 10);
        if (num < 100) num = num * 1000;
        mergedPrice = num;
      }
    }

    // Estado / Calidad
    let mergedCond = rawProd.condition || previousDraft?.condition;
    if (!mergedCond) {
      if (transLower.includes('excelente') || transLower.includes('nuevo')) mergedCond = 'excelente';
      else if (transLower.includes('bueno')) mergedCond = 'bueno';
      else if (transLower.includes('regular') || transLower.includes('usado')) mergedCond = 'regular';
    }

    // Ubicación
    let mergedLoc = rawProd.warehouse_location || previousDraft?.warehouse_location;
    if (!mergedLoc || (!mergedLoc.includes('P1') && !mergedLoc.includes('P2'))) {
      if (transLower.includes('perchero a') || transLower.includes('percha a')) mergedLoc = '🧥 P1 • Perchero A';
      else if (transLower.includes('perchero b') || transLower.includes('percha b')) mergedLoc = '🧥 P1 • Perchero B';
      else if (transLower.includes('perchero c') || transLower.includes('percha c')) mergedLoc = '🧥 P1 • Perchero C';
      else if (transLower.includes('perchero d') || transLower.includes('percha d')) mergedLoc = '🧥 P1 • Perchero D';
      else if (transLower.includes('cajon 1') || transLower.includes('cajón 1') || transLower.includes('caja 1')) mergedLoc = '📦 P1 • Cajón 01';
      else if (transLower.includes('cajon 2') || transLower.includes('cajón 2') || transLower.includes('caja 2')) mergedLoc = '📦 P1 • Cajón 02';
      else if (transLower.includes('cajon 3') || transLower.includes('cajón 3') || transLower.includes('caja 3')) mergedLoc = '📦 P1 • Cajón 03';
    }

    // Recalcular campos faltantes estrictos
    const finalMissing: string[] = [];
    if (!mergedTitle) finalMissing.push('title');
    if (!mergedSize && (mergedType.toLowerCase().includes('disfraz') || mergedType.toLowerCase().includes('prenda') || mergedType.toLowerCase().includes('calzado'))) {
      finalMissing.push('size');
    }
    if (!mergedPrice) finalMissing.push('base_price');
    if (!mergedLoc) finalMissing.push('warehouse_location');
    if (!mergedCond) finalMissing.push('condition');

    const isComplete = finalMissing.length === 0;

    product = {
      title: mergedTitle,
      item_type: mergedType,
      character: rawProd.character || previousDraft?.character,
      franchise: rawProd.franchise || previousDraft?.franchise,
      size: mergedSize,
      base_price: mergedPrice,
      warehouse_location: mergedLoc,
      condition: mergedCond,
      transcription: rawProd.transcription || raw.rawTranscription,
      missingFields: finalMissing
    };

    return {
      intent: isComplete ? 'REGISTRAR_PRODUCTO' : 'COMPLETAR_DATOS',
      product,
      isComplete,
      missingFields: finalMissing,
      conversationalPrompt: raw.conversationalPrompt,
      learnedRule: raw.learnedRule,
      queryResponse: raw.queryResponse,
      rawTranscription: raw.rawTranscription
    };
  }

  return {
    intent: raw.intent === 'INICIAR_REGISTRO' ? 'INICIAR_REGISTRO' : intent,
    isComplete: false,
    missingFields: missingFields.length > 0 ? missingFields : ['title'],
    conversationalPrompt: raw.conversationalPrompt,
    learnedRule: raw.learnedRule,
    queryResponse: raw.queryResponse,
    rawTranscription: raw.rawTranscription
  };
}
