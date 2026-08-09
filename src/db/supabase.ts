import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { InternalGameEvent } from '../types';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

export class SupabaseService {
  private supabase: any = null;
  private enabled: boolean = false;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (url && key) {
      try {
        this.supabase = createClient(url, key, { db: { schema: 'quiz' } });
        this.enabled = true;
        console.log('✅ Supabase Client inicializado para esquema "quiz" en https://api-oracle.lukeapp.cl');
      } catch (err) {
        console.warn('⚠️ Error al crear cliente Supabase:', err);
      }
    } else {
      console.log('ℹ️ Supabase no configurado en .env. Los eventos se procesarán localmente.');
    }
  }

  public async saveEvent(event: InternalGameEvent): Promise<boolean> {
    if (!this.enabled || !this.supabase) {
      return false;
    }

    try {
      const { error } = await this.supabase
        .from('tiktok_events')
        .insert({
          event_type: event.type,
          tiktok_user_id: event.userId,
          username: event.username,
          message: event.rawMessage,
          created_at: event.timestamp,
          raw_event: event
        });

      if (error) {
        console.error('❌ Error guardando evento en Supabase:', error.message);
        return false;
      }

      console.log(`💾 Evento [${event.type}] guardado en Supabase tiktok_events.`);
      return true;
    } catch (err: any) {
      console.error('❌ Excepción al insertar en Supabase:', err.message || err);
      return false;
    }
  }

  private playedQuestionIds: Set<string> = new Set();

  public async fetchLiveQuiz(category?: string): Promise<any | null> {
    if (!this.enabled || !this.supabase) return null;

    try {
      let query = this.supabase
        .schema('quiz')
        .from('quizzes')
        .select('*, questions(*)');

      if (category && category !== 'General') {
        query = query.ilike('title', `%${category}%`);
      }

      const { data, error } = await query.limit(20);
      if (error || !data || data.length === 0) return null;

      // Recolectar preguntas no jugadas recientemente de múltiples quizzes de la categoría
      const allQuestionsWithAuthor: any[] = [];
      const creatorsSet = new Set<string>();

      data.forEach((quiz: any) => {
        const handle = '@Cristian Luke';
        creatorsSet.add(handle);
        (quiz.questions || []).forEach((q: any) => {
          const qId = q.id || q.text;
          // Filtrar para NUNCA repetir preguntas jugadas recientemente en el directo
          if (!this.playedQuestionIds.has(qId)) {
            allQuestionsWithAuthor.push({
              ...q,
              creator_handle: handle,
              quiz_title: quiz.title
            });
          }
        });
      });

      // Si quedan menos de 5 preguntas no jugadas en esta categoría, devolver null para forzar generación fresca
      if (allQuestionsWithAuthor.length < 5) {
        console.log(`⚠️ Preguntas agotadas/recientes para "${category}". Forzando generación fresca...`);
        return null;
      }

      // Mezclado aleatorio de preguntas (Fisher-Yates Shuffle)
      for (let i = allQuestionsWithAuthor.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allQuestionsWithAuthor[i], allQuestionsWithAuthor[j]] = [allQuestionsWithAuthor[j], allQuestionsWithAuthor[i]];
      }

      // Seleccionar hasta 10 preguntas ensambladas de la comunidad y registrarlas en el historial
      const selectedQuestions = allQuestionsWithAuthor.slice(0, 10);
      selectedQuestions.forEach(q => this.playedQuestionIds.add(q.id || q.text));

      const authors = Array.from(creatorsSet).slice(0, 3).join(', ');

      return {
        id: `assembled_${Date.now()}`,
        title: `Ronda ${category || 'Trivia'}`,
        creator_handle: authors || '@Cristian Luke',
        questions: selectedQuestions.map((q: any) => ({
          id: q.id,
          text: q.text || q.question_text || q.prompt || '¿Pregunta Trivia?',
          option_a: q.option_a || 'A',
          option_b: q.option_b || 'B',
          option_c: q.option_c || 'C',
          option_d: q.option_d || 'D',
          correct_option: ((q.correct_option || 'A').toUpperCase()) as 'A' | 'B' | 'C' | 'D',
          keyword: q.keyword
        }))
      };
    } catch (err: any) {
      console.warn('⚠️ No se pudo obtener quiz de Supabase, usando catálogo local:', err.message || err);
      return null;
    }
  }

  public async saveGeneratedQuiz(quiz: any, category: string = 'General'): Promise<boolean> {
    if (!this.enabled || !this.supabase) return false;

    try {
      // 1. Insertar el quiz en la tabla `quizzes` (esquema `quiz`)
      const { data: quizData, error: quizErr } = await this.supabase
        .schema('quiz')
        .from('quizzes')
        .insert({
          title: quiz.title || `Quiz de ${category}`,
          description: quiz.description || `Quiz generado en TikTok LIVE`,
          visibility: 'public'
        })
        .select()
        .single();

      if (quizErr || !quizData) {
        console.error('❌ Error guardando quiz generado en Supabase:', quizErr?.message);
        return false;
      }

      // 2. Insertar las preguntas asociadas en `questions` (esquema `quiz`)
      const questionsToInsert = (quiz.questions || []).map((q: any, idx: number) => ({
        quiz_id: quizData.id,
        text: q.text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_option: q.correct_option,
        order_index: idx
      }));

      const { error: qErr } = await this.supabase
        .schema('quiz')
        .from('questions')
        .insert(questionsToInsert);

      if (qErr) {
        console.error('❌ Error guardando preguntas en Supabase:', qErr.message);
        return false;
      }

      console.log(`✅ Quiz "${quizData.title}" persistido en Supabase (disponible en quiz.lukeapp.cl)!`);
      return true;
    } catch (err: any) {
      console.error('❌ Excepción al persistir quiz en Supabase:', err.message || err);
      return false;
    }
  }

  public async fetchAllPublicQuizzes(): Promise<any[]> {
    if (!this.enabled || !this.supabase) return [];
    try {
      const { data, error } = await this.supabase
        .schema('quiz')
        .from('quizzes')
        .select('id, title, description, user_id, questions(id)');
      if (error || !data) {
        console.error('Error fetching quizzes:', error);
        return [];
      }
      return data.map((q: any) => ({
        id: q.id,
        title: q.title,
        category: q.title || 'General',
        creator_handle: '@Cristian Luke',
        question_count: (q.questions || []).length
      }));
    } catch (err: any) {
      console.error('Error obteniendo lista de quizzes:', err);
      return [];
    }
  }

  public async fetchQuizById(quizId: string): Promise<any | null> {
    if (!this.enabled || !this.supabase) return null;
    try {
      const { data, error } = await this.supabase
        .schema('quiz')
        .from('quizzes')
        .select('*, questions(*)')
        .eq('id', quizId)
        .single();
      if (error || !data) return null;
      return {
        id: data.id,
        title: data.title,
        creator_handle: data.creator_handle || '@comunidad',
        category: data.category || 'General',
        questions: (data.questions || []).map((q: any) => ({
          id: q.id,
          text: q.text || q.question_text || q.prompt || '¿Pregunta?',
          option_a: q.option_a || 'A',
          option_b: q.option_b || 'B',
          option_c: q.option_c || 'C',
          option_d: q.option_d || 'D',
          correct_option: ((q.correct_option || 'A').toUpperCase()) as 'A' | 'B' | 'C' | 'D',
          keyword: q.keyword || data.category
        }))
      };
    } catch (err: any) {
      console.error('Error cargando quiz por ID:', err);
      return null;
    }
  }
}

export const supabaseService = new SupabaseService();
