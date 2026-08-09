import { Quiz } from '../types';

export const MOCK_QUIZ: Quiz = {
  id: 'luke_live_master_catalog',
  title: 'LUKE LIVE — Desafío Multitemático',
  description: 'Catálogo oficial de trivias dinámicas para TikTok LIVE',
  questions: [
    // 🎬 Cine y Series
    {
      id: 'q_cine_1',
      text: '¿Cómo se llama el planeta natal de Superman?',
      option_a: 'Krypton',
      option_b: 'Tatooine',
      option_c: 'Asgard',
      option_d: 'Pandora',
      correct_option: 'A',
      keyword: 'Cine y Series'
    },
    {
      id: 'q_cine_2',
      text: '¿Qué actor interpreta a Jack Sparrow en Piratas del Caribe?',
      option_a: 'Brad Pitt',
      option_b: 'Johnny Depp',
      option_c: 'Tom Cruise',
      option_d: 'Will Smith',
      correct_option: 'B',
      keyword: 'Cine y Series'
    },
    {
      id: 'q_cine_3',
      text: '¿En qué año se estrenó la película Avatar de James Cameron?',
      option_a: '2005',
      option_b: '2009',
      option_c: '2012',
      option_d: '2015',
      correct_option: 'B',
      keyword: 'Cine y Series'
    },

    // ⚽ Deportes
    {
      id: 'q_dep_1',
      text: '¿Qué país ganó el Mundial de Fútbol en Qatar 2022?',
      option_a: 'Francia',
      option_b: 'Brasil',
      option_c: 'Argentina',
      option_d: 'Croacia',
      correct_option: 'C',
      keyword: 'Deportes'
    },
    {
      id: 'q_dep_2',
      text: '¿Cuántos jugadores de campo tiene un equipo de fútbol?',
      option_a: '9',
      option_b: '10',
      option_c: '11',
      option_d: '12',
      correct_option: 'C',
      keyword: 'Deportes'
    },
    {
      id: 'q_dep_3',
      text: '¿En qué deporte destaca la estrella LeBron James?',
      option_a: 'Fútbol Americano',
      option_b: 'Básquetbol',
      option_c: 'Béisbol',
      option_d: 'Tenis',
      correct_option: 'B',
      keyword: 'Deportes'
    },

    // 🌍 Geografía
    {
      id: 'q_geo_1',
      text: '¿Cuál es el río más largo del mundo?',
      option_a: 'Nilo',
      option_b: 'Amazonas',
      option_c: 'Misisipi',
      option_d: 'Danubio',
      correct_option: 'B',
      keyword: 'Geografía'
    },
    {
      id: 'q_geo_2',
      text: '¿En qué país se encuentran las famosas Pirámides de Guiza?',
      option_a: 'México',
      option_b: 'Egipto',
      option_c: 'Grecia',
      option_d: 'Perú',
      correct_option: 'B',
      keyword: 'Geografía'
    },
    {
      id: 'q_geo_3',
      text: '¿Cuál es la capital de Japón?',
      option_a: 'Tokio',
      option_b: 'Kioto',
      option_c: 'Osaka',
      option_d: 'Seoul',
      correct_option: 'A',
      keyword: 'Geografía'
    },

    // 🎵 Música
    {
      id: 'q_mus_1',
      text: '¿Quién es conocido mundialmente como el Rey del Pop?',
      option_a: 'Elvis Presley',
      option_b: 'Michael Jackson',
      option_c: 'Prince',
      option_d: 'Freddie Mercury',
      correct_option: 'B',
      keyword: 'Música'
    },
    {
      id: 'q_mus_2',
      text: '¿De qué país es originaria la banda legendaria The Beatles?',
      option_a: 'Estados Unidos',
      option_b: 'Reino Unido',
      option_c: 'Australia',
      option_d: 'Irlanda',
      correct_option: 'B',
      keyword: 'Música'
    },

    // 🎮 Videojuegos
    {
      id: 'q_game_1',
      text: '¿Quién es el hermano fontanero de Mario en Nintendo?',
      option_a: 'Wario',
      option_b: 'Yoshi',
      option_c: 'Luigi',
      option_d: 'Toad',
      correct_option: 'C',
      keyword: 'Videojuegos'
    },
    {
      id: 'q_game_2',
      text: '¿Cuál es el bloque principal de construcción en Minecraft?',
      option_a: 'Tierra',
      option_b: 'Piedra',
      option_c: 'Madera',
      option_d: 'Diamante',
      correct_option: 'A',
      keyword: 'Videojuegos'
    },

    // 🚀 Ciencia
    {
      id: 'q_cienc_1',
      text: '¿Cuál es el planeta más cercano al Sol?',
      option_a: 'Venus',
      option_b: 'Mercurio',
      option_c: 'Marte',
      option_d: 'Tierra',
      correct_option: 'B',
      keyword: 'Ciencia'
    },
    {
      id: 'q_cienc_2',
      text: '¿Cuál es la velocidad aproximada de la luz?',
      option_a: '300.000 km/s',
      option_b: '150.000 km/s',
      option_c: '500.000 km/s',
      option_d: '1.000.000 km/s',
      correct_option: 'A',
      keyword: 'Ciencia'
    },

    // 🍕 Gastronomía
    {
      id: 'q_gastro_1',
      text: '¿De qué país es originaria la Pizza tradicional?',
      option_a: 'Francia',
      option_b: 'Italia',
      option_c: 'España',
      option_d: 'Grecia',
      correct_option: 'B',
      keyword: 'Gastronomía'
    },

    // 📺 Anime & Manga
    {
      id: 'q_anime_1',
      text: '¿Cómo se llama el protagonista del anime Dragon Ball?',
      option_a: 'Vegeta',
      option_b: 'Goku',
      option_c: 'Gohan',
      option_d: 'Piccolo',
      correct_option: 'B',
      keyword: 'Anime & Manga'
    }
  ]
};

