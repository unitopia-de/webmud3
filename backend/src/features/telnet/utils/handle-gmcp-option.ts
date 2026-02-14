import { TelnetSocket } from 'telnet-stream';

import { logger } from '../../../shared/utils/logger.js';
import { TelnetOptions } from '../models/telnet-options.js';
import { TelnetControlSequences } from '../types/telnet-control-sequences.js';
import { TelnetOptionHandler } from '../types/telnet-option-handler.js';
import { TelnetOptionResult } from '../types/telnet-option-result.js';
import { TelnetSubnegotiationResult } from '../types/telnet-subnegotiation-result.js';

/**
 * Parsed GMCP message received from the MUD server.
 */
export interface GmcpIncomingMessage {
  /** Top-level module name, e.g. "Core", "Char", "Sound" */
  module: string;
  /** Message name within the module, e.g. "Hello", "Status", "Url" */
  message: string;
  /** Parsed JSON payload (defaults to empty object) */
  data: unknown;
}

/**
 * State tracked by the GMCP option handler.
 */
export type GmcpState = {
  /** Whether the MUD server has agreed to use GMCP */
  isActive: boolean;
};

/**
 * Callback invoked when a GMCP subnegotiation message arrives from the MUD.
 */
export type GmcpIncomingCallback = (message: GmcpIncomingMessage) => void;

/**
 * Extended handler interface exposing a method to send outgoing GMCP messages.
 */
export type GmcpOptionHandler = TelnetOptionHandler<GmcpState> & {
  /**
   * Sends a GMCP message to the MUD server.
   *
   * @param module - Top-level module name (e.g. "Core")
   * @param message - Message name (e.g. "Hello")
   * @param data - Payload to JSON-encode
   */
  sendGmcp: (module: string, message: string, data: unknown) => void;
};

/**
 * Internal negotiator class encapsulating GMCP option logic.
 */
class GmcpNegotiator {
  private state: GmcpState = { isActive: false };

  constructor(
    private readonly socket: TelnetSocket,
    private readonly socketId: string,
    private readonly onIncoming: GmcpIncomingCallback,
  ) {}

  /**
   * Server asks us to enable GMCP (DO) — we refuse since we are the client side.
   * GMCP negotiation is server-initiated via WILL.
   */
  public handleDo(): TelnetOptionResult {
    // As a client, we don't initiate GMCP. If server sends DO, we respond WONT.
    this.socket.writeWont(TelnetOptions.TELOPT_GMCP);

    return { controlSequence: TelnetControlSequences.WONT };
  }

  /**
   * Server tells us to disable GMCP (DONT).
   */
  public handleDont(): TelnetOptionResult {
    this.socket.writeWont(TelnetOptions.TELOPT_GMCP);

    this.setActive(false);

    return { controlSequence: TelnetControlSequences.WONT };
  }

  /**
   * Server announces GMCP support (WILL) — we accept with DO.
   */
  public handleWill(): TelnetOptionResult {
    this.socket.writeDo(TelnetOptions.TELOPT_GMCP);

    this.setActive(true);

    logger.info(
      `[${this.socketId}] [GMCP] Server announced GMCP support. Accepting.`,
    );

    return { controlSequence: TelnetControlSequences.DO };
  }

  /**
   * Server declines GMCP (WONT).
   */
  public handleWont(): TelnetOptionResult {
    this.socket.writeDont(TelnetOptions.TELOPT_GMCP);

    this.setActive(false);

    logger.info(
      `[${this.socketId}] [GMCP] Server declined GMCP support.`,
    );

    return { controlSequence: TelnetControlSequences.DONT };
  }

