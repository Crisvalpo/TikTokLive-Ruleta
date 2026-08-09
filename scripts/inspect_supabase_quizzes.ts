import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.SUPABASE_URL || 'https://api-oracle.lukeapp.cl';
const key = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtaW1xbHlibXFpdm93c3NodGt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyOTEzNzEsImV4cCI6MjA4NDg2NzM3MX0.IaScUp4jmYwuX_0DXxv6RcPJTkJFlh0118w03nK_aqg';

const supabase = createClient(url, key);

async function inspectDatabase() {
  console.log(`🔎 Inspeccionando base de datos de Luke Quiz en ${url}...\n`);

  try {
    // 1. Consultar Quizzes
    const { data: quizzes, error: qErr } = await supabase
      .from('quizzes')
      .select('*, questions(*)');

    if (qErr) {
      console.error('❌ Error al consultar la tabla quizzes:', qErr.message);
      return;
    }

    console.log(`📊 TOTAL DE QUIZZES ENCONTRADOS: ${quizzes?.length || 0}\n`);

    if (quizzes && quizzes.length > 0) {
      quizzes.forEach((q, idx) => {
        const qCount = q.questions ? q.questions.length : 0;
        console.log(`  [Quiz #${idx + 1}] ID: ${q.id}`);
        console.log(`  📌 Título: "${q.title}"`);
        console.log(`  📂 Categoría: ${q.category || 'Sin categoría'}`);
        console.log(`  👤 Creador: ${q.creator_handle || q.user_id || 'Anónimo'}`);
        console.log(`  ❓ Preguntas asociadas: ${qCount}`);
        console.log(`  🌐 Habilitado para Live: ${q.is_public_for_live !== false ? 'SÍ' : 'NO'}`);
        console.log(`  --------------------------------------------------`);
      });
    } else {
      console.log('ℹ️ No se encontraron quizzes en la tabla quizzes todavía.');
    }

  } catch (err: any) {
    console.error('❌ Excepción al inspeccionar Supabase:', err.message || err);
  }
}

inspectDatabase();
