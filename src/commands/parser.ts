import { EventType } from '../types';

export interface ParsedCommand {
  command: EventType;
  rawMessage: string;
  isCommand: boolean;
  numericValue?: number;
}

/**
 * Extrae montos numéricos de pujas de un comentario (ej: "$500", "700", "1.200", "yo 1500").
 */
export function parseBidAmount(message: string): number | null {
  if (!message) return null;
  const trimmed = message.trim();

  // Buscar secuencias de dígitos con posibles puntos/comas de miles o signo $
  // Ejemplos: "$500", "500$", "1.200", "1,200", "$ 1.200", "oferto 1500"
  const bidRegex = /(?:\$|\b)(\d{1,3}(?:[\.,]\d{3})*|\d+)(?:\$|\b)/;
  const match = trimmed.match(bidRegex);

  if (match && match[1]) {
    // Limpiar puntos y comas de formato miles
    const cleanNumStr = match[1].replace(/[\.,]/g, '');
    const num = parseInt(cleanNumStr, 10);
    if (!isNaN(num) && num > 0 && num < 100000000) {
      return num;
    }
  }

  return null;
}

/**
 * Normaliza y parsea comentarios de TikTok / Simulador para extraer pujas numéricas.
 * Ya no detecta respuestas A/B/C/D de quiz ni comandos de ruleta.
 */
export function parseCommand(message: string): ParsedCommand {
  const trimmed = message.trim();

  // Detectar "yo" como reclamo de venta directa (Modo Venta)
  // Limpiar emojis y signos de puntuación comunes para la detección
  const cleanText = trimmed
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/[!¡?¿.,;:_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const yoRegex = /^(yo+|yoo+|yo+\s*(quiero|por\s*fa(vor)?|la\s*quiero|lo\s*quiero|me\s*l[oa]\s*llevo|me\s*l[oa]\s*quedo|1)?|me\s*l[oa]\s*(llevo|quedo)|m[íi]o|m[íi]a)$/i;
  
  if (yoRegex.test(trimmed) || yoRegex.test(cleanText)) {
    return {
      command: 'CLAIM_YO',
      rawMessage: trimmed,
      isCommand: true
    };
  }

  // Detectar si el comentario incluye una puja numérica
  const numericValue = parseBidAmount(trimmed);

  return {
    command: 'CHAT_MESSAGE',
    rawMessage: trimmed,
    isCommand: numericValue !== null,
    numericValue: numericValue || undefined
  };
}
