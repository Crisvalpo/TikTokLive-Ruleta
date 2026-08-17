import { SupabaseService } from '../db/supabase';

// Mapeo estándar de categorías a letras prefijo
const CATEGORY_PREFIX_MAP: Record<string, string> = {
  'disfraz': 'D',
  'disfraces': 'D',
  'juguete': 'J',
  'juguetes': 'J',
  'juguete americano': 'J',
  'juguetes americanos': 'J',
  'accesorio': 'A',
  'accesorios': 'A',
  'prenda': 'P',
  'prendas': 'P',
  'ropa': 'P',
  'coleccionable': 'C',
  'coleccionables': 'C',
  'peluche': 'PL',
  'peluches': 'PL',
  'calzado': 'Z',
  'zapatos': 'Z',
  'zapatillas': 'Z',
  'decoracion': 'DEC',
  'decoración': 'DEC'
};

export function getPrefixForCategory(category: string): string {
  if (!category) return 'P';
  const clean = category.trim().toLowerCase();
  if (CATEGORY_PREFIX_MAP[clean]) {
    return CATEGORY_PREFIX_MAP[clean];
  }
  // Si es una categoría personalizada nueva, usar su primera letra
  const firstLetter = clean.charAt(0).toUpperCase();
  return firstLetter.match(/[A-Z]/) ? firstLetter : 'P';
}

export async function generateNextProductCode(supabaseService: SupabaseService, category: string): Promise<string> {
  const prefix = getPrefixForCategory(category);
  
  // Consultar todos los códigos existentes con este prefijo
  const products = await supabaseService.getProducts();
  const existingCodes = (products || []).map(p => (p.code || '').toUpperCase().trim());

  let maxNum = 0;
  const regex = new RegExp(`^${prefix}0*([0-9]+)$`, 'i');

  existingCodes.forEach(code => {
    const match = code.match(regex);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });

  const nextNum = maxNum + 1;
  // Formato con padding a 3 dígitos si es mayor a 0 o estándar limpio (ej: D001, D012, D100)
  const formattedNum = nextNum < 100 ? nextNum.toString().padStart(3, '0') : nextNum.toString();
  return `${prefix}${formattedNum}`;
}
