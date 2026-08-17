import { SupabaseService } from '../db/supabase';

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

export type StaffIntentType = 'REGISTRAR_PRODUCTO' | 'CONSULTAR_STOCK' | 'APRENDER_REGLA' | 'MODIFICAR_PRODUCTO' | 'SALUDO_O_AYUDA';

export interface StaffAIResult {
  intent: StaffIntentType;
  product?: ParsedProduct;
  learnedRule?: {
    concept: string;
    instruction: string;
    category: string;
  };
  queryResponse?: string;
  rawTranscription?: string;
}

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * MAPA DEL MUNDO DINÁMICO:
 * Inyecta el estado actual de la bodega, categorías y reglas aprendidas en el prompt de Gemini.
 */
export async function buildWorldMapSystemPrompt(supabase: SupabaseService): Promise<string> {
  let categoriesText = '- Disfraz, Juguetes Americanos, Accesorio, Prenda, Coleccionables, Peluches, Calzado, Decoración';
  let locationsText = '- 🧥 P1 • Perchero A, 🧥 P1 • Perchero B, 📦 P1 • Cajón 01, 🧥 P2 • Perchero A, 📦 P2 • Cajón 01, 🗄️ P2 • Estante 01';
  let memoryRulesText = '- Ninguna regla adicional aprendida todavía.';

  try {
    const cats = await supabase.getCategories();
    if (cats.length > 0) categoriesText = cats.map(c => `- ${c}`).join('\n');

    const locs = await supabase.getWarehouseLocations();
    if (locs.length > 0) locationsText = locs.map(l => `- ${l.name} (${l.floor})`).join('\n');

    const rules = await supabase.getAIMemory();
    if (rules.length > 0) memoryRulesText = rules.map(r => `• [${r.category.toUpperCase()}] ${r.concept}: ${r.instruction}`).join('\n');
  } catch (err) {
    console.warn('[WorldMap] Error cargando contexto dinámico:', err);
  }

  return `
Eres el ASISTENTE DE IA INTELIGENTE (Staff & Bodega) de "Luke Live Subastas" (Chile).
Tu rol es procesar los audios de voz (notas de voz PTT) y mensajes de texto del equipo de bodega con razonamiento avanzado.

🗺️ MAPA DEL MUNDO ACTUAL (ESTADO EN TIEMPO REAL DE LA BODEGA):

📦 CATEGORÍAS VÁLIDAS:
${categoriesText}

📍 UBICACIONES ESTANDARIZADAS DE BODEGA:
${locationsText}

🧠 REGLAS DE NEGOCIO & APRENDIZAJES ACTIVOS:
${memoryRulesText}

🛠️ META-TOOLS & CLASIFICACIÓN DE INTENCIÓN:
Debes clasificar el mensaje del staff en una de las siguientes intenciones:

1. "REGISTRAR_PRODUCTO": Cuando el staff describe una prenda o artículo para ingresarlo.
   - Extrae obligatoriamente la ficha completa: title, item_type, character, franchise, size, base_price, warehouse_location, condition.
   - Mapea la ubicación dicha ("perchero A", "caja 2", "estante") a la lista estandarizada más cercana (ej: "🧥 P1 • Perchero A", "📦 P2 • Cajón 02").
   - Resuelve precios chilenos: "7 lucas", "7 mil", "7k", "7" -> 7000. Por defecto 5000.

2. "APRENDER_REGLA": Cuando el staff te enseña algo nuevo o define una preferencia.
   - Ejemplos: "Recuerda que los Funkos van en Coleccionables", "Los Legos se guardan en el cajón 3", "Aprende que la ropa de verano va en el perchero D".
   - Extrae: concept, instruction, category.

3. "CONSULTAR_STOCK": Cuando el staff pregunta por existencias o ubicaciones.
   - Ejemplos: "¿Dónde dejamos los disfraces de Mario Bros?", "¿Cuántos juguetes nos quedan?".

4. "SALUDO_O_AYUDA": Mensajes simples como "Hola", "¿Qué puedes hacer?", etc.

FORMATO DE RESPUESTA ESTRICTO:
Responde ÚNICAMENTE con un JSON válido con esta estructura:
{
  "intent": "REGISTRAR_PRODUCTO" | "APRENDER_REGLA" | "CONSULTAR_STOCK" | "SALUDO_O_AYUDA",
  "product": {
    "title": "Nombre descriptivo",
    "item_type": "Categoría exacta",
    "character": "Personaje o null",
    "franchise": "Franquicia o null",
    "size": "Talla (ej: 6-8 años, M, Estándar)",
    "base_price": 7000,
    "warehouse_location": "Ubicación exacta del mapa del mundo",
    "condition": "excelente" | "bueno" | "regular",
    "transcription": "Texto literal si fue audio"
  },
  "learnedRule": {
    "concept": "tema",
    "instruction": "regla a recordar",
    "category": "clasificacion"
  },
  "queryResponse": "Texto de respuesta si es consulta o saludo"
}
`;
}

