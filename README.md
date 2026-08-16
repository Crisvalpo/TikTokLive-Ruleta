# 👗 LUKE LIVE SUBASTAS v2.0.0 — Plataforma de Subastas en Vivo

Plataforma profesional de **Subastas en Vivo para TikTok LIVE**, con gestión de inventario de bodega, catálogo público de productos con soporte multi-imagen, control de compradores con abono, motor de pujas en tiempo real con **protección Anti-Sniper**, monitor de picking y exportación de adjudicaciones a WhatsApp.

---

## 🌟 Módulos y Características Principales

### 🛒 1. Catálogo Público (`/catalog` o `/`)
- **Showroom Web de Productos**: Accesible libremente sin necesidad de clave de acceso.
- **Filtros Facetados**: Búsqueda predictiva en tiempo real por código de etiqueta, personaje, franquicia, talla y rango de precio.
- **Modal con Carrusel de Fotografías**: Visualización ampliada de cada prenda con múltiples fotos.
- **Integración con WhatsApp**: Enlace directo para consultar o reservar prendas mediante mensaje pre-formateado.

### 📦 2. Módulo de Bodega & Picking (`/warehouse`)
- **Alta Express de Inventario**: Registro rápido de productos con código de etiqueta física, título, tipo (disfraz, accesorio, prenda), personaje, franquicia, talla, precio base y **ubicación física en bodega** (ej: *Percha A3*, *Caja 12-B*).
- **Monitor de Picking en Tiempo Real**: Lista de prendas adjudicadas en vivo con actualización automática vía WebSockets para que el equipo de empaque prepare los pedidos de inmediato.

### 👗 3. Panel de la Animadora / Vendedora (`/interactive`)
- **Búsqueda e Importación desde Supabase**: Búsqueda directa en la base de datos de bodega con importación a la cola de subastas en 1 clic.
- **Control de Rondas de Subasta (45s)**: Temporizador regresivo, control de ofertas líderes, pausa/reanudación y avance automático.
- **Gestión de Compradores Autorizados**: Validación y aprobación previa de espectadores con abono ($5.000 CLP).
- **Resumen y Exportación de Adjudicaciones**: Cálculo automático de KPIs en vivo (total prendas vendidas y monto recaudado) con botón para **Copiar Resumen para WhatsApp**.

### ⚡ 4. Mecanismo Anti-Sniper (+10s)
- **Extensión Automática de Tiempo**: Si entra una puja válida en los últimos 5 segundos del cronómetro, el temporizador se extiende automáticamente **+10 segundos** (máximo 3 extensiones por ronda).
- **Alerta Animada en OBS**: Banner de advertencia amarillo en tiempo real para mantener la emoción en la transmisión.

### 📺 5. Overlay OBS Studio (`/obs-interactive`)
- **Diseño Transparente 9:16 (Vertical)**: Optimizado para TikTok LIVE Studio u OBS Studio.
- **Timer Circular con Código de Colores**: Indicador dinámico de tiempo restante (Verde ➔ Amarillo ➔ Rojo) con desglose de puja más alta e identificador del comprador líder.

### 🗄️ 6. Persistencia en Supabase (`esquema subastas`)
- Conectado a la base de datos PostgreSQL self-hosted en `https://api-oracle.lukeapp.cl` bajo el esquema **`subastas`**:
  - `subastas.products` — Catálogo e inventario de prendas.
  - `subastas.product_images` — Fotografías de productos con orden de visualización.
  - `subastas.buyers` — Compradores registrados y estado de su abono.
  - `subastas.sales` — Registro histórico de adjudicaciones.
  - `subastas.tiktok_events` — Auditoría completa de comentarios y pujas del chat de TikTok.

---

## 🌐 URLs Oficiales del Sistema (Dominio `.cl`)

### 🖥️ Producción Cloud (Lukeserver — HTTPS)

> **Importante**: El único dominio y subdominio oficial para esta plataforma es **`tiktok.lukeapp.cl`**.

| Módulo | URL HTTPS | Acceso |
| :--- | :--- | :--- |
| 🛒 **Catálogo Público** | `https://tiktok.lukeapp.cl/` (o `/catalog`) | Público |
| 📦 **Módulo Bodega & Picking** | `https://tiktok.lukeapp.cl/warehouse?key=luke2026` | Privado (`key=luke2026`) |
| 👗 **Panel Animadora** | `https://tiktok.lukeapp.cl/interactive?key=luke2026` | Privado (`key=luke2026`) |
| 📺 **Overlay OBS (Subastas)** | `https://tiktok.lukeapp.cl/obs-interactive?key=luke2026` | Privado (`key=luke2026`) |
| 🎮 **Simulador Web (Pruebas)** | `https://tiktok.lukeapp.cl/simulator?key=luke2026` | Privado (`key=luke2026`) |

---

## 🛠️ Comandos de Instalación & Ejecución

```bash
# 1. Instalar dependencias
npm install

# 2. Modo desarrollo con tsx watch (Puerto 3007)
npm run dev

# 3. Compilación de producción (dist/ + copiar public)
npm run build

# 4. Iniciar servidor compilado en producción
npm start

# 5. Ejecutar suite de pruebas del motor de subastas y Supabase
npx tsx scripts/test_subastas_engine.ts
```

---

## 🏗️ Arquitectura DevOps & Servidores

- **Servidor Web / Backend**: Linux Ubuntu (`lukeserver` — Puerto 3007).
- **Gestor de Procesos**: PM2 (`luke-live-interactive` — ID 11).
- **Base de Datos & Storage**: Oracle Cloud ARM64 (`api-oracle.lukeapp.cl` — Esquema PostgreSQL `subastas`).
- **Túnel de Red**: Cloudflare Tunnel (`oracle-vm-tunnel`).
- **Dominio Único**: `https://tiktok.lukeapp.cl`.

---

© 2026 **LukeAPP Ecosystem** — Todos los derechos reservados.
