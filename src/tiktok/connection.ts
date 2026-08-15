import { TikTokLiveConnection } from 'tiktok-live-connector';
import { EventHandler } from '../events/handler';
import { LiveStatus } from '../types';

export class TikTokService {
  private tiktokUsername: string;
  private connection: any = null;
  private isConnected: boolean = false;
  private isConnecting: boolean = false;
  private statusText: string = 'DESCONECTADO';
  private eventHandler: EventHandler;
  private autoReconnectInterval: any = null;

  constructor(username: string) {
    this.tiktokUsername = (username || '').trim().replace(/^@/, '');
    this.eventHandler = EventHandler.getInstance();
    this.startAutoReconnectLoop();
  }

  public getStatus(): LiveStatus {
    return {
      connected: this.isConnected,
      username: this.tiktokUsername,
      statusText: this.statusText
    };
  }

  public setUsername(newUsername: string) {
    const clean = (newUsername || '').trim().replace(/^@/, '');
    if (clean && clean !== this.tiktokUsername) {
      console.log(`🔄 Cambiando usuario TikTok de @${this.tiktokUsername} a @${clean}...`);
      this.tiktokUsername = clean;
      this.disconnect();
      this.connect();
    }
  }

  private startAutoReconnectLoop() {
    if (this.autoReconnectInterval) return;
    this.autoReconnectInterval = setInterval(() => {
      if (!this.isConnected && !this.isConnecting && this.tiktokUsername) {
        console.log(`📡 Intentando conectar automáticamente al LIVE de @${this.tiktokUsername}...`);
        this.connect().catch(() => {});
      }
    }, 15000); // Reintentar cada 15s si está desconectado
  }

  public connect(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.tiktokUsername) {
        console.warn('⚠️ No se especificó un TIKTOK_USERNAME');
        this.statusText = 'SIN USUARIO CONFIGURADO';
        return resolve(false);
      }

      if (this.isConnecting) {
        return resolve(false);
      }

      this.isConnecting = true;
      console.log(`🔌 Buscando e intentando conectar al TikTok LIVE de @${this.tiktokUsername}...`);
      this.statusText = `CONECTANDO (@${this.tiktokUsername})...`;

      try {
        if (this.connection) {
          try { this.connection.disconnect(); } catch(e) {}
          this.connection = null;
        }

        this.connection = new TikTokLiveConnection(this.tiktokUsername, {
          processInitialData: false,
          enableExtendedGiftInfo: false
        });

        this.connection.on('error', (err: any) => {
          this.isConnecting = false;
          this.statusText = `ESPERANDO LIVE (@${this.tiktokUsername})`;
        });

        this.connection.connect().then((state: any) => {
          this.isConnected = true;
          this.isConnecting = false;
          this.statusText = `CONECTADO a @${this.tiktokUsername} (Room ID: ${state.roomId || 'OK'})`;
          console.log(`🟢 ¡TIKTOK LIVE CONECTADO EXITOSAMENTE! @${this.tiktokUsername} (Room: ${state.roomId})`);
          resolve(true);
        }).catch((err: any) => {
          this.isConnected = false;
          this.isConnecting = false;
          this.statusText = `ESPERANDO LIVE (@${this.tiktokUsername})`;
          console.log(`📡 Esperando que @${this.tiktokUsername} inicie transmisión LIVE en TikTok...`);
          resolve(false);
        });

        // Escuchar comentarios del chat de TikTok LIVE
        this.connection.on('chat', (data: any) => {
          const username = data.uniqueId || data.nickname || data.user?.uniqueId || data.user?.nickname || 'usuario';
          const userId = data.userId || data.user?.userId || `id_${Date.now()}`;
          const comment = data.comment || data.text || data.content || '';

          if (!comment) return;

          console.log(`💬 CHAT TIKTOK EN VIVO [@${username}]: "${comment}"`);

          this.eventHandler.handleTikTokChat({
            uniqueId: username,
            userId: userId,
            comment: comment,
            createTime: data.createTime,
            nickname: data.nickname || data.user?.nickname,
            profilePictureUrl: data.profilePictureUrl
          }, 'tiktok');
        });

        this.connection.on('disconnected', () => {
          this.isConnected = false;
          this.isConnecting = false;
          this.statusText = `DESCONECTADO DE @${this.tiktokUsername}`;
          console.log(`🔴 Desconectado del TikTok LIVE de @${this.tiktokUsername}`);
        });

      } catch (err: any) {
        this.isConnected = false;
        this.isConnecting = false;
        this.statusText = `ERROR EN CONEXIÓN`;
        console.error('❌ Error inicializando TikTokLiveConnection:', err);
        resolve(false);
      }
    });
  }

  public disconnect() {
    if (this.connection) {
      try {
        this.connection.disconnect();
      } catch (e) {
        // Ignorar
      }
      this.connection = null;
    }
    this.isConnected = false;
    this.statusText = 'DESCONECTADO MANUALMENTE';
  }

  public simulateComment(username: string, comment: string, userId?: string) {
    return this.eventHandler.handleTikTokChat({
      uniqueId: username || 'test_user',
      userId: userId || `sim_${Date.now()}`,
      comment: comment || '/girar',
      nickname: username
    }, 'simulator');
  }
}