  /**
   * Handles incoming GMCP subnegotiation data from the MUD server.
   *
   * GMCP subnegotiation format:
   *   `<module>.<message> <json-data>`
   *
   * Examples:
   *   `Core.Hello {"client":"WebMud3"}`
   *   `Char.Name {"name":"Gandalf","fullname":"Gandalf the Grey"}`
   *   `Core.Goodbye` (no data → empty object)
   */
  public handleSub(serverChunk: Buffer): TelnetSubnegotiationResult {
    const raw = serverChunk.toString('utf-8');

    const parsed = parseGmcpMessage(raw);

    if (parsed === null) {
      logger.warn(
        `[${this.socketId}] [GMCP] Failed to parse incoming message: ${raw}`,
      );

      return null;
    }

    logger.verbose(
      `[${this.socketId}] [GMCP] Incoming: ${parsed.module}.${parsed.message}`,
      { data: parsed.data },
    );

    this.onIncoming(parsed);

    return {
      clientChunk: serverChunk,
      clientOption: `${parsed.module}.${parsed.message}`,
    };
  }

  /**
   * Sends a GMCP message to the MUD server via telnet subnegotiation.
   *
   * Wire format: IAC SB GMCP <module>.<message> <json> IAC SE
   */
  public sendGmcp(module: string, message: string, data: unknown): void {
    if (!this.state.isActive) {
      logger.warn(
        `[${this.socketId}] [GMCP] Cannot send GMCP message: GMCP is not active.`,
      );

      return;
    }

    const jsonPayload = JSON.stringify(data);
    const payload = `${module}.${message} ${jsonPayload}`;
    const buffer = Buffer.from(payload, 'utf-8');

    this.socket.writeSub(TelnetOptions.TELOPT_GMCP, buffer);

    logger.verbose(
      `[${this.socketId}] [GMCP] Outgoing: ${module}.${message}`,
      { data },
    );
  }

  public getState(): GmcpState {
    return { ...this.state };
  }

  private setActive(isActive: boolean): void {
    if (this.state.isActive === isActive) {
      return;
    }

    this.state = { isActive };
  }
}

/**
 * Parses a raw GMCP subnegotiation string into its components.
 *
 * Format: `<module>.<message> <json-data>`
 * If no space is found, data defaults to an empty object.
 * The module/message split happens at the first dot.
 *
 * @returns Parsed message or null if the format is invalid.
 */
export function parseGmcpMessage(raw: string): GmcpIncomingMessage | null {
  if (raw.length === 0) {
    return null;
  }

  const spaceIndex = raw.indexOf(' ');
  const moduleMessage = spaceIndex >= 0 ? raw.substring(0, spaceIndex) : raw;
  const jsonString =
    spaceIndex >= 0 ? raw.substring(spaceIndex + 1).trim() : '';

  const dotIndex = moduleMessage.indexOf('.');

  if (dotIndex < 1) {
    // No dot found or dot is at position 0 — invalid GMCP format
    return null;
  }

  const module = moduleMessage.substring(0, dotIndex);
  const message = moduleMessage.substring(dotIndex + 1);

  if (message.length === 0) {
    return null;
  }

  let data: unknown = {};

  if (jsonString.length > 0) {
    try {
      data = JSON.parse(jsonString);
    } catch {
      logger.warn(`[GMCP] Failed to parse JSON payload: ${jsonString}`);

      // Keep data as the raw string if JSON parsing fails
      data = jsonString;
    }
  }

  return { module, message, data };
}

/**
 * Factory function to create a GMCP option handler.
 *
 * @param socket - The telnet socket for sending negotiation responses.
 * @param socketId - Identifier for logging purposes.
 * @param onIncoming - Callback invoked when a GMCP message is received from the MUD.
 * @returns A GmcpOptionHandler instance.
 */
export const handleGmcpOption = (
  socket: TelnetSocket,
  socketId: string,
  onIncoming: GmcpIncomingCallback,
): GmcpOptionHandler => {
  const negotiator = new GmcpNegotiator(socket, socketId, onIncoming);

  return {
    handleDo: () => negotiator.handleDo(),
    handleDont: () => negotiator.handleDont(),
    handleWill: () => negotiator.handleWill(),
    handleWont: () => negotiator.handleWont(),
    handleSub: (serverChunk) => negotiator.handleSub(serverChunk),
    getState: () => negotiator.getState(),
    sendGmcp: (module, message, data) =>
      negotiator.sendGmcp(module, message, data),
  };
};
