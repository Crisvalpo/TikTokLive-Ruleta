export interface ParsedProduct {
  title: string;
  item_type: string;
  character?: string;
  franchise?: string;
  size?: string;
  base_price: number;
  warehouse_location: string;
  condition: 'excelente' | 'bueno' | 'regular';
}

const COMMON_CHARACTERS = [
  'Spider-Man', 'Spiderman', 'Batman', 'Superman', 'Iron Man', 'Capitán América', 
  'Hulk', 'Thor', 'Flash', 'Deadpool', 'Wolverine', 'Mario', 'Luigi', 'Sonic',
  'Pikachu', 'Goku', 'Naruto', 'Mickey', 'Minnie', 'Elsa', 'Anna', 'Buzz Lightyear',
  'Woody', 'Stitch', 'Barbie', 'Darth Vader', 'Yoda', 'Princesa Peach', 'Cenicienta',
  'Blancanieves', 'Harry Potter', 'Groot', 'Venom', 'Harley Quinn', 'Joker'
];

const COMMON_FRANCHISES = [
  'Marvel', 'DC Comics', 'DC', 'Disney', 'Pixar', 'Nintendo', 'Anime', 
  'Star Wars', 'Mattel', 'Hasbro', 'Nickelodeon', 'Warner Bros', 'Pokemon', 'Lego'
];

export function parseProductDescription(rawText: string): ParsedProduct {
  const text = rawText.trim();
  const lower = text.toLowerCase();

  // 1. Detectar Categoría
  let item_type = 'Prenda';
  if (lower.includes('disfraz') || lower.includes('traje')) {
    item_type = 'Disfraz';
  } else if (lower.includes('juguete') || lower.includes('figura') || lower.includes('muñeco') || lower.includes('auto')) {
    item_type = 'Juguetes Americanos';
  } else if (lower.includes('accesorio') || lower.includes('máscara') || lower.includes('mascara') || lower.includes('capa') || lower.includes('espada') || lower.includes('varita')) {
    item_type = 'Accesorio';
  } else if (lower.includes('peluche')) {
    item_type = 'Peluches';
  } else if (lower.includes('coleccionable') || lower.includes('vintage')) {
    item_type = 'Coleccionables';
  } else if (lower.includes('calzado') || lower.includes('zapato') || lower.includes('zapatilla') || lower.includes('bota')) {
    item_type = 'Calzado';
  }

  // 2. Detectar Precio Base
  let base_price = 5000;
  const priceMatch = text.match(/(?:precio|base|valor|\$)\s*[:=]?\s*\$?\s*([\d\.]+)(?:\s*mil|\s*k)?/i) || text.match(/\$\s*([\d\.]+)/);
  if (priceMatch && priceMatch[1]) {
    let cleanNum = priceMatch[1].replace(/\./g, '');
    let num = parseInt(cleanNum, 10);
    if (!isNaN(num)) {
      if (priceMatch[0].toLowerCase().includes('mil') || priceMatch[0].toLowerCase().includes('k')) {
        num = num * 1000;
      } else if (num < 100) {
        num = num * 1000; // Ej: "8" -> 8000
      }
      base_price = num;
    }
  }

  // 3. Detectar Talla
  let size = '';
  const sizeMatch = text.match(/(?:talla|talle|tam|tamaño)\s*[:=]?\s*([a-zA-Z0-9\-\s\/\+]{1,15})(?:,|\.|\n|$)/i);
  if (sizeMatch && sizeMatch[1]) {
    size = sizeMatch[1].trim();
  } else {
    // Buscar patrones como "talla 6", "talla 4-6", "talla M", "talla L", "talla XL"
    const quickSizeMatch = text.match(/\b(XXL|XL|XS|S|M|L|\d+\s*(?:a|-)\s*\d+\s*(?:años|año)?|\d+\s*(?:años|año|meses|m))\b/i);
    if (quickSizeMatch && quickSizeMatch[1]) {
      size = quickSizeMatch[1].trim();
    }
  }

  // 4. Detectar Ubicación en Bodega
  let warehouse_location = 'Bodega Principal';
  const locMatch = text.match(/(?:percha|perchero|caja|estante|repisa|ubicacion|ubicación|posicion|pos)\s*[:=]?\s*([a-zA-Z0-9\-\s]{1,15})(?:,|\.|\n|$)/i);
  if (locMatch && locMatch[1]) {
    const word = locMatch[0].split(/\s+/)[0];
    warehouse_location = `${word} ${locMatch[1].trim()}`.trim();
  }

  // 5. Detectar Estado de Conservación
  let condition: 'excelente' | 'bueno' | 'regular' = 'excelente';
  if (lower.includes('regular') || lower.includes('usado con detalle')) {
    condition = 'regular';
  } else if (lower.includes('bueno') || lower.includes('buen estado') || lower.includes('muy bueno')) {
    condition = 'bueno';
  } else if (lower.includes('excelente') || lower.includes('nuevo') || lower.includes('impecable')) {
    condition = 'excelente';
  }

  // 6. Detectar Personaje y Franquicia
  let character: string | undefined = undefined;
  for (const c of COMMON_CHARACTERS) {
    if (new RegExp(`\\b${c}\\b`, 'i').test(text)) {
      character = c;
      break;
    }
  }

  let franchise: string | undefined = undefined;
  for (const f of COMMON_FRANCHISES) {
    if (new RegExp(`\\b${f}\\b`, 'i').test(text)) {
      franchise = f;
      break;
    }
  }

  // Si se encontró personaje y no franquicia, autoasignar
  if (character && !franchise) {
    if (['Spider-Man', 'Spiderman', 'Iron Man', 'Hulk', 'Thor', 'Deadpool', 'Wolverine', 'Groot', 'Venom'].includes(character)) {
      franchise = 'Marvel';
    } else if (['Batman', 'Superman', 'Flash', 'Harley Quinn', 'Joker'].includes(character)) {
      franchise = 'DC Comics';
    } else if (['Mickey', 'Minnie', 'Elsa', 'Anna', 'Buzz Lightyear', 'Woody', 'Stitch'].includes(character)) {
      franchise = 'Disney';
    }
  }

  // 7. Generar Título Limpio
  let title = text
    .replace(/(?:precio|base|valor|\$)\s*[:=]?\s*\$?\s*[\d\.]+(?:\s*mil|\s*k)?/gi, '')
    .replace(/(?:talla|talle)\s*[:=]?\s*[a-zA-Z0-9\-\s\/\+]{1,15}/gi, '')
    .replace(/(?:percha|perchero|caja|estante|repisa|ubicacion|ubicación)\s*[:=]?\s*[a-zA-Z0-9\-\s]{1,15}/gi, '')
    .replace(/(?:excelente|bueno|regular|impecable|nuevo)\s*(?:estado)?/gi, '')
    .replace(/,\s*,/g, ',')
    .trim();

  // Si el título quedó muy corto o vacío, sintetizarlo inteligentemente
  if (title.length < 5) {
    title = `${item_type} ${character || ''} ${franchise || ''}`.trim() || `${item_type} en Bodega`;
  }

  // Capitalizar primera letra
  title = title.charAt(0).toUpperCase() + title.slice(1);

  return {
    title,
    item_type,
    character,
    franchise,
    size: size || 'Estándar',
    base_price,
    warehouse_location,
    condition
  };
}
