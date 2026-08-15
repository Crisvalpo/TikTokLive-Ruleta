import { EventType } from '../types';

export interface ParsedCommand {
  command: EventType;
  rawMessage: string;
  isCommand: boolean;
  answer?: 'A' | 'B' | 'C' | 'D';
  numericValue?: number;
}

/**
 * Extrae montos numéricos de pujas de un comentario (ej: "$500", "700", "1.200", "yo 1500").
 */
export function parseBidAmount(message: string): number | null {
  if (!message) return null;
  const trimmed = message.trim();
  
  // Excluir si es respuesta explícita de Quiz A, B, C, D solos
  const cleanAnswer = trimmed.toLowerCase().replace(/[\/\.\,\s]/g, '').toUpperCase();
  if (['A', 'B', 'C', 'D'].includes(cleanAnswer)) {
    return null;
  }

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
 * Normaliza y parsea comentarios de TikTok / Simulador para extraer comandos, respuestas y pujas.
 */
export function parseCommand(message: string): ParsedCommand {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  // 1. Comando de Giro de Ruleta
  if (lower.startsWith('/girar') || lower.startsWith('/spin') || lower === 'girar') {
    return {
      command: 'SPIN_REQUEST',
      rawMessage: trimmed,
      isCommand: true
    };
  }

  // 2. Respuestas de Quiz: A, B, C, D (o /a, /b, /c, /d, opción A, etc.)
  const cleanAnswer = lower.replace(/[\/\.\,\s]/g, '').toUpperCase();
  if (cleanAnswer === 'A' || cleanAnswer === 'B' || cleanAnswer === 'C' || cleanAnswer === 'D') {
    return {
      command: 'PLAYER_ANSWER',
      rawMessage: trimmed,
      isCommand: true,
      answer: cleanAnswer as 'A' | 'B' | 'C' | 'D'
    };
  }

  // 3. Detectar si el comentario incluye una puja numéricas
  const numericValue = parseBidAmount(trimmed);

  // 4. Comentarios genéricos del chat o pujas numéricas
  return {
    command: 'CHAT_MESSAGE',
    rawMessage: trimmed,
    isCommand: numericValue !== null,
    numericValue: numericValue || undefined
  };
}

