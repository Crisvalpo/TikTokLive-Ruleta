import * as XLSX from 'xlsx';

export interface BlueExpressRow {
  correlative: number;
  nombre: string;
  apellido: string;
  telefono: string;
  correo: string;
  tipoEntrega: string; // 'Domicilio'
  region: string;
  comuna: string;
  nombreCalle: string;
  numeroDomicilio: string;
  dptoOficina?: string;
  referencia?: string;
  descripcionContenido: string;
  valorContenido: number;
  garantia: string; // 'No' | 'Sí'
  boletaFactura?: string;
  tamano: string; // 'XS' | 'S' | 'M' | 'L'
}

export function generateBlueExpressWorkbook(bags: any[], paymentType: 'por_pagar' | 'prepago' = 'por_pagar'): Buffer {
  const wb = XLSX.utils.book_new();

  // Filtrar solo envíos a domicilio (Punto Blue se procesa vía envío unitario según reglas de Blue Express)
  const domicilioBags = bags.filter(b => {
    const mode = (b.delivery_mode || b.recipient_delivery_mode || 'domicilio').toLowerCase();
    return !mode.includes('punto') && !mode.includes('pudo') && !mode.includes('sucursal');
  });

  // Encabezados exactos según la plantilla oficial de Blue Express (Fila 5)
  const headers = [
    'N°',
    'Nombre*',
    'Apellido*',
    'Telefono*',
    'Correo*',
    'Tipo Entrega*',
    'Región*',
    'Comuna*',
    'Nombre Calle*',
    'N° Domicilio *',
    'Dpto / Oficina',
    'Referencia Ayuda',
    'Descripción Contenido*',
    'Valor Contenido*',
    'Garantía*',
    'N° Boleta / Factura',
    'Tamaño*'
  ];

  // Filas previas descriptivas de la plantilla oficial
  const rows: any[][] = [
    [`PLANTILLA DE CARGA MASIVA DE ENVÍOS - BLUE EXPRESS (${paymentType === 'por_pagar' ? 'POR PAGAR A DOMICILIO' : 'PREPAGO A DOMICILIO'})`],
    ['* Campos obligatorios. Máximo 50 envíos por archivo. Envíos Punto Blue deben realizarse vía Envío Unitario.'],
    [''],
    [''],
    headers
  ];

  domicilioBags.forEach((bag, idx) => {
    // Extraer nombres y apellidos
    const rawFullName = (bag.recipient_name || bag.buyers?.display_name || bag.buyers?.tiktok_username || 'Cliente Luke').trim();
    const nameParts = rawFullName.split(/\s+/);
    const firstName = nameParts[0] || 'Cliente';
    const lastName = nameParts.slice(1).join(' ') || 'Subastas';

    // Teléfono (limpiar a 9 dígitos)
    let rawPhone = (bag.recipient_phone || bag.buyers?.whatsapp_phone || bag.buyers?.phone || '912345678').replace(/[^0-9]/g, '');
    if (rawPhone.startsWith('56') && rawPhone.length === 11) {
      rawPhone = rawPhone.substring(2);
    }
    if (rawPhone.length < 9) {
      rawPhone = '912345678';
    }

    // Dirección y número
    const rawAddress = (bag.recipient_address || 'Dirección por coordinar 100').trim();
    const addressMatch = rawAddress.match(/^(.*?)\s+(\d+[\w-]*)(.*)$/);
    let streetName = rawAddress;
    let streetNumber = 'S/N';
    let depto = bag.recipient_depto || '';

    if (addressMatch) {
      streetName = addressMatch[1].trim();
      streetNumber = addressMatch[2].trim();
      if (addressMatch[3] && !depto) {
        depto = addressMatch[3].trim();
      }
    }

    // Tamaño: 'XS' (hasta 500g) o 'S' (1 a 3 prendas)
    const itemsCount = bag.items_count || 1;
    const size = itemsCount > 3 ? 'M' : itemsCount > 1 ? 'S' : 'XS';

    const row = [
      idx + 1,
      firstName,
      lastName,
      rawPhone,
      bag.recipient_email || bag.buyers?.email || 'ventas@lukeapp.cl',
      'Domicilio',
      bag.recipient_region || 'Región de Valparaíso',
      bag.recipient_commune || 'Valparaíso',
      streetName,
      streetNumber,
      depto,
      bag.recipient_reference || `Bolsa #${bag.reserved_product_code || bag.id.substring(0, 6)} - TikTok @${bag.buyers?.tiktok_username || ''}`,
      `Prendas de vestir Luke Live (${itemsCount} unid.)`,
      bag.total_accumulated || 10000,
      'No',
      '',
      size
    ];

    rows.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Carga Masiva');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
