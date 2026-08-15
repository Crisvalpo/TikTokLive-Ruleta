import { TikTokRawChat, InternalGameEvent } from '../types';
import { parseCommand } from '../commands/parser';
import { EventEmitter } from 'events';

export class EventHandler extends EventEmitter {
  private static instance: EventHandler;

  private constructor() {
    super();
  }

  public static getInstance(): EventHandler {
    if (!EventHandler.instance) {
      EventHandler.instance = new EventHandler();
    }
    return EventHandler.instance;
  }

  public handleTikTokChat(data: TikTokRawChat, source: 'tiktok' | 'simulator' = 'tiktok'): InternalGameEvent {
    const username = data.uniqueId || data.nickname || 'anonymous';
    const userId = data.userId || `id_${Date.now()}`;
    const comment = data.comment || '';
    const now = new Date();
    
    const formattedDate = now.toISOString().replace('T', ' ').substring(0, 19);

    const parsed = parseCommand(comment);

    // Logging por consola
    console.log('\n--------------------------------');
    console.log('LUKE LIVE EVENT');
    console.log('--------------------------------');
    console.log(`User: @${username}`);
    console.log(`User ID: ${userId}`);
    console.log(`Comment: ${comment}`);
    console.log(`Type: ${parsed.command}${parsed.answer ? ' [Answer: ' + parsed.answer + ']' : ''}`);
    console.log(`Timestamp: ${formattedDate}`);
    console.log('--------------------------------');

    const event: InternalGameEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: parsed.command,
      source: source,
      userId: userId,
      username: username,
      rawMessage: comment,
      answer: parsed.answer,
      numericValue: parsed.numericValue,
      timestamp: now.toISOString()
    };

    // Emitir evento interno para Game Engine, Supabase y WebSockets
    this.emit('event', event);

    return event;
  }
}