export const MARIO_QUIZ: Quiz = {
  id: 'quiz_mario_bros',
  title: '🍄 Super Mario Bros Trivia Especial',
  description: 'Demuestra todo lo que sabes sobre el reino Champiñón',
  questions: [
    {
      id: 'm1',
      text: '¿Quién es el hermano fontanero de Mario?',
      option_a: 'Wario',
      option_b: 'Yoshi',
      option_c: 'Luigi',
      option_d: 'Toad',
      correct_option: 'C',
      keyword: 'Videojuegos'
    },
    {
      id: 'm2',
      text: '¿Cómo se llama el dinosaurio verde amigo de Mario?',
      option_a: 'Donkey Kong',
      option_b: 'Yoshi',
      option_c: 'Koopa',
      option_d: 'Rex',
      correct_option: 'B',
      keyword: 'Videojuegos'
    },
    {
      id: 'm3',
      text: '¿Cómo se llama la princesa del Reino Champiñón?',
      option_a: 'Zelda',
      option_b: 'Daisy',
      option_c: 'Peach',
      option_d: 'Rosalina',
      correct_option: 'C',
      keyword: 'Videojuegos'
    },
    {
      id: 'm4',
      text: '¿Quién es el villano tortuga gigante archienemigo de Mario?',
      option_a: 'Bowser',
      option_b: 'Ganondorf',
      option_c: 'King Boo',
      option_d: 'Kamek',
      correct_option: 'A',
      keyword: 'Videojuegos'
    },
    {
      id: 'm5',
      text: '¿Qué objeto hace crecer de tamaño a Mario?',
      option_a: 'Estrella',
      option_b: 'Flor de Fuego',
      option_c: 'Hongo Rojo',
      option_d: 'Moneda',
      correct_option: 'C',
      keyword: 'Videojuegos'
    },
    {
      id: 'm6',
      text: '¿Qué otorga la Estrella Dorada al tocarla?',
      option_a: 'Volar',
      option_b: 'Invencibilidad',
      option_c: 'Más Vidas',
      option_d: 'Disparar Fuego',
      correct_option: 'B',
      keyword: 'Videojuegos'
    },
    {
      id: 'm7',
      text: '¿En qué año se lanzó el Super Mario Bros original?',
      option_a: '1980',
      option_b: '1985',
      option_c: '1990',
      option_d: '1995',
      correct_option: 'B',
      keyword: 'Videojuegos'
    },
    {
      id: 'm8',
      text: '¿Cómo se llama el rival amarillo codicioso de Mario?',
      option_a: 'Waluigi',
      option_b: 'Wario',
      option_c: 'Bowser Jr.',
      option_d: 'Kamek',
      correct_option: 'B',
      keyword: 'Videojuegos'
    },
    {
      id: 'm9',
      text: '¿En qué carreras compite Mario con sus amigos?',
      option_a: 'Mario Kart',
      option_b: 'Mario Party',
      option_c: 'Mario Tennis',
      option_d: 'Mario Golf',
      correct_option: 'A',
      keyword: 'Videojuegos'
    },
    {
      id: 'm10',
      text: '¿De qué empresa japonesa es la franquicia Mario Bros?',
      option_a: 'Sega',
      option_b: 'Sony',
      option_c: 'Nintendo',
      option_d: 'Capcom',
      correct_option: 'C',
      keyword: 'Videojuegos'
    }
  ]
};
