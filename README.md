# 🎮 LUKE LIVE — Game Show Engine TikTok con Ruleta & Trivia

Plataforma interactiva de entretenimiento en tiempo real para **TikTok LIVE**, optimizada para formato **vertical 9:16 (1080x1920)** con ruleta de 18 categorías, trivias comunitarias de [quiz.lukeapp.cl](https://quiz.lukeapp.cl), podio de clasificación en directo y persistencia en Supabase.

---

## 🌟 Características Principales

### 📺 1. Pantalla Broadcast para OBS Studio (`/obs`)
- **Diseño Glassmorphism 9:16**: Lienzo transparente (`background: transparent`) diseñado para superponerse como *Browser Source* en OBS justo encima del video/webcam del presentador.
- **Podio Ticker Permanente (`🥇 🥈 🥉`)**: Ticker en tiempo real ubicado debajo del encabezado principal mostrando siempre a los líderes de la ronda.
- **Tarjeta Anuncio `CATEGORY_INTRO`**: Muestra la categoría ganadora con una **Lluvia de Ideas de 4 subtemas** antes de iniciar las 10 preguntas.
- **Banner CTA de Conversión a Creadores**: Invita constantemente a la audiencia a crear sus trivias gratis con IA en [quiz.lukeapp.cl](https://quiz.lukeapp.cl).

### 🎰 2. Ruleta de 18 Categorías x 2 (36 Segmentos Multicolor)
- **Animación Fluida Semicircular**: Giros de 6s con curva de aceleración física Ease-Out + 2.5s de result overlay (8.5s total).
- **Control por Chat (`/girar`)**: Al finalizar la pregunta 10 (Ronda Completada), el campeón de la tabla recibe la orden neón para girar la ruleta escribiendo `/girar` en el chat de TikTok.

### ⏱️ 3. Tiempos Adaptativos & Ventana Anti-Lag (3s)
- **Temporizador Visual**: 20s para responder + 5s para mostrar respuesta correcta + 5s de podio intermediario.
- **Ventana de Gracia Post-Pregunta (3s)**: Absorbe el retraso RTMP de 3-5s de TikTok LIVE permitiendo registrar respuestas tardías sin errores de sincronía.

### 🔄 4. Reinicio de Puntajes por Ronda
- Al iniciar una nueva ronda de 10 preguntas (tras girar la ruleta o cargar un quiz), todos los puntajes de los espectadores se reinician automáticamente a **0 pts**.

### 🧠 5. Banco de 3 Quizzes Pre-construidos por Categoría (50+ Quizzes)
- Rotación secuencial local de **3 Quizzes temáticos detallados por cada una de las 18 categorías** (más de 500 preguntas reales) para garantizar cero repeticiones y **0% costo de API de IA** durante las transmisiones.

### 🗄️ 6. Conexión Supabase de Producción (`quiz.lukeapp.cl`)
- Conectado al esquema `quiz` en `api-oracle.lukeapp.cl`.
- Carga e inserta quizzes aprobados en la tabla `quiz.quizzes` para que queden jugables tanto en el en vivo como en la plataforma web.

---

## 🌐 URLs del Sistema

### 🖥️ Producción Cloud (Oracle Cloud VM — HTTPS)
| Pantalla | URL | Descripción |
| :--- | :--- | :--- |
| 📺 **OBS Broadcast Overlay** | `https://tiktok.lukeapp.cl/obs` | Fuente de Navegador para OBS Studio (Fondo transparente). |
| 🎮 **Panel Presentador + Simulador** | `https://tiktok.lukeapp.cl/simulator` | Control manual del show, simulador de respuestas y selector de quizzes. |
| 🎰 **Ruleta Overlay Independiente** | `https://tiktok.lukeapp.cl/overlay` | Transparencia de la ruleta para escenas dedicadas. |

### 💻 Entorno Local (Desarrollo — Puerto 3000)
| Pantalla | URL |
| :--- | :--- |
| 📺 OBS Broadcast | `http://localhost:3000/obs` |
| 🎮 Simulador / Panel | `http://localhost:3000/simulator` |
| 🎰 Ruleta Overlay | `http://localhost:3000/overlay` |

---

## 🛠️ Comandos de Instalación & Ejecución

```bash
# 1. Instalar dependencias
npm install

# 2. Modo desarrollo (Hot reload)
npm run dev

# 3. Compilación de producción
npm run build

# 4. Iniciar servidor en producción
npm start
```

---

## 🏗️ Arquitectura de Despliegue DevOps

- **Servidor Cloud**: Oracle Cloud VM ARM64 (`vm-free-arm-01` — Ubuntu 24.04).
- **Gestor de Procesos**: PM2 (`tiktok-live` — Puerto 3007).
- **Túnel de Red**: Cloudflare Tunnel (`oracle-vm-tunnel`).
- **Control de Versiones**: Git local sincronizado (`C:\Github\TikTokLive-Ruleta`).

---

© 2026 **LukeAPP Ecosystem** — Todos los derechos reservados.
