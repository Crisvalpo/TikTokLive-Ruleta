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

  // Detectar si el comentario incluye una puja numérica
  const numericValue = parseBidAmount(trimmed);

  return {
    command: 'CHAT_MESSAGE',
    rawMessage: trimmed,
    isCommand: numericValue !== null,
    numericValue: numericValue || undefined
  };
}
