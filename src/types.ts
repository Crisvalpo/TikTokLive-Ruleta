// ============================================================
// LUKE LIVE SUBASTAS — Tipos del Sistema
// ============================================================

// --- Tipos de Evento ---

export type EventType = 'CHAT_MESSAGE' | 'SYSTEM';

export interface TikTokRawChat {
  uniqueId: string;
  userId: string;
  comment: string;
  createTime?: number | string;
  nickname?: string;
  profilePictureUrl?: string;
}

export interface InternalGameEvent {
  id: string;
  type: EventType;
  source: 'tiktok' | 'web' | 'simulator' | 'system';
  userId: string;
  username: string;
  rawMessage: string;
  timestamp: string;
  numericValue?: number;
}

// --- Tipos de Inventario / Productos ---

export type ItemType = 'disfraz' | 'accesorio' | 'prenda';
export type ProductCondition = 'excelente' | 'bueno' | 'regular';
export type StockStatus = 'disponible' | 'en_subasta' | 'vendido' | 'reservado';

export interface Product {
  id: string;
  code: string;
  title: string;
  description?: string;
  item_type: ItemType;
  character?: string;
  franchise?: string;
  size?: string;
  condition: ProductCondition;
  base_price: number;
  warehouse_location?: string;
  stock_status: StockStatus;
  parent_product_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  storage_path?: string;
  display_order: number;
  caption?: string;
  created_at: string;
}

export interface ProductWithImages extends Product {
  images: ProductImage[];
  accessories?: Product[];
}

// --- Tipos de Compradores ---

export interface Buyer {
  id: string;
  tiktok_username: string;
  display_name?: string;
  phone?: string;
  email?: string;
  deposit_paid: boolean;
  deposit_amount: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface BuyerWithSales extends Buyer {
  sales: Sale[];
  total_spent: number;
}

// --- Tipos de Ventas / Adjudicaciones ---

export type SaleType = 'subasta' | 'combo' | 'directo';

export interface Sale {
  id: string;
  product_id: string;
  buyer_id: string;
  sale_price: number;
  sale_type: SaleType;
  via_tie_breaker: boolean;
  winning_box_number?: number;
  picked: boolean;
  picked_at?: string;
  created_at: string;
  // Relaciones cargadas
  product?: Product;
  buyer?: Buyer;
}

// --- Tipos del Motor de Subastas Interactivo ---

export interface ProductItem {
  id: string;
  code: string;
  title: string;
  startingPrice: number;
  durationSeconds: number;
  imageUrl?: string;
  images?: string[];
  size?: string;
  warehouseLocation?: string;
  supabaseProductId?: string;
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

export interface HeroBannerSlide {
  id: string;
  icon?: string;
  text: string;
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
  // Anti-sniper
  antiSniperExtensions: number;
  maxAntiSniperExtensions: number;
  // Configuración de Tarjeta OBS
  whatsappNumber: string;
  cardBgUrl: string;
  cardTransparentMode: boolean;
  cardOffsetY?: number;
  heroBannerSlides?: HeroBannerSlide[];
  heroBannerInterval?: number;
  // Bolsas y Reservas 10 min
  activeReservations?: ActiveReservation[];
  activeBags?: BuyerBag[];
}

export interface LiveStatus {
  connected: boolean;
  username: string;
  statusText: string;
  lastConnectedAt?: string;
}

// --- Bolsa de Compras y Reservas ---

export type BagStatus = 'ABIERTA_PENDIENTE_ABONO' | 'ABIERTA_ACTIVA' | 'CERRADA_PARA_ENVIO' | 'DESPACHADA';

export interface BuyerBag {
  id: string;
  buyer_id: string;
  tiktok_username?: string;
  whatsapp_phone?: string;
  status: BagStatus;
  deposit_paid: boolean;
  deposit_amount: number;
  reservation_expires_at?: string | null;
  reserved_product_id?: string | null;
  reserved_product_code?: string | null;
  total_accumulated: number;
  items_count: number;
  items?: Array<{
    id: string;
    product_code: string;
    product_title: string;
    sale_price: number;
    created_at: string;
  }>;
  created_at: string;
  updated_at: string;
}

export interface ActiveReservation {
  bagId: string;
  buyerId: string;
  username: string;
  productCode: string;
  productTitle: string;
  salePrice: number;
  expiresAt: string;
  secondsRemaining: number;
}

// --- Filtros de búsqueda ---

export interface ProductFilters {
  search?: string;
  item_type?: ItemType;
  franchise?: string;
  size?: string;
  stock_status?: StockStatus;
  condition?: ProductCondition;
  min_price?: number;
  max_price?: number;
  limit?: number;
  offset?: number;
}
