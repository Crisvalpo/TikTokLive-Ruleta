import { Quiz } from '../types';

export interface CategoryBrainstorm {
  name: string;
  emoji: string;
  ideas: string[];
}

export const CATEGORY_BRAINSTORMS: Record<string, CategoryBrainstorm> = {
  'Cine y Series': {
    name: 'Cine y Series',
    emoji: '🎬',
    ideas: ['🦸 Marvel & Vengadores', '🚀 Star Wars & Galaxias', '🍿 Animadas & Pixar', '🧙‍♂️ Harry Potter & Magia']
  },
  'Deportes': {
    name: 'Deportes',
    emoji: '⚽',
    ideas: ['🏆 Mundial de Fútbol', '🏀 NBA & Básquetbol', '🏎️ Fórmula 1', '🎾 Tenis de Elite']
  },
  'Música': {
    name: 'Música',
    emoji: '🎵',
    ideas: ['👑 Rey del Pop & Leyendas', '🎸 Rock Clásico', '💃 Reggaetón & Urbano', '🎤 K-Pop Mundial']
  },
  'Geografía': {
    name: 'Geografía',
    emoji: '🌍',
    ideas: ['📍 Capitales del Mundo', '🏔️ Montañas & Ríos', '🏜️ Maravillas Naturales', '🗺️ Banderas del Mundo']
  },
  'Videojuegos': {
    name: 'Videojuegos',
    emoji: '🎮',
    ideas: ['🍄 Super Mario Bros', '⛏️ Minecraft & Roblox', '🗡️ Zelda & RPGs', '🔫 Shooter & Fortnite']
  },
  'Ciencia': {
    name: 'Ciencia',
    emoji: '🚀',
    ideas: ['🌌 Planetas & Espacio', '🧬 Biología & Cuerpo', '⚡ Física & Inventos', '🧪 Química Curiosa']
  },
  'Relámpago': {
    name: 'Relámpago',
    emoji: '⚡',
    ideas: ['🧮 Cálculo Exprés', '🏁 Velocidad de Respuesta', '🔥 Cultura General Ultra Rápida', '⏱️ Desafío bajo presión']
  },
  'Doble Puntaje': {
    name: 'Doble Puntaje',
    emoji: '⭐',
    ideas: ['💎 Preguntas Legendarias', '🔥 Doble Recompensa (200 pts)', '🧠 Trivia de Alto Nivel', '🎯 Desafío de Titanes']
  },
  'Automovilismo': {
    name: 'Automovilismo',
    emoji: '🏎️',
    ideas: ['🏎️ Fórmula 1 & Pilotos', '🚗 Marcas de Lujo & Deportivos', '🏁 Rally & Velocidad', '⚙️ Motores & Caballos de Fuerza']
  },
  'Anime & Manga': {
    name: 'Anime & Manga',
    emoji: '📺',
    ideas: ['🐉 Dragon Ball Z & Super', '🍥 Naruto & Ninja', '🏴‍☠️ One Piece & Piratas', '⚡ Pokémon & Entrenadores']
  },
  'Naturaleza': {
    name: 'Naturaleza',
    emoji: '🦁',
    ideas: ['🦁 Reino Animal', '🌊 Océanos & Criaturas', '🌿 Selva Amazonica', '🦅 Aves & Depredadores']
  },
  'Superhéroes': {
    name: 'Superhéroes',
    emoji: '🦸',
    ideas: ['🦇 Batman & Gotham', '🕸️ Spider-Man & Villanos', '🛡️ Avengers & Marvel', '⚡ Flash & Justice League']
  },
  'Gastronomía': {
    name: 'Gastronomía',
    emoji: '🍕',
    ideas: ['🇨🇱 Cocina Chilena & Tradicional', '🍕 Pizza & Pasta Italiana', '🌮 Tacos & Sabor Mexicano', '🍣 Sushi & Cocina Asiática']
  },
  'Historia': {
    name: 'Historia',
    emoji: '📜',
    ideas: ['🏛️ Imperio Romano', '🔺 Antiguo Egipto & Pirámides', '⚔️ Edad Media & Caballeros', '🌎 Descubrimiento de América']
  },
  'Arte & Cultura': {
    name: 'Arte & Cultura',
    emoji: '🎭',
    ideas: ['🎨 Pintores Famosos (Da Vinci)', '📖 Literatura Universal', '🗿 Esculturas & Museos', '🎼 Música Clásica']
  },
  'Tecnología': {
    name: 'Tecnología',
    emoji: '📱',
    ideas: ['🤖 Inteligencia Artificial', '📱 Smartphones & Gadgets', '🌐 Historia de Internet', '💻 Programadores & Software']
  },
  'Trivia Curiosa': {
    name: 'Trivia Curiosa',
    emoji: '🧠',
    ideas: ['🏆 Récords Mundiales', '💡 Mitos & Verdades', '🔮 Datos Sorprendentes', '🧪 Curiosidades']
  },
  'Quiz Comunidad': {
    name: 'Quiz Comunidad',
    emoji: '🎨',
    ideas: ['🐉 Dragon Ball Z', '🍕 Cocina Chilena', '🏎️ Marcas de Autos', '⚽ Copa Mundial']
  }
};

