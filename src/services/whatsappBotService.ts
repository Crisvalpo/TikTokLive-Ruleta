import { supabaseService } from '../db/supabase';

// Datos oficiales de transferencia bancaria y envíos de N&N Ropa Americana
const N_AND_N_PAYMENT_INFO = `Bienvenida/o a N&N 🛒
Te dejo los datitos de transferencia:

Nombre: Narkis Maholys Rodriguez Sanabria
RUT: 26570055-1
Banco: Mercado Pago
Tipo de cuenta: Cuenta Vista
Número de cuenta: 1076781758
 ❌NO CUENTA RUT❌

🚚Envíos a todo Chile:
Realizamos envíos el día miércoles y Domingo.

Paket dentro de Santiago y Valparaíso $3.500 (se paga junto al pedido) avisar si quiere por Paket!

Blue Express: envío por pagar (se cancela al recibir)

Datos De Envío

Nombre y Apellido
Teléfono
Correo
Dirección exacta (Calle, N° de Casa/Depto)
Comuna y Región`;

const GENERAL_INFO_REPLY = `ℹ️ *Información N&N Ropa Americana 🛒*

🌐 *Catálogo disponible:* https://nn.lukeapp.cl
📍 *Ubicación:* Valparaíso, Chile 🌊
🎥 *Transmisiones en vivo TikTok:* @nn.ropa.americana5

🚚 *Envíos a todo Chile:* Miércoles y Domingos.
• **Paket** (Santiago y Valparaíso): $3.500 (se cancela junto al pedido)
• **Blue Express**: Envío por pagar (se cancela al recibir)

Si te adjudicaste o compraste una prenda en el Live, responde con el **número o código de tu prenda** (ej: *#D001* o *D001*).`;

const MENU_REPLY = `👋 *¡Hola! Bienvenida/o a N&N Ropa Americana 🛒*

Por favor indica la opción que necesitas:

1️⃣ **Quieres información** (Catálogo, envíos, ubicación)
2️⃣ **Te adjudicaste algún producto** (Escribe el número o código de tu prenda, ej: *#D001* o *101*)`;

