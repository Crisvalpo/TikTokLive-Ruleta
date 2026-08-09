import { EventType } from '../types';

export interface ParsedCommand {
  command: EventType;
  rawMessage: string;
  isCommand: boolean;
  answer?: 'A' | 'B' | 'C' | 'D';
}

/**
 * Normaliza y parsea comentarios de TikTok / Simulador para extraer comandos y respuestas.
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

  // 3. Comentarios genéricos del chat
  return {
    command: 'CHAT_MESSAGE',
    rawMessage: trimmed,
    isCommand: false
  };
}
