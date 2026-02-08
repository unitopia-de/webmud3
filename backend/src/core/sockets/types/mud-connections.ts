import { TelnetClient } from '../../../features/telnet/telnet-client.js';

/**
 * Ringbuffer für MUD-Output (rohe Telnet-Daten)
 * Speichert bis zu 10MB und verwirft die ältesten Daten, wenn das Limit überschritten wird
 */
export type OutputEntry = { seq: number; data: string };

export class OutputLineBuffer {
  private buffer: OutputEntry[] = [];
  private readonly maxBytes = 10 * 1024 * 1024; // 10MB
  private currentSizeBytes = 0;
  private nextSeq = 1;

  /**
   * Fügt Daten zum Buffer hinzu.
   * Wenn das Größenlimit überschritten wird, werden die ältesten Einträge gelöscht.
   */
  public addData(data: string): number {
    const dataBytes = Buffer.byteLength(data, 'utf-8');

    const entry: OutputEntry = { seq: this.nextSeq++, data };

    this.buffer.push(entry);

    this.currentSizeBytes += dataBytes;

    // Entferne älteste Einträge, bis wir wieder unter dem Limit sind
    while (this.currentSizeBytes > this.maxBytes && this.buffer.length > 0) {
      const removed = this.buffer.shift();

      if (removed !== undefined) {
        this.currentSizeBytes -= Buffer.byteLength(removed.data, 'utf-8');
      }
    }

    return entry.seq;
  }

  /**
   * Gibt alle gepufferten Daten als String zurück
   */
  public getEntries(): OutputEntry[] {
    return [...this.buffer];
  }

  /**
   * Gibt die aktuelle Größe des Buffers in Bytes zurück
   */
  public getSizeBytes(): number {
    return this.currentSizeBytes;
  }

  /**
   * Löscht den kompletten Buffer
   */
  public clear(): void {
    this.buffer = [];

    this.currentSizeBytes = 0;

    this.nextSeq = 1;
  }
}

export type MudConnections = {
  [sessionToken: string]: {
    telnet: TelnetClient | undefined;
    connectionTimer: NodeJS.Timeout | undefined;
    outputLineBuffer: OutputLineBuffer;
    socketId: string | undefined; // Current socket.id for emit/broadcast
  };
};
