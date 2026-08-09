import { TikTokLiveConnection } from 'tiktok-live-connector';
import { EventHandler } from '../events/handler';
import { LiveStatus } from '../types';

export class TikTokService {
  private tiktokUsername: string;
  private connection: any = null;
  private isConnected: boolean = false;
  private statusText: string = 'DESCONECTADO';
  private eventHandler: EventHandler;

  constructor(username: string) {
    this.tiktokUsername = username;
    this.eventHandler = EventHandler.getInstance();
  }

  public getStatus(): LiveStatus {
    return {
      connected: this.isConnected,
      username: this.tiktokUsername,
      statusText: this.statusText
    };
  }

  public setUsername(newUsername: string) {
    this.tiktokUsername = newUsername;
    if (this.isConnected) {
      this.disconnect();
    }
  }

  public connect(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.tiktokUsername) {
        console.warn('⚠️ No se especificó un TIKTOK_USERNAME en .env');
        this.statusText = 'SIN USUARIO CONFIGURADO';
        return resolve(false);
      }

      console.log(`🔌 Conectando al TikTok LIVE de @${this.tiktokUsername}...`);
      this.statusText = 'CONECTANDO...';

      try {
        this.connection = new TikTokLiveConnection(this.tiktokUsername, {
          processInitialData: false,
          enableExtendedGiftInfo: false
        });

        this.connection.connect().then((state: any) => {
          this.isConnected = true;
          this.statusText = `CONECTADO (Room ID: ${state.roomId || 'OK'})`;
          console.log(`🟢 TIKTOK LIVE CONECTADO EXITOSAMENTE a @${this.tiktokUsername} (Room: ${state.roomId})`);
          resolve(true);
        }).catch((err: any) => {
          this.isConnected = false;
          this.statusText = `ERROR DE CONEXIÓN (${err.message || 'Sin en vivo activo'})`;
          console.warn(`🔴 No se pudo conectar al LIVE de @${this.tiktokUsername}: ${err.message || 'El usuario no está en vivo'}`);
          console.log('💡 Tip: Puedes usar el panel de monitoreo web para simular comentarios en tiempo real.');
          resolve(false);
        });

        // Escuchar comentarios del chat de TikTok LIVE
        this.connection.on('chat', (data: any) => {
          const username = data.uniqueId || data.nickname || data.user?.uniqueId || data.user?.nickname || data.userDetails?.uniqueId || data.userDetails?.nickname || data.sender?.uniqueId || 'usuario';
          const userId = data.userId || data.user?.userId || data.user?.id || data.sender?.userId || `id_${Date.now()}`;
          const comment = data.comment || data.text || data.content || '';

          // Ignorar eventos vacíos si no traen comentario
          if (!comment) return;

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
          this.statusText = 'DESCONECTADO DEL LIVE';
          console.log(`🔴 Desconectado del TikTok LIVE de @${this.tiktokUsername}`);
        });

        this.connection.on('error', (err: any) => {
          console.error(`⚠️ Error en conexión TikTok LIVE:`, err.message || err);
        });

      } catch (err: any) {
        this.isConnected = false;
        this.statusText = `ERROR CRÍTICO (${err.message || err})`;
        console.error('❌ Error inicializando WebcastPushConnection:', err);
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
