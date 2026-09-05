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

Nombre
Teléfono
Correo
Dirección exacta con región y comuna`;

export class WhatsAppBotService {
  /**
   * Procesador principal de mensajes entrantes de WhatsApp para clientes/compradores.
   * Valida la identidad del usuario en TikTok y asocia de forma 100% segura su número de teléfono.
   */
  public async handleCustomerMessage(cleanPhone: string, incomingText: string, pushName: string): Promise<string> {
    const text = (incomingText || '').trim();
    const cleanPhoneDigits = cleanPhone.replace(/[^0-9]/g, '');

    // 1. ¿El número ya está verificado y registrado a un comprador en Supabase?
    let buyer = await supabaseService.getBuyerByPhone(cleanPhoneDigits);

    // 2. Extracción precisa de usuario de TikTok o código de prenda
    let mentionedUsername: string | null = null;
    let mentionedCode: string | null = null;

    // Buscar arroba explícita: @maria28
    const explicitAtMatch = text.match(/@([a-zA-Z0-9_.-]{3,30})/);
    if (explicitAtMatch) {
      mentionedUsername = explicitAtMatch[1].trim();
    } else {
      // Buscar frases clave: "soy maria28", "usuario maria28", "tiktok maria28", "me llamo maria28"
      const phraseMatch = text.match(/(?:soy|usuario|tiktok|me llamo|cuenta|adjudico|adjudiqué)\s+([a-zA-Z0-9_.-]{3,30})/i);
      if (phraseMatch) {
        mentionedUsername = phraseMatch[1].trim();
      }
    }

    // Buscar código de producto: #D001, #P004 o "codigo D001"
    const explicitCodeMatch = text.match(/#([A-Za-z0-9]{1,8})\b/) || text.match(/(?:codigo|código|prenda)\s+([A-Za-z0-9]{1,8})\b/i);
    if (explicitCodeMatch) {
      mentionedCode = explicitCodeMatch[1].toUpperCase();
    }

    // 3. Si el número NO estaba registrado, intentar emparejar por usuario o código de prenda
    if (!buyer && (mentionedUsername || mentionedCode)) {
      if (mentionedUsername) {
        buyer = await supabaseService.getBuyerByUsername(mentionedUsername);
      }
      
      if (!buyer && mentionedCode) {
        const bag = await supabaseService.findPendingBagByProductCode(mentionedCode);
        if (bag && bag.buyers) {
          buyer = bag.buyers;
        }
      }

      if (buyer) {
        // 🔐 VERIFICACIÓN DE SEGURIDAD ANTI-SUPLANTACIÓN
        if (buyer.phone) {
          const existingClean = buyer.phone.replace(/[^0-9]/g, '');
          const isSameNumber = existingClean === cleanPhoneDigits || 
                             (cleanPhoneDigits.length >= 8 && existingClean.endsWith(cleanPhoneDigits.slice(-8)));

          if (!isSameNumber) {
            console.warn(`🚨 [SEGURIDAD BOT] Intento de vinculación no autorizada. Teléfono ${cleanPhoneDigits} intentó reclamar @${buyer.tiktok_username}, que ya pertenece al número ...${existingClean.slice(-4)}`);
            return `⚠️ *Verificación de Seguridad N&N Ropa Americana*\n\n` +
                   `El usuario de TikTok *@${buyer.tiktok_username}* ya está vinculado al teléfono terminado en *...${existingClean.slice(-4)}*.\n\n` +
                   `Si cambiaste de número de WhatsApp, por favor avísale a la transmisión en vivo por TikTok para autorizar la actualización de tu registro. 🔒`;
          }
        } else {
          // Primer contacto: Vincular teléfono de forma permanente en la base de datos
          console.log(`🔐 [BOT VERIFICACIÓN] Vinculando teléfono +${cleanPhoneDigits} al comprador @${buyer.tiktok_username}`);
          await supabaseService.updateBuyer(buyer.id, { phone: cleanPhoneDigits });
          buyer.phone = cleanPhoneDigits;
        }
      }
    }

    // 4. Si el comprador está verificado y confirmado (ya sea previo o recién vinculado)
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

      let summaryHeader = `✅ *Identidad Confirmada:* @${buyer.tiktok_username}\n\n`;
      if (itemsListText) {
        summaryHeader += `🛒 *Tus prendas adjudicadas:*\n${itemsListText}\n💰 *Total a transferir:* $${totalAmount.toLocaleString('es-CL')}\n\n`;
      } else {
        summaryHeader += `ℹ️ *Tu registro fue confirmado para @${buyer.tiktok_username}.*\n\n`;
      }

      return `${summaryHeader}${N_AND_N_PAYMENT_INFO}`;
    }

    // 5. Si no se pudo asociar a ninguna adjudicación ni comprador existente
    return `👋 *¡Hola! Bienvenida/o a N&N Ropa Americana 🛒*\n\n` +
           `Para validar tu compra y enviarte tus datos de pago, por favor indícanos tu **usuario de TikTok** (ej: *@maria28*) o el **código de tu prenda** (ej: *#D001*).\n\n` +
           `🌐 *Catálogo disponible:* https://nn.lukeapp.cl\n` +
           `📍 *Ubicación:* Valparaíso, Chile 🌊`;
  }
}

export const whatsappBotService = new WhatsAppBotService();