// Contador de rotación para entregar 3 Quizzes distintos por categoría
const categoryRotationMap: Record<string, number> = {};

export function generateCategoryQuiz(category: string): Quiz {
  const cleanCat = category.trim();

  // Banco de 3 Quizzes completos por categoría
  const categoryQuizPools: Record<string, Array<{ title: string; questions: any[] }>> = {
    'Cine y Series': [
      {
        title: 'Cine & Grandes Películas',
        questions: [
          { text: '¿Quién dirigió la película Titanic y Avatar?', a: 'Steven Spielberg', b: 'James Cameron', c: 'Christopher Nolan', d: 'Quentin Tarantino', correct: 'B' },
          { text: '¿Qué superhéroe es conocido como el Caballero de la Noche?', a: 'Superman', b: 'Batman', c: 'Iron Man', d: 'Spider-Man', correct: 'B' },
          { text: '¿En qué película aparece el villano Darth Vader?', a: 'Star Trek', b: 'Star Wars', c: 'Dune', d: 'Matrix', correct: 'B' },
          { text: '¿Cómo se llama la muñeca poseída en el universo El Conjuro?', a: 'Annabelle', b: 'Chucky', c: 'Megan', d: 'Tiffany', correct: 'A' },
          { text: '¿Qué saga de películas cuenta con los hobbits Frodo y Sam?', a: 'Harry Potter', b: 'El Señor de los Anillos', c: 'Narnia', d: 'Eragon', correct: 'B' }
        ]
      },
      {
        title: 'Universo Marvel & Vengadores',
        questions: [
          { text: '¿De qué metal está hecho el escudo del Capitán América?', a: 'Adamantium', b: 'Vibranium', c: 'Kryptonita', d: 'Titanio', correct: 'B' },
          { text: '¿Quién es el actor que interpreta a Iron Man (Tony Stark)?', a: 'Chris Evans', b: 'Robert Downey Jr.', c: 'Chris Hemsworth', d: 'Mark Ruffalo', correct: 'B' },
          { text: '¿Cómo se llama el reino natal de Thor?', a: 'Wakanda', b: 'Asgard', c: 'Xandar', d: 'Titan', correct: 'B' },
          { text: '¿Qué villano recolecta las 6 Gemas del Infinito?', a: 'Loki', b: 'Thanos', c: 'Ultron', d: 'Kang', correct: 'B' },
          { text: '¿Cuál es el nombre del alter ego del Hombre Araña?', a: 'Miles Morales', b: 'Peter Parker', c: 'Gwen Stacy', d: 'Eddie Brock', correct: 'B' }
        ]
      },
      {
        title: 'Harry Potter & Magia',
        questions: [
          { text: '¿A qué casa de Hogwarts pertenece Harry Potter?', a: 'Slytherin', b: 'Gryffindor', c: 'Ravenclaw', d: 'Hufflepuff', correct: 'B' },
          { text: '¿Cómo se llama el mejor amigo pelirrojo de Harry Potter?', a: 'Neville Longbottom', b: 'Ron Weasley', c: 'Draco Malfoy', d: 'Cedric Diggory', correct: 'B' },
          { text: '¿Qué hechizo se utiliza para desarmar a un oponente?', a: 'Avada Kedavra', b: 'Expelliarmus', c: 'Lumos', d: 'Expecto Patronum', correct: 'B' },
          { text: '¿Quién es el director barbudo de Hogwarts?', a: 'Severus Snape', b: 'Albus Dumbledore', c: 'Hagrid', d: 'Remus Lupin', correct: 'B' },
          { text: '¿Qué criatura mágica guarda el Banco Gringotts?', a: 'Hipogrifo', b: 'Dragón', c: 'Basilisco', d: 'Centauro', correct: 'B' }
        ]
      }
    ],
    'Deportes': [
      {
        title: 'Fútbol Mundial & Copas',
        questions: [
          { text: '¿Cuántos minutos dura un partido oficial de fútbol?', a: '80', b: '90', c: '100', d: '120', correct: 'B' },
          { text: '¿Qué país ha ganado más Mundiales de Fútbol en la historia?', a: 'Alemania', b: 'Brasil', c: 'Argentina', d: 'Italia', correct: 'B' },
          { text: '¿En qué ciudad se celebraron los Juegos Olímpicos de 2024?', a: 'Tokio', b: 'París', c: 'Londres', d: 'Los Ángeles', correct: 'B' },
          { text: '¿Qué jugador de fútbol tiene el apodo de La Pulga?', a: 'Cristiano Ronaldo', b: 'Lionel Messi', c: 'Neymar Jr.', d: 'Kylian Mbappé', correct: 'B' },
          { text: '¿Cuántos jugadores por equipo entran a la cancha en el fútbol?', a: '10', b: '11', c: '12', d: '9', correct: 'B' }
        ]
      },
      {
        title: 'Básquetbol NBA & Tenis',
        questions: [
          { text: '¿Qué tenista suizo ha ganado 20 títulos de Grand Slam?', a: 'Rafael Nadal', b: 'Roger Federer', c: 'Novak Djokovic', d: 'Carlos Alcaraz', correct: 'B' },
          { text: '¿Qué número utilizaba Michael Jordan en los Chicago Bulls?', a: '8', b: '23', c: '24', d: '32', correct: 'B' },
          { text: '¿Cuántos puntos vale un tiro desde detrás de la línea lejana en la NBA?', a: '2', b: '3', c: '4', d: '1', correct: 'B' },
          { text: '¿En qué superficie se juega el torneo de tenis de Wimbledon?', a: 'Polvo de Ladrillo', b: 'Césped (Pasto)', c: 'Cemento', d: 'Sintética', correct: 'B' },
          { text: '¿Qué equipo de la NBA es famoso por sus camisetas amarillas y moradas?', a: 'Boston Celtics', b: 'Los Angeles Lakers', c: 'Golden State Warriors', d: 'Chicago Bulls', correct: 'B' }
        ]
      },
      {
        title: 'Deportes Extremos & Atletismo',
        questions: [
          { text: '¿Qué corredor jamaicano es el hombre más rápido de la historia?', a: 'Tyson Gay', b: 'Usain Bolt', c: 'Yohan Blake', d: 'Justin Gatlin', correct: 'B' },
          { text: '¿Cuántos kilómetros mide la carrera de una Maratón oficial?', a: '30 km', b: '42.195 km', c: '50 km', d: '21 km', correct: 'B' },
          { text: '¿Cuántos puntos vale un ensayo (try) en el Rugby?', a: '3', b: '5', c: '6', d: '7', correct: 'B' },
          { text: '¿En qué deporte se utiliza la expresión Strike o Chuzo?', a: 'Béisbol', b: 'Bowling (Bolos)', c: 'Golf', d: 'Billar', correct: 'B' },
          { text: '¿De qué color es la bandera que indica el fin de una carrera de autos?', a: 'Roja', b: 'A cuadros blanco y negro', c: 'Amarilla', d: 'Verde', correct: 'B' }
        ]
      }
    ],
    'Relámpago': [
      {
        title: 'Relámpago 1 — Cálculo & Velocidad',
        questions: [
          { text: '⚡ ¿Cuánto es 2 + 2 x 2?', a: '8', b: '6', c: '4', d: '2', correct: 'B' },
          { text: '⚡ ¿Cuál es la capital de Chile?', a: 'Valparaíso', b: 'Santiago', c: 'Concepción', d: 'La Serena', correct: 'B' },
          { text: '⚡ ¿De qué color es el cielo despejado?', a: 'Verde', b: 'Azul', c: 'Rojo', d: 'Amarillo', correct: 'B' },
          { text: '⚡ ¿Cuántos días tiene un año bisiesto?', a: '365', b: '366', c: '364', d: '360', correct: 'B' },
          { text: '⚡ ¿Cuál es el océano más grande del planeta?', a: 'Atlántico', b: 'Pacífico', c: 'Índico', d: 'Ártico', correct: 'B' }
        ]
      },
      {
        title: 'Relámpago 2 — Cultura Exprés',
        questions: [
          { text: '⚡ ¿Cuál es el resultado de 100 dividido entre 4?', a: '20', b: '25', c: '50', d: '30', correct: 'B' },
          { text: '⚡ ¿En qué país está la Torre Eiffel?', a: 'Italia', b: 'Francia', c: 'España', d: 'Alemania', correct: 'B' },
          { text: '⚡ ¿Cuántas patas tiene una araña común?', a: '6', b: '8', c: '10', d: '12', correct: 'B' },
          { text: '⚡ ¿De qué fruta se extrae el vino tradicional?', a: 'Manzana', b: 'Uva', c: 'Naranja', d: 'Pera', correct: 'B' },
          { text: '⚡ ¿Cuál es la moneda oficial de Estados Unidos?', a: 'Euro', b: 'Dólar', c: 'Yen', d: 'Libra', correct: 'B' }
        ]
      },
      {
        title: 'Relámpago 3 — Agilidad Mental',
        questions: [
          { text: '⚡ ¿Cuántos minutos hay en una hora completa?', a: '50', b: '60', c: '100', d: '90', correct: 'B' },
          { text: '⚡ ¿Cuál es el planeta donde vivimos?', a: 'Marte', b: 'Tierra', c: 'Júpiter', d: 'Venus', correct: 'B' },
          { text: '⚡ ¿Qué gas respiran principalmente los humanos para vivir?', a: 'Dióxido de Carbono', b: 'Oxígeno', c: 'Helio', d: 'Nitrógeno', correct: 'B' },
          { text: '⚡ ¿Cuál es el color de la mezcla entre azul y amarillo?', a: 'Morado', b: 'Verde', c: 'Naranja', d: 'Marrón', correct: 'B' },
          { text: '⚡ ¿Cuántos segundos tiene un minuto?', a: '30', b: '60', c: '100', d: '45', correct: 'B' }
        ]
      }
    ],
    'Música': [
      {
        title: 'Pop & Leyendas Musicales',
        questions: [
          { text: '¿Quién es conocido mundialmente como el Rey del Pop?', a: 'Prince', b: 'Michael Jackson', c: 'Elvis Presley', d: 'Stevie Wonder', correct: 'B' },
          { text: '¿De qué país es originaria la cantante Shakira?', a: 'México', b: 'Colombia', c: 'España', d: 'Argentina', correct: 'B' },
          { text: '¿Qué instrumento tiene 88 teclas entre blancas y negras?', a: 'Órgano', b: 'Piano', c: 'Acordeón', d: 'Sintetizador', correct: 'B' },
          { text: '¿Cómo se llama la famosa cantante de pop británica autora de Hello y Rolling in the Deep?', a: 'Taylor Swift', b: 'Adele', c: 'Rihanna', d: 'Dua Lipa', correct: 'B' },
          { text: '¿Qué festival de música famoso se realiza en la Quinta Vergara en Chile?', a: 'Lollapalooza', b: 'Festival de Viña del Mar', c: 'Coachella', d: 'Rock in Rio', correct: 'B' }
        ]
      },
      {
        title: 'Rock Clásico & Bandas Míticas',
        questions: [
          { text: '¿Qué grupo de rock británico lanzó el álbum The Dark Side of the Moon?', a: 'Queen', b: 'Pink Floyd', c: 'Led Zeppelin', d: 'The Beatles', correct: 'B' },
          { text: '¿Quién era el carismático vocalista principal de la banda Queen?', a: 'Mick Jagger', b: 'Freddie Mercury', c: 'Robert Plant', d: 'David Bowie', correct: 'B' },
          { text: '¿De qué ciudad inglesa provenía la mítica banda The Beatles?', a: 'Londres', b: 'Liverpool', c: 'Manchester', d: 'Birmingham', correct: 'B' },
          { text: '¿Qué instrumento de cuerdas tocaba Jimi Hendrix?', a: 'Bajo', b: 'Guitarra Eléctrica', c: 'Violín', d: 'Ukelele', correct: 'B' },
          { text: '¿Qué banda de hard rock canta Sweet Child O Mine?', a: 'AC/DC', b: 'Guns N Roses', c: 'Aerosmith', d: 'Metallica', correct: 'B' }
        ]
      },
      {
        title: 'Reggaetón & Urbano',
        questions: [
          { text: '¿Quién es llamado el Rey del Reggaetón y autor de Gasolina?', a: 'Don Omar', b: 'Daddy Yankee', c: 'Bad Bunny', d: 'Wisiny Yandel', correct: 'B' },
          { text: '¿De qué isla caribeña es oriundo el cantante Bad Bunny?', a: 'Cuba', b: 'Puerto Rico', c: 'República Dominicana', d: 'Jamaica', correct: 'B' },
          { text: '¿Cómo se llama el cantante colombiano apodado El Niño de Medellín?', a: 'Maluma', b: 'J Balvin', c: 'Feid', d: 'Karol G', correct: 'B' },
          { text: '¿Qué cantante urbana colombiana es conocida como La Bichota?', a: 'Rosalía', b: 'Karol G', c: 'Becky G', d: 'Natti Natasha', correct: 'B' },
          { text: '¿Qué tema musical rompió récords globales interpretado por Luis Fonsi y Daddy Yankee?', a: 'Despacito', b: 'Danza Kuduro', c: 'Baila Morena', d: 'Safaera', correct: 'A' }
        ]
      }
    ],
    'Geografía': [
      {
        title: 'Capitales del Mundo',
        questions: [
          { text: '¿Cuál es la capital de España?', a: 'Barcelona', b: 'Madrid', c: 'Sevilla', d: 'Valencia', correct: 'B' },
          { text: '¿Cuál es la capital de Italia?', a: 'Milán', b: 'Roma', c: 'Venecia', d: 'Florencia', correct: 'B' },
          { text: '¿Cuál es la capital de Francia?', a: 'Lyon', b: 'París', c: 'Marsella', d: 'Niza', correct: 'B' },
          { text: '¿Cuál es la capital de Japón?', a: 'Kioto', b: 'Tokio', c: 'Osaka', d: 'Hiroshima', correct: 'B' },
          { text: '¿Cuál es la capital de Argentina?', a: 'Córdoba', b: 'Buenos Aires', c: 'Mendoza', d: 'Rosario', correct: 'B' }
        ]
      },
      {
        title: 'Maravillas Naturales & Geografía',
        questions: [
          { text: '¿En qué continente se encuentra el Desierto del Sahara?', a: 'Asia', b: 'África', c: 'América', d: 'Oceanía', correct: 'B' },
          { text: '¿Cuál es la montaña más alta del planeta Tierra por encima del nivel del mar?', a: 'K2', b: 'Everest', c: 'Aconcagua', d: 'Kilimanjaro', correct: 'B' },
          { text: '¿Cuál es el río más largo y caudaloso del mundo?', a: 'Nilo', b: 'Amazonas', c: 'Misisipi', d: 'Yangtsé', correct: 'B' },
          { text: '¿En qué país de Sudamérica se encuentra la famosa selva del Amazonas en su mayoría?', a: 'Colombia', b: 'Brasil', c: 'Perú', d: 'Venezuela', correct: 'B' },
          { text: '¿Cuál es la montaña más alta de América de origen sudamericano?', a: 'Everest', b: 'Aconcagua', c: 'Ojos del Salado', d: 'Chimborazo', correct: 'B' }
        ]
      },
      {
        title: 'Banderas & Países',
        questions: [
          { text: '¿Qué país tiene la mayor población del mundo en 2026?', a: 'China', b: 'India', c: 'Estados Unidos', d: 'Indonesia', correct: 'B' },
          { text: '¿Qué país es famoso por su bandera roja con un sol naciente o círculo rojo en el centro?', a: 'China', b: 'Japón', c: 'Corea del Sur', d: 'Vietnam', correct: 'B' },
          { text: '¿Cuántas estrellas tiene la bandera nacional de Chile?', a: '3', b: '1', c: '50', d: '0', correct: 'B' },
          { text: '¿Qué país sudamericano no cuenta con salida al mar ni acceso oceánico junto con Bolivia?', a: 'Uruguay', b: 'Paraguay', c: 'Ecuador', d: 'Chile', correct: 'B' },
          { text: '¿Cuál es el país más grande del mundo en superficie territorial?', a: 'Canadá', b: 'Rusia', c: 'China', d: 'Estados Unidos', correct: 'B' }
        ]
      }
    ],
    'Videojuegos': [
      {
        title: 'Super Mario Bros & Nintendo',
        questions: [
          { text: '¿Qué profesión tiene Mario en los videojuegos de Nintendo?', a: 'Carpintero', b: 'Fontanero (Gasfiter)', c: 'Electricista', d: 'Mecánico', correct: 'B' },
          { text: '¿Cómo se llama el hermano de Mario que viste de verde?', a: 'Wario', b: 'Luigi', c: 'Waluigi', d: 'Yoshi', correct: 'B' },
          { text: '¿Cuál es el reino donde transcurren las aventuras principales de Mario?', a: 'Reino de Hyrule', b: 'Reino Champiñón', c: 'Kanto', d: 'Dreamland', correct: 'B' },
          { text: '¿Cómo se llama el villano dinosaurio con caparazón de pinchos que secuestra a la Princesa Peach?', a: 'Donkey Kong', b: 'Bowser', c: 'King Boo', d: 'Kamek', correct: 'B' },
          { text: '¿Qué animal es el fiel dinosaurio verde montura de Mario?', a: 'Koopa', b: 'Yoshi', c: 'Goomba', d: 'Toad', correct: 'B' }
        ]
      },
      {
        title: 'Minecraft, Roblox & Construcción',
        questions: [
          { text: '¿En qué videojuego debes sobrevivir extrayendo recursos y construyendo con bloques?', a: 'Roblox', b: 'Minecraft', c: 'Terraria', d: 'Lego', correct: 'B' },
          { text: '¿Cómo se llama la criatura verde sigilosa de Minecraft que explota cerca del jugador?', a: 'Enderman', b: 'Creeper', c: 'Zombie', d: 'Skeleton', correct: 'B' },
          { text: '¿Cuál es el material sintético o mineral más resistente para fabricar armaduras en Minecraft tradicional?', a: 'Hierro', b: 'Diamante / Netherita', c: 'Oro', d: 'Piedra', correct: 'B' },
          { text: '¿Cómo se llama la moneda oficial utilizada en la plataforma Roblox?', a: 'V-Bucks', b: 'Robux', c: 'Minecoins', d: 'Gems', correct: 'B' },
          { text: '¿Qué juego de batalla campal fue creado por Epic Games?', a: 'PUBG', b: 'Fortnite', c: 'Free Fire', d: 'Apex Legends', correct: 'B' }
        ]
      },
      {
        title: 'Zelda, PlayStation & Acción',
        questions: [
          { text: '¿Cómo se llama la princesa tutelar de la saga The Legend of Zelda?', a: 'Peach', b: 'Zelda', c: 'Samus', d: 'Midna', correct: 'B' },
          { text: '¿Cómo se llama el guerrero de gorro verde que protagoniza The Legend of Zelda?', a: 'Zelda', b: 'Link', c: 'Ganon', d: 'Tingle', correct: 'B' },
          { text: '¿Qué cazador de tesoros es el héroe principal de la saga Uncharted en PlayStation?', a: 'Lara Croft', b: 'Nathan Drake', c: 'Joel', d: 'Kratos', correct: 'B' },
          { text: '¿Qué dios es el implacable protagonista de la saga God of War?', a: 'Zeus', b: 'Kratos', c: 'Ares', d: 'Thor', correct: 'B' },
          { text: '¿Qué animal azul y veloz es la mascota icono de SEGA?', a: 'Fox', b: 'Sonic', c: 'Knuckles', d: 'Tails', correct: 'B' }
        ]
      }
    ]
  };

  const cleanCategoryName = cleanCat;
  const pools = categoryQuizPools[cleanCategoryName] || [
    {
      title: `Quiz de ${cleanCategoryName}`,
      questions: [
        { text: `¿Cuál es el planeta más cercano al Sol?`, a: 'Venus', b: 'Mercurio', c: 'Marte', d: 'Tierra', correct: 'B' },
        { text: `¿En qué siglo Cristóbal Colón llegó a América?`, a: 'Siglo XIV', b: 'Siglo XV (1492)', c: 'Siglo XVI', d: 'Siglo XVII', correct: 'B' },
        { text: `¿Cuál es el océano más extenso del planeta?`, a: 'Atlántico', b: 'Pacífico', c: 'Índico', d: 'Ártico', correct: 'B' },
        { text: `¿Cuántos lados tiene un hexágono perfecto?`, a: '5', b: '6', c: '7', d: '8', correct: 'B' },
        { text: `¿Qué país es el creador de la Pizza moderna?`, a: 'Grecia', b: 'Italia', c: 'Francia', d: 'España', correct: 'B' }
      ]
    }
  ];

  // Rotación del índice (0 -> 1 -> 2 -> 0...)
  const currentRotIndex = categoryRotationMap[cleanCategoryName] || 0;
  categoryRotationMap[cleanCategoryName] = (currentRotIndex + 1) % pools.length;

  const selectedPool = pools[currentRotIndex] || pools[0];

  return {
    id: `gen_${cleanCat.toLowerCase().replace(/\s+/g, '_')}_rot${currentRotIndex}_${Date.now()}`,
    title: selectedPool.title,
    description: `Trivia oficial de ${cleanCat} para TikTok LIVE`,
    questions: selectedPool.questions.map((item, idx) => ({
      id: `q_gen_${idx}_${Date.now()}`,
      text: item.text,
      option_a: item.a,
      option_b: item.b,
      option_c: item.c,
      option_d: item.d,
      correct_option: item.correct,
      keyword: cleanCat
    }))
  };
}
