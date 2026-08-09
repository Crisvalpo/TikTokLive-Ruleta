# TikTok LIVE + Ruleta Interactiva (36 Segmentos) — MVP

Este proyecto es el MVP inicial para conectar un **TikTok LIVE en tiempo real** con un motor de juego (**Game Engine**) y una **Ruleta visual de 36 segmentos** optimizada para transmisiones en **OBS Studio**.

## 🚀 Arquitectura

```text
TikTok LIVE Chat
       ↓
TikTok Adapter (tiktok-live-connector)
       ↓
Event Handler / Parser (/girar → SPIN_REQUEST)
       ↓
Game Engine (Selección de animal 1-36 + Cooldown)
       ↓
┌──────────────────────┬──────────────────────┐
│                      │                      │
Supabase Database      WebSocket Server       Console Format
(tiktok_events)        (Dashboard & OBS)      (Muestra por consola)
```

## 🛠️ Instalación y Uso

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Configurar variables de entorno en `.env`:
   ```env
   TIKTOK_USERNAME=usuario_del_live
   PORT=3000
   SUPABASE_URL=https://api-oracle.lukeapp.cl
   SUPABASE_ANON_KEY=tu_anon_key
   ```

3. Ejecutar en modo desarrollo:
   ```bash
   npm run dev
   ```

4. Abrir en el navegador:
   - **Panel de Monitoreo**: `http://localhost:3000`
   - **Ruleta para OBS**: `http://localhost:3000/roulette`

## 🧪 Pruebas Automatizadas

Ejecutar la suite de prueba de parsers y simulaciones:
```bash
npm run test:sim
```
