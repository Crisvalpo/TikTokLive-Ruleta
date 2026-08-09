import { supabaseService } from '../src/db/supabase';
import { generateCategoryQuiz } from '../src/data/categoryGenerator';

const CATEGORIES_LIST = [
  'Cine y Series',
  'Deportes',
  'Música',
  'Geografía',
  'Videojuegos',
  'Relámpago',
  'Doble Puntaje',
  'Automovilismo',
  'Anime & Manga',
  'Naturaleza',
  'Superhéroes'
];

async function seedAll() {
  console.log('🚀 Sembrando Quizzes de Categorías en Supabase (quiz.lukeapp.cl)...');
  
  for (const cat of CATEGORIES_LIST) {
    // Subir 3 quizzes por categoría
    for (let rot = 0; rot < 3; rot++) {
      const quiz = generateCategoryQuiz(cat);
      console.log(`📤 Subiendo "${quiz.title}" (Categoría: ${cat})...`);
      const success = await supabaseService.saveGeneratedQuiz(quiz, cat);
      if (success) {
        console.log(`  ✅ Guardado en Supabase!`);
      } else {
        console.log(`  ⚠️ No se pudo guardar.`);
      }
    }
  }

  console.log('\n🎉 ¡PROCESO DE SIEMBRA COMPLETADO EN QUIZ.LUKEAPP.CL!');
  process.exit(0);
}

seedAll();
