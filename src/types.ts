export type EventType = 'CHAT_MESSAGE' | 'PLAYER_JOIN' | 'PLAYER_ANSWER' | 'SPIN_REQUEST' | 'UNKNOWN_COMMAND' | 'SYSTEM';

export interface TikTokRawChat {
  uniqueId: string;
  userId: string;
  comment: string;
  createTime?: number | string;
  nickname?: string;
  profilePictureUrl?: string;
}

export type LiveSessionState = 'WAITING' | 'QUESTION' | 'RESULT' | 'LEADERBOARD' | 'SPINNING' | 'FINISHED';

export interface QuizQuestion {
  id: string;
  text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
  image_url?: string;
  keyword?: string;
}

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  questions: QuizQuestion[];
}

export interface Player {
  username: string;
  score: number;
  lastAnswer?: 'A' | 'B' | 'C' | 'D';
  lastAnswerTime?: string;
  lastActiveTime: string;
  totalCorrect: number;
  canSpin: boolean;
}

export type LiveEvent =
  | {
      type: 'CHAT_MESSAGE';
      username: string;
      message: string;
      timestamp: string;
      source: 'tiktok' | 'simulator';
    }
  | {
      type: 'PLAYER_JOIN';
      username: string;
      source: 'tiktok' | 'simulator';
      timestamp: string;
    }
  | {
      type: 'PLAYER_ANSWER';
      username: string;
      answer: 'A' | 'B' | 'C' | 'D';
      source: 'tiktok' | 'simulator';
      timestamp: string;
    }
  | {
      type: 'SPIN_REQUEST';
      username: string;
      source: 'tiktok' | 'simulator';
      timestamp: string;
    };

export interface InternalGameEvent {
  id: string;
  type: EventType;
  source: 'tiktok' | 'web' | 'simulator' | 'system';
  userId: string;
  username: string;
  rawMessage: string;
  timestamp: string;
  answer?: 'A' | 'B' | 'C' | 'D';
  spinResult?: {
    number: number;
    animalName: string;
    animalEmoji: string;
  };
}

export interface LiveStatus {
  connected: boolean;
  username: string;
  statusText: string;
  lastConnectedAt?: string;
}

export interface LiveSession {
  id: string;
  status: LiveSessionState;
  source: 'tiktok' | 'simulator';
  game_type: 'quiz_roulette';
  current_state: LiveSessionState;
  current_question_index: number;
  current_question: QuizQuestion | null;
  players: Player[];
  leaderboard: Player[];
  created_at: string;
  timeRemaining?: number;
}