export class WhatsAppBotService {
  /**
   * Procesador principal de mensajes entrantes de WhatsApp para clientes/compradores.
   * La LLAVE PRINCIPAL es el CÓDIGO DE PRENDA.
   */
  public async handleCustomerMessage(cleanPhone: string, incomingText: string, pushName: string): Promise<string> {
    const text = (incomingText || '').trim();
    const cleanPhoneDigits = cleanPhone.replace(/[^0-9]/g, '');

    // 1. ¿El usuario eligió la Opción 1 (Información)?
    if (/^(1|1\.|opcion\s*1|opción\s*1|informacion|información|info)$/i.test(text)) {
      return GENERAL_INFO_REPLY;
    }

    // 2. ¿El usuario eligió la Opción 2 sin incluir el código aún?
    if (/^(2|2\.|opcion\s*2|opción\s*2|adjudique|adjudiqué|compre|compré)$/i.test(text)) {
      return `👕 *Adjudicación de Prenda N&N*\n\nPor favor indícanos el **número o código de la prenda** que te adjudicaste en la transmisión (ej: *#D001* o *101*).`;
    }

    // 3. Extraer el CÓDIGO DE PRENDA (Llave principal) del mensaje
    // Ejemplos válidos: #D001, D001, 101, #101, "prenda D001", "codigo 101", "2 D001"
    let extractedCode: string | null = null;
    const codeMatch = text.match(/(?:#|código|codigo|prenda|numero|número|opcion\s*2\s*|2\s+)?([A-Za-z0-9]{1,10})\b/i);

    if (codeMatch && codeMatch[1]) {
      const candidate = codeMatch[1].toUpperCase();
      // Filtrar palabras que no son códigos
      const nonCodeWords = ['HOLA', 'BUENAS', 'INFO', 'DATOS', 'TIKTOK', 'GRACIAS', 'SALUDOS', 'QUIERO', 'VENTA'];
      if (!nonCodeWords.includes(candidate)) {
        extractedCode = candidate;
      }
    }

    // 4. Si tenemos un número de teléfono ya registrado con compras anteriores
    let buyer = await supabaseService.getBuyerByPhone(cleanPhoneDigits);

    // 5. Si se proporciona un CÓDIGO DE PRENDA, buscar la adjudicación en la base de datos
    if (extractedCode) {
      const cleanCode = extractedCode.replace(/^#/, '');
      const saleResult = await supabaseService.getPendingSaleByProductCode(cleanCode);

      if (saleResult && saleResult.buyer) {
        const targetBuyer = saleResult.buyer;

        // 🔐 VERIFICACIÓN DE SEGURIDAD CON EL CÓDIGO COMO LLAVE
        if (targetBuyer.phone) {
          const existingClean = targetBuyer.phone.replace(/[^0-9]/g, '');
          const isSameNumber = existingClean === cleanPhoneDigits || 
                               (cleanPhoneDigits.length >= 8 && existingClean.endsWith(cleanPhoneDigits.slice(-8)));

          if (!isSameNumber) {
            console.warn(`🚨 [SEGURIDAD BOT] Intento de reclamo de prenda #${cleanCode} desde teléfono no autorizado +${cleanPhoneDigits} (pertenece a ...${existingClean.slice(-4)})`);
            return `⚠️ *Verificación de Seguridad N&N Ropa Americana*\n\n` +
                   `La prenda *#${cleanCode}* figura adjudicada al usuario de TikTok *@${targetBuyer.tiktok_username}*, registrado con otro teléfono (*...${existingClean.slice(-4)}*).\n\n` +
                   `Si este es tu nuevo número de WhatsApp, por favor solicita la confirmación durante el Live de TikTok. 🔒`;
          }
        } else {
          // Primer contacto para esta prenda: Vincular el teléfono del comprador
          console.log(`🔐 [BOT VERIFICACIÓN] Vinculando teléfono +${cleanPhoneDigits} al comprador @${targetBuyer.tiktok_username} por la prenda #${cleanCode}`);
          await supabaseService.updateBuyer(targetBuyer.id, { phone: cleanPhoneDigits });
          targetBuyer.phone = cleanPhoneDigits;
        }

        buyer = targetBuyer;
      }
    }

    // 6. Si el comprador fue verificado (ya sea por su teléfono o por el código recién ingresado)
    if (buyer) {
      const cart = await supabaseService.getBuyerCart(buyer.id);
      let totalAmount = 0;
      let itemsListText = '';

      if (cart && cart.length > 0) {
        totalAmount = cart.reduce((sum, item) => sum + (item.sale_price || 0), 0);
        itemsListText = cart.map(item => {
          const p = item.product;
          const codeStr = p ? `#${p.code}` : '';
          const titleStr = p ? p.title : 'Prenda Adjudicada';
          return `• ${codeStr} - ${titleStr} ($${(item.sale_price || 0).toLocaleString('es-CL')})`;
        }).join('\n');
      }

      let summaryHeader = `✅ *Adjudicación Confirmada para:* @${buyer.tiktok_username}\n\n`;
      if (itemsListText) {
        summaryHeader += `🛒 *Tus prendas:* \n${itemsListText}\n💰 *Total a transferir:* $${totalAmount.toLocaleString('es-CL')}\n\n`;
      } else {
        summaryHeader += `ℹ️ *Registro verificado para @${buyer.tiktok_username}.*\n\n`;
      }

      return `${summaryHeader}${N_AND_N_PAYMENT_INFO}`;
    }

    // 7. Si no coincide ningún código ni teléfono registrado, mostrar el menú interactivo 1 / 2
    return MENU_REPLY;
  }
}

export const whatsappBotService = new WhatsAppBotService();
