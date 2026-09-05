import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

// ============================================================
// NÚMERO DE WHATSAPP OFICIAL CENTRALIZADO PARA TODA LA APP
// Puedes cambiar este valor aquí o definir WHATSAPP_PHONE_NUMBER en .env
// ============================================================
export const OFFICIAL_WHATSAPP_NUMBER = process.env.WHATSAPP_PHONE_NUMBER || '+56 9 5483 3942';

// Dígitos limpios sin espacios ni símbolos (ej: 56954833942)
export const OFFICIAL_WHATSAPP_CLEAN = OFFICIAL_WHATSAPP_NUMBER.replace(/[^0-9]/g, '');

/**
 * Reemplaza números de teléfono obsoletos (ej: 56892107) por el número oficial actual.
 */
export function sanitizeWhatsAppText(text: string): string {
  if (!text) return text;
  return text.replace(/\+?56\s*9?\s*56892107/g, OFFICIAL_WHATSAPP_NUMBER);
}
