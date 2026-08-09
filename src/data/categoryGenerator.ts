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
  'Quiz Comunidad': {
    name: 'Quiz Comunidad',
    emoji: '🎨',
    ideas: ['🐉 Dragon Ball Z', '🍕 Cocina Chilena', '🏎️ Marcas de Autos', '⚽ Copa Mundial']
  }
};

export function generateCategoryQuiz(category: string): Quiz {
  const cleanCat = category.trim();

  const categoryTemplates: Record<string, any[]> = {
    'Relámpago': [
      { text: '¿Cuánto es 2 + 2 x 2?', a: '8', b: '6', c: '4', d: '2', correct: 'B' },
      { text: '¿Cuál es la capital de Chile?', a: 'Valparaíso', b: 'Santiago', c: 'Concepción', d: 'La Serena', correct: 'B' },
      { text: '¿De qué color es el cielo despejado?', a: 'Verde', b: 'Azul', c: 'Rojo', d: 'Amarillo', correct: 'B' },
      { text: '¿Cuántos días tiene una semana?', a: '5', b: '7', c: '10', d: '12', correct: 'B' },
      { text: '¿Cuál es el océano más grande del planeta?', a: 'Atlántico', b: 'Pacífico', c: 'Índico', d: 'Ártico', correct: 'B' }
    ],
    'Doble Puntaje': [
      { text: '⭐ [DOBLE PUNTAJE] ¿Qué gas es el más abundante en la atmósfera terrestre?', a: 'Oxígeno', b: 'Nitrógeno', c: 'Dióxido de Carbono', d: 'Hidrógeno', correct: 'B' },
      { text: '⭐ [DOBLE PUNTAJE] ¿En qué año cayó el Muro de Berlín?', a: '1979', b: '1989', c: '1999', d: '2001', correct: 'B' },
      { text: '⭐ [DOBLE PUNTAJE] ¿Qué elemento químico tiene el símbolo químico Au?', a: 'Plata', b: 'Oro', c: 'Cobre', d: 'Aluminio', correct: 'B' },
      { text: '⭐ [DOBLE PUNTAJE] ¿Cuál es el planeta más frío del sistema solar?', a: 'Marte', b: 'Urano', c: 'Neptuno', d: 'Plutón', correct: 'B' },
      { text: '⭐ [DOBLE PUNTAJE] ¿Quién escribió la célebre obra Don Quijote de la Mancha?', a: 'Gabriel García Márquez', b: 'Miguel de Cervantes', c: 'Pablo Neruda', d: 'William Shakespeare', correct: 'B' }
    ],
    'Cine y Series': [
      { text: '¿Quién dirigió la película Titanic y Avatar?', a: 'Steven Spielberg', b: 'James Cameron', c: 'Christopher Nolan', d: 'Quentin Tarantino', correct: 'B' },
      { text: '¿Qué superhéroe es conocido como el Caballero de la Noche?', a: 'Superman', b: 'Batman', c: 'Iron Man', d: 'Spider-Man', correct: 'B' },
      { text: '¿En qué película aparece el villano Darth Vader?', a: 'Star Trek', b: 'Star Wars', c: 'Dune', d: 'Matrix', correct: 'B' },
      { text: '¿Cómo se llama la muñeca poseída en el universo El Conjuro?', a: 'Annabelle', b: 'Chucky', c: 'Megan', d: 'Tiffany', correct: 'A' },
      { text: '¿Qué saga de películas cuenta con los hobbits Frodo y Sam?', a: 'Harry Potter', b: 'El Señor de los Anillos', c: 'Narnia', d: 'Eragon', correct: 'B' }
    ],
    'Deportes': [
      { text: '¿Cuántos minutos dura un partido oficial de fútbol?', a: '80', b: '90', c: '100', d: '120', correct: 'B' },
      { text: '¿Qué tenista suizo ha ganado 20 títulos de Grand Slam?', a: 'Rafael Nadal', b: 'Roger Federer', c: 'Novak Djokovic', d: 'Carlos Alcaraz', correct: 'B' },
      { text: '¿En qué ciudad se celebraron los Juegos Olímpicos de 2024?', a: 'Tokio', b: 'París', c: 'Londres', d: 'Los Ángeles', correct: 'B' },
      { text: '¿Cuántos puntos vale un ensayo en el Rugby?', a: '3', b: '5', c: '6', d: '7', correct: 'B' },
      { text: '¿Qué corredor jamaicano es el más rápido de la historia?', a: 'Usain Bolt', b: 'Tyson Gay', c: 'Yohan Blake', d: 'Justin Gatlin', correct: 'A' }
    ],
    'Música': [
      { text: '¿Quién canta la famosa canción Thriller?', a: 'Prince', b: 'Michael Jackson', c: 'Stevie Wonder', d: 'Bruno Mars', correct: 'B' },
      { text: '¿Qué instrumento musical tiene 88 teclas entre blancas y negras?', a: 'Órgano', b: 'Piano', c: 'Acordeón', d: 'Sintetizador', correct: 'B' },
      { text: '¿De qué país es originaria la cantante Shakira?', a: 'México', b: 'Colombia', c: 'España', d: 'Argentina', correct: 'B' },
      { text: '¿Qué grupo de rock lanzó el álbum The Dark Side of the Moon?', a: 'Queen', b: 'Pink Floyd', c: 'Led Zeppelin', d: 'The Rolling Stones', correct: 'B' },
      { text: '¿Cómo se llama el festival de música más famoso celebrado en Chile?', a: 'Lollapalooza', b: 'Viña del Mar', c: 'Coachella', d: 'Rock in Rio', correct: 'B' }
    ],
    'Geografía': [
      { text: '¿Cuál es la capital de España?', a: 'Barcelona', b: 'Madrid', c: 'Sevilla', d: 'Valencia', correct: 'B' },
      { text: '¿En qué continente se encuentra el Desierto del Sahara?', a: 'Asia', b: 'África', c: 'América', d: 'Oceanía', correct: 'B' },
      { text: '¿Cuál es la montaña más alta del planeta Tierra?', a: 'K2', b: 'Everest', c: 'Aconcagua', d: 'Kilimanjaro', correct: 'B' },
      { text: '¿Qué país tiene la mayor población del mundo en 2026?', a: 'China', b: 'India', c: 'Estados Unidos', d: 'Indonesia', correct: 'B' },
      { text: '¿Cuál es la capital de Italia?', a: 'Milán', b: 'Roma', c: 'Venecia', d: 'Florencia', correct: 'B' }
    ],
    'Videojuegos': [
      { text: '¿Qué animal es Sonic en la franquicia de SEGA?', a: 'Zorro', b: 'Erizo', c: 'Mapache', d: 'Conejo', correct: 'B' },
      { text: '¿Cuál es el juego de batalla campal desarrollado por Epic Games?', a: 'PUBG', b: 'Fortnite', c: 'Free Fire', d: 'Apex Legends', correct: 'B' },
      { text: '¿Cómo se llama la princesa de The Legend of Zelda?', a: 'Peach', b: 'Zelda', c: 'Samus', d: 'Midna', correct: 'B' },
      { text: '¿En qué juego debes sobrevivir construyendo bloques?', a: 'Roblox', b: 'Minecraft', c: 'Terraria', d: 'Lego', correct: 'B' },
      { text: '¿Qué cazador de tesoros protagoniza la saga Uncharted?', a: 'Lara Croft', b: 'Nathan Drake', c: 'Joel', d: 'Kratos', correct: 'B' }
    ],
    'Automovilismo': [
      { text: '¿Qué marca italiana de autos deportivos utiliza el escudo del caballo encabritado?', a: 'Lamborghini', b: 'Ferrari', c: 'Maserati', d: 'Alfa Romeo', correct: 'B' },
      { text: '¿Qué piloto británico tiene 7 títulos mundiales de Fórmula 1?', a: 'Max Verstappen', b: 'Lewis Hamilton', c: 'Sebastian Vettel', d: 'Fernando Alonso', correct: 'B' },
      { text: '¿Qué fabricante produce los famosos modelos Mustang y F-150?', a: 'Chevrolet', b: 'Ford', c: 'Dodge', d: 'Toyota', correct: 'B' },
      { text: '¿En qué país se celebra la mítica carrera de resistencia 24 Horas de Le Mans?', a: 'Alemania', b: 'Francia', c: 'Italia', d: 'Inglaterra', correct: 'B' },
      { text: '¿Qué marca alemana tiene un emblema con 4 aros entrelazados?', a: 'BMW', b: 'Audi', c: 'Porsche', d: 'Mercedes-Benz', correct: 'B' }
    ],
    'Anime & Manga': [
      { text: '¿Cuál es la raza alienígena del guerrero Goku en Dragon Ball?', a: 'Namekuseijin', b: 'Saiyajin', c: 'Kryptoniano', d: 'Humano', correct: 'B' },
      { text: '¿Qué objeto busca encontrar Monkey D. Luffy en One Piece?', a: 'Dragon Balls', b: 'One Piece', c: 'Death Note', d: 'Chakra', correct: 'B' },
      { text: '¿Cómo se llama la aldea oculta donde vive Naruto Uzumaki?', a: 'Aldea de la Arena', b: 'Aldea de la Hoja', c: 'Aldea de la Niebla', d: 'Aldea de la Nube', correct: 'B' },
      { text: '¿Quién es el compañero ratón eléctrico de Ash Ketchum en Pokémon?', a: 'Charmander', b: 'Pikachu', c: 'Squirtle', d: 'Eevee', correct: 'B' },
      { text: '¿Cómo se llama el cuaderno sobrenatural que causa la muerte al escribir un nombre?', a: 'Grimorio', b: 'Death Note', c: 'Necronomicón', d: 'Darkhold', correct: 'B' }
    ],
    'Naturaleza': [
      { text: '¿Cuál es el mamífero más grande de la Tierra?', a: 'Elefante Africano', b: 'Ballena Azul', c: 'Tiburón Ballena', d: 'Jirafa', correct: 'B' },
      { text: '¿Qué animal es conocido popularmente como el Rey de la Selva?', a: 'Tigre', b: 'León', c: 'Jaguar', d: 'Gorila', correct: 'B' },
      { text: '¿Cómo se llama el proceso por el cual las plantas producen oxígeno?', a: 'Respiración', b: 'Fotosíntesis', c: 'Evaporación', d: 'Germinación', correct: 'B' },
      { text: '¿Cuál es el felino terrestre más rápido del mundo?', a: 'Leopardo', b: 'Guepardo', c: 'Puma', d: 'Gato Montés', correct: 'B' },
      { text: '¿Qué animal australiano lleva a sus crías dentro de una bolsa marsupial?', a: 'Koala', b: 'Canguro', c: 'Wombat', d: 'Ornitorrinco', correct: 'B' }
    ],
    'Superhéroes': [
      { text: '¿Cuál es la verdadera identidad secreta de Spider-Man?', a: 'Bruce Wayne', b: 'Peter Parker', c: 'Clark Kent', d: 'Tony Stark', correct: 'B' },
      { text: '¿De qué metal ficticio indestructible está fabricado el escudo del Capitán América?', a: 'Adamantium', b: 'Vibranium', c: 'Mithril', d: 'Kryptonita', correct: 'B' },
      { text: '¿De qué planeta proviene Superman?', a: 'Asgard', b: 'Krypton', c: 'Titan', d: 'Xandar', correct: 'B' },
      { text: '¿Quién es el multimillonario que utiliza la armadura tecnológica de Iron Man?', a: 'Steve Rogers', b: 'Tony Stark', c: 'Bruce Banner', d: 'Peter Quill', correct: 'B' },
      { text: '¿Cómo se llama la princesa amazona conocida como Mujer Maravilla?', a: 'Kara', b: 'Diana Prince', c: 'Selina', d: 'Natasha', correct: 'B' }
    ]
  };

  const pool = categoryTemplates[cleanCat] || [
    { text: '¿Cuál es el planeta más cercano al Sol?', a: 'Venus', b: 'Mercurio', c: 'Marte', d: 'Tierra', correct: 'B' },
    { text: '¿En qué siglo Cristóbal Colón llegó a América?', a: 'Siglo XIV', b: 'Siglo XV (1492)', c: 'Siglo XVI', d: 'Siglo XVII', correct: 'B' },
    { text: '¿Cuál es el océano más extenso del planeta?', a: 'Atlántico', b: 'Pacífico', c: 'Índico', d: 'Ártico', correct: 'B' },
    { text: '¿Cuántos lados tiene un hexágono?', a: '5', b: '6', c: '7', d: '8', correct: 'B' },
    { text: '¿Qué país inventó la Pizza moderna?', a: 'Grecia', b: 'Italia', c: 'Francia', d: 'España', correct: 'B' }
  ];

  return {
    id: `gen_${cleanCat.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
    title: `Quiz de ${cleanCat}`,
    description: `Trivia oficial de ${cleanCat} generada para TikTok LIVE`,
    questions: pool.map((item, idx) => ({
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