/**
 * Procesa mensaje de voz de staff con Gemini 2.5 Flash + Mapa del Mundo
 */
export async function parseStaffVoiceWithWorldMap(
  supabase: SupabaseService,
  audioBuffer: Buffer,
  mimeType: string = 'audio/ogg; codecs=opus'
): Promise<StaffAIResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada');

  const systemPrompt = await buildWorldMapSystemPrompt(supabase);
  const base64Audio = audioBuffer.toString('base64');

  const payload = {
    contents: [{
      parts: [
        { text: 'Procesa y clasifica este audio del personal de bodega según el Mapa del Mundo:' },
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

  return formatAIResult(parsed);
}

/**
 * Procesa mensaje de texto de staff con Gemini 2.5 Flash + Mapa del Mundo
 */
export async function parseStaffTextWithWorldMap(
  supabase: SupabaseService,
  text: string
): Promise<StaffAIResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey) {
    const heur = parseProductHeuristic(text);
    return {
      intent: 'REGISTRAR_PRODUCTO',
      product: heur
    };
  }

  try {
    const systemPrompt = await buildWorldMapSystemPrompt(supabase);

    const payload = {
      contents: [{
        parts: [{ text: `Mensaje del personal de bodega: "${text}"` }]
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
      console.warn('[Gemini Text Warn] Fallback a heurístico:', response.status);
      return { intent: 'REGISTRAR_PRODUCTO', product: parseProductHeuristic(text) };
    }

    const data = await response.json();
    const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';
    const parsed = JSON.parse(rawJson);

    return formatAIResult(parsed);
  } catch (err: any) {
    console.error('[Gemini Text Error] Fallback a heurístico:', err.message);
    return { intent: 'REGISTRAR_PRODUCTO', product: parseProductHeuristic(text) };
  }
}

function formatAIResult(raw: any): StaffAIResult {
  const intent: StaffIntentType = raw.intent || (raw.product ? 'REGISTRAR_PRODUCTO' : 'SALUDO_O_AYUDA');

  let product: ParsedProduct | undefined = undefined;
  if (raw.product) {
    product = {
      title: raw.product.title || 'Artículo de Bodega',
      item_type: raw.product.item_type || 'Prenda',
      character: raw.product.character || undefined,
      franchise: raw.product.franchise || undefined,
      size: raw.product.size || 'Estándar',
      base_price: Number(raw.product.base_price) || 5000,
      warehouse_location: raw.product.warehouse_location || '🧥 P1 • Perchero A',
      condition: (raw.product.condition === 'bueno' || raw.product.condition === 'regular') ? raw.product.condition : 'excelente',
      transcription: raw.product.transcription || raw.rawTranscription
    };
  }

  return {
    intent,
    product,
    learnedRule: raw.learnedRule,
    queryResponse: raw.queryResponse,
    rawTranscription: raw.rawTranscription
  };
}

// Fallback Heurístico local
export function parseProductHeuristic(rawText: string): ParsedProduct {
  const text = rawText.trim();
  const lower = text.toLowerCase();

  let item_type = 'Prenda';
  if (lower.includes('disfraz') || lower.includes('traje')) {
    item_type = 'Disfraz';
  } else if (lower.includes('juguete') || lower.includes('figura') || lower.includes('muñeco') || lower.includes('auto')) {
    item_type = 'Juguetes Americanos';
  } else if (lower.includes('accesorio') || lower.includes('máscara') || lower.includes('capa')) {
    item_type = 'Accesorio';
  } else if (lower.includes('peluche')) {
    item_type = 'Peluches';
  } else if (lower.includes('coleccionable') || lower.includes('vintage') || lower.includes('funko')) {
    item_type = 'Coleccionables';
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

  let warehouse_location = '🧥 P1 • Perchero A';
  const locMatch = text.match(/(?:percha|perchero|caja|cajon|estante|repisa)\s*[:=]?\s*([a-zA-Z0-9\-\s]{1,15})(?:,|\.|\n|$)/i);
  if (locMatch && locMatch[1]) warehouse_location = locMatch[0].trim();

  let condition: 'excelente' | 'bueno' | 'regular' = 'excelente';
  if (lower.includes('regular')) condition = 'regular';
  else if (lower.includes('bueno')) condition = 'bueno';

  let title = text
    .replace(/(?:precio|base|valor|\$)\s*[:=]?\s*\$?\s*[\d\.]+(?:\s*mil|\s*k)?/gi, '')
    .replace(/(?:talla|talle)\s*[:=]?\s*[a-zA-Z0-9\-\s\/\+]{1,15}/gi, '')
    .replace(/(?:percha|perchero|caja|cajon|estante|repisa)\s*[:=]?\s*[a-zA-Z0-9\-\s]{1,15}/gi, '')
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
