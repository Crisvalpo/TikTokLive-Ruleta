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

const MENU_REPLY = `👋 *¡Hola! Bienvenida/o a N&N Ropa Americana 🛒*

Por favor indica la opción que necesitas:

1️⃣ **Quieres información** (Estado de Live, catálogo, bolsa y envíos)
2️⃣ **Te adjudicaste algún producto** (Escribe el número o código de tu prenda, ej: *#D001* o *101*)`;

export class WhatsAppBotService {
  /**
   * Genera la respuesta dinámica de información general y estado del Live.
   */
  public async getInfoReply(): Promise<string> {
    let liveStatusHeader = '';

    try {
      const activeLive = await supabaseService.getActiveLiveSession();
      if (activeLive && activeLive.title) {
        liveStatusHeader = 
          `🔴 *¡ESTAMOS EN TRANSMISIÓN EN VIVO AHORA MISMO!*\n` +
          `📺 *Jornada:* ${activeLive.title}\n` +
          `🎥 *Únete a la transmisión en TikTok:* https://www.tiktok.com/@nn.ropa.americana5\n\n`;
      } else {
        liveStatusHeader = 
          `⚪ *En este momento no hay transmisión en vivo activa.*\n` +
          `Te invitamos a conectarte a nuestro próximo Live en TikTok: *@nn.ropa.americana5* 🎥✨\n\n`;
      }
    } catch (err) {
      liveStatusHeader = `🎥 *TikTok Live:* @nn.ropa.americana5\n\n`;
    }

    return `${liveStatusHeader}ℹ️ *Información Oficial N&N Ropa Americana 🛒*

🌐 *Catálogo Oficial 24/7:* https://nn.lukeapp.cl
📍 *Ubicación:* Valparaíso, Chile 🌊

🛍️ *¿Cómo funciona la Bolsa y Adjudicación?*
• **Apertura de Bolsa:** Al adjudicarte o comprar tu primera prenda en el Live (diciendo *YO* o con la oferta ganadora), se abre automáticamente tu **Bolsa de Compras** personal.
• **Adjudicación:** Cada prenda posee un código único (ej: *#D001* o *101*). Al adjudicártela, la prenda queda reservada a tu nombre.
• **Tiempo Límite de Abono:** Cuentas con un plazo máximo de **10 minutos** para confirmar tu abono/transferencia antes de que la prenda sea reasignada.

🚚 *Envíos a todo Chile:* Miércoles y Domingos.
• **Paket** (Santiago y Valparaíso): $3.500 (se paga junto al pedido)
• **Blue Express**: Envío por pagar (se cancela al recibir)

Si te adjudicaste o compraste una prenda en el Live, responde con la opción **2** o escribe el **número/código de tu prenda** (ej: *#D001* o *101*).`;
  }

