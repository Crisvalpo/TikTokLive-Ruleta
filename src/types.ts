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
  numericValue?: number;
  spinResult?: {
    number: number;
    animalName: string;
    animalEmoji: string;
  };
}

export interface ProductItem {
  id: string;
  code: string;
  title: string;
  startingPrice: number;
  durationSeconds: number;
  imageUrl?: string;
}

export interface BidEvent {
  username: string;
  amount: number;
  timestamp: string;
  source: 'tiktok' | 'simulator' | 'system';
}

export interface MysteryBox {
  boxNumber: number;
  opened: boolean;
  openedBy?: string;
  isWinner: boolean;
}

export interface TiedPlayer {
  username: string;
  bidAmount: number;
  chosenBox?: number;
}

export type InteractiveSessionState = 'IDLE' | 'ROUND_ACTIVE' | 'WINNER_ANNOUNCED' | 'NO_BID_FINISHED' | 'PAUSED' | 'TIE_BREAKER';

export interface PendingApproval {
  username: string;
  attemptedBid: number;
  timestamp: string;
}

export interface WinnerRecord {
  id: string;
  productCode: string;
  productTitle: string;
  username: string;
  amount: number;
  timestamp: string;
  viaTieBreaker?: boolean;
  winningBoxNumber?: number;
}

export interface InteractiveSession {
  id: string;
  state: InteractiveSessionState;
  queue: ProductItem[];
  currentProductIndex: number;
  activeProduct: ProductItem | null;
  timeRemaining: number;
  currentHighestBid: number;
  currentLeader: {
    username: string;
    amount: number;
    timestamp: string;
  } | null;
  interestedPlayersCount: number;
  recentBids: BidEvent[];
  autoAdvance: boolean;
  winner: {
    username: string;
    amount: number;
    productTitle: string;
    productCode: string;
    viaTieBreaker?: boolean;
    winningBoxNumber?: number;
  } | null;
  winnersHistory: WinnerRecord[];
  tiedPlayers: TiedPlayer[];
  mysteryBoxes: MysteryBox[];
  approvedBidders: string[];
  pendingApprovals: PendingApproval[];
  requireApproval: boolean;
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