  /**
   * Procesador principal de mensajes entrantes de WhatsApp para clientes/compradores.
   * La LLAVE PRINCIPAL es el CÓDIGO DE PRENDA.
   */
  public async handleCustomerMessage(
    cleanPhone: string,
    incomingText: string,
    pushName: string,
    engines?: { saleEngine?: any; interactiveEngine?: any }
  ): Promise<string> {
    const text = (incomingText || '').trim();
    const cleanPhoneDigits = cleanPhone.replace(/[^0-9]/g, '');

    // 1. ¿El usuario eligió la Opción 1 (Información)?
    if (/^(1|1\.|opcion\s*1|opción\s*1|informacion|información|info)$/i.test(text)) {
      return await this.getInfoReply();
    }

    // 2. ¿El usuario eligió la Opción 2 sin incluir el código aún?
    if (/^(2|2\.|opcion\s*2|opción\s*2|adjudique|adjudiqué|compre|compré)$/i.test(text)) {
      return `👕 *Adjudicación de Prenda N&N*\n\nPor favor indícanos el **número o código de la prenda** que te adjudicaste en la transmisión (ej: *#V003*, *14* o *#D001*).`;
    }

    // 3. Detectar si el usuario envió su nombre de usuario de TikTok (ej: @emily_isidora o "soy emily_isidora")
    let extractedUsername: string | null = null;
    const userMatch = text.match(/(?:@|usuario\s*|soy\s+)([A-Za-z0-9_.-]{3,30})\b/i);
    if (userMatch && userMatch[1]) {
      const uCandidate = userMatch[1].toLowerCase().replace(/^@/, '');
      const commonWords = ['ropa', 'americana', 'hola', 'buenas', 'informacion', 'adjudique', 'compre', 'datos'];
      if (!commonWords.includes(uCandidate)) {
        extractedUsername = uCandidate;
      }
    }

    // 4. Extraer el CÓDIGO DE PRENDA (Llave principal) del mensaje
    let extractedCode: string | null = null;
    const codeMatch = text.match(/(?:#|código|codigo|prenda|numero|número|opcion\s*2\s*|2\s+)?([A-Za-z0-9]{1,10})\b/i);

    if (codeMatch && codeMatch[1]) {
      const candidate = codeMatch[1].toUpperCase();
      const nonCodeWords = ['HOLA', 'BUENAS', 'INFO', 'DATOS', 'TIKTOK', 'GRACIAS', 'SALUDOS', 'QUIERO', 'VENTA', 'PRENDA', 'CODIGO', 'NUMERO'];
      if (!nonCodeWords.includes(candidate)) {
        extractedCode = candidate;
      }
    }

    // 5. Verificar si el teléfono ya está asociado a un comprador registrado
    let buyer = await supabaseService.getBuyerByPhone(cleanPhoneDigits);

    // 6. Si detectamos un usuario de TikTok, asociar si no tenía teléfono
    if (!buyer && extractedUsername) {
      const userBuyer = await supabaseService.getBuyerByUsername(extractedUsername);
      if (userBuyer) {
        if (!userBuyer.phone) {
          console.log(`🔐 [BOT VERIFICACIÓN] Vinculando teléfono +${cleanPhoneDigits} al usuario @${userBuyer.tiktok_username} detectado por mensaje`);
          await supabaseService.updateBuyer(userBuyer.id, { phone: cleanPhoneDigits });
          userBuyer.phone = cleanPhoneDigits;
        }
        buyer = userBuyer;
      }
    }

    // 7. Si se proporciona un CÓDIGO DE PRENDA, buscar en memoria del Live (activeReservations / salesHistory) y en Supabase
    let matchedItemInfo: { productCode: string; productTitle: string; price: number; username: string } | null = null;

    if (extractedCode) {
      const cleanCode = extractedCode.replace(/^#/, '');

      // A) Búsqueda en memoria de saleEngine (modo venta directa en vivo)
      if (engines?.saleEngine) {
        const session = engines.saleEngine.getSession();
        const resMatch = (session.activeReservations || []).find((r: any) => 
          r.productCode?.toUpperCase() === cleanCode || 
          r.productCode?.toUpperCase().replace(/^V0*/, '') === cleanCode.replace(/^V0*/, '')
        );
        if (resMatch) {
          matchedItemInfo = {
            productCode: resMatch.productCode,
            productTitle: `Prenda #${resMatch.productCode}`,
            price: resMatch.price,
            username: resMatch.username
          };
        } else {
          const histMatch = (session.salesHistory || []).find((h: any) => 
            h.productCode?.toUpperCase() === cleanCode || 
            h.productCode?.toUpperCase().replace(/^V0*/, '') === cleanCode.replace(/^V0*/, '')
          );
          if (histMatch) {
            matchedItemInfo = {
              productCode: histMatch.productCode,
              productTitle: histMatch.productTitle || `Prenda #${histMatch.productCode}`,
              price: histMatch.price,
              username: histMatch.username
            };
          }
        }
      }

      // B) Búsqueda en memoria de interactiveEngine (modo ruleta / subasta en vivo)
      if (!matchedItemInfo && engines?.interactiveEngine) {
        const iSession = engines.interactiveEngine.getSession();
        const histMatch = (iSession.salesHistory || []).find((h: any) => 
          h.productCode?.toUpperCase() === cleanCode || 
          h.productCode?.toUpperCase().replace(/^V0*/, '') === cleanCode.replace(/^V0*/, '')
        );
        if (histMatch) {
          matchedItemInfo = {
            productCode: histMatch.productCode,
            productTitle: histMatch.productTitle || `Prenda #${histMatch.productCode}`,
            price: histMatch.price,
            username: histMatch.username
          };
        }
      }

      // Si se encontró en la sesión en vivo en memoria:
      if (matchedItemInfo) {
        const liveBuyer = await supabaseService.getOrCreateBuyer(matchedItemInfo.username);
        if (liveBuyer) {
          if (!liveBuyer.phone) {
            console.log(`🔐 [BOT VERIFICACIÓN] Vinculando teléfono +${cleanPhoneDigits} a @${liveBuyer.tiktok_username} por adjudicación en vivo de #${matchedItemInfo.productCode}`);
            await supabaseService.updateBuyer(liveBuyer.id, { phone: cleanPhoneDigits });
            liveBuyer.phone = cleanPhoneDigits;
          }
          buyer = liveBuyer;
        }
      } else {
        // C) Búsqueda en Supabase DB
        const saleResult = await supabaseService.getPendingSaleByProductCode(cleanCode);
        if (saleResult && saleResult.buyer) {
          const targetBuyer = saleResult.buyer;

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
            console.log(`🔐 [BOT VERIFICACIÓN] Vinculando teléfono +${cleanPhoneDigits} al comprador @${targetBuyer.tiktok_username} por la prenda #${cleanCode}`);
            await supabaseService.updateBuyer(targetBuyer.id, { phone: cleanPhoneDigits });
            targetBuyer.phone = cleanPhoneDigits;
          }

          buyer = targetBuyer;
        }
      }
    }

    // 8. Si el comprador fue verificado (ya sea por su teléfono, username o código)
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
      } else if (matchedItemInfo) {
        totalAmount = matchedItemInfo.price;
        itemsListText = `• #${matchedItemInfo.productCode} - ${matchedItemInfo.productTitle} ($${matchedItemInfo.price.toLocaleString('es-CL')})`;
      }

      let urgencyBanner = `⏳ *¡URGENCIA — TIEMPO DE RESERVA (10 MINUTOS)!*\n` +
                          `Tienes *10 minutos* para enviar tu comprobante de transferencia y asegurar tu bolsa. De lo contrario, tu prenda volverá a estar disponible para el próximo comprador en la transmisión. ⚡\n\n`;

      let summaryHeader = `✅ *Adjudicación Confirmada para:* @${buyer.tiktok_username}\n\n`;
      if (itemsListText) {
        summaryHeader += `🛒 *Tus prendas:* \n${itemsListText}\n💰 *Total a transferir:* $${totalAmount.toLocaleString('es-CL')}\n\n`;
      } else {
        summaryHeader += `ℹ️ *Registro verificado para @${buyer.tiktok_username}.*\n\n`;
      }

      return `${urgencyBanner}${summaryHeader}${N_AND_N_PAYMENT_INFO}`;
    }

    // 9. Si el usuario ingresó un código pero no se encontró ninguna prenda ni usuario
    if (extractedCode) {
      return `⚠️ *Prenda no encontrada*\n\n` +
             `No encontramos una prenda pendiente con el código *#${extractedCode}*.\n\n` +
             `Si te la adjudicaste recién en el Live de TikTok:\n` +
             `1️⃣ Asegúrate de enviar tu usuario de TikTok (ej: *@tu_usuario*).\n` +
             `2️⃣ O confirma el número de la prenda exacto con la vendedora en la transmisión. 💬`;
    }

    // 10. Si no coincide ningún código ni teléfono registrado, mostrar el menú interactivo 1 / 2
    return MENU_REPLY;
  }
}

export const whatsappBotService = new WhatsAppBotService();
