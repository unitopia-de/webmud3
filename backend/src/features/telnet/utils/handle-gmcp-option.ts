import EventEmitter from 'events';
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
export type GmcpMessage = {
  /** The GMCP package, e.g. "Char" from "Char.Name" */
  packageName: string;
  /** The GMCP message name, e.g. "Name" from "Char.Name" */
  messageName: string;
  /** The full GMCP module string, e.g. "Char.Name" */
  fullMessage: string;
  /** The parsed JSON data payload, or empty object if none */
  data: unknown;
};

export type GmcpState = {
  /** Whether GMCP negotiation was successful */
  active: boolean;
};

export type GmcpOptionHandler = TelnetOptionHandler<GmcpState> & {
  /**
   * Send a GMCP message to the MUD server.
   * @param module - The GMCP module string, e.g. "Core.Hello"
   * @param data - The data payload (will be JSON-serialized)
   */
  sendGmcp: (module: string, data: unknown) => void;

  /**
   * Register a listener for incoming GMCP messages from the MUD server.
   */
  onGmcpMessage: (listener: (message: GmcpMessage) => void) => void;

  /**
   * Remove a listener for incoming GMCP messages.
   */
  offGmcpMessage: (listener: (message: GmcpMessage) => void) => void;
};

/**
 * Parses a raw GMCP subnegotiation buffer into a structured GmcpMessage.
 *
 * GMCP format: "Package.Message {json_data}" or "Package.Message" (no data)
 */
function parseGmcpBuffer(chunkData: Buffer): GmcpMessage | null {
  const raw = chunkData.toString('utf-8');
  const spaceIndex = raw.indexOf(' ');
  const dotIndex = raw.indexOf('.');

  if (dotIndex < 0) {
    logger.warn(
      `[Telnet-Client] [GMCP-Option] Received GMCP message without dot separator: ${raw}`,
    );

    return null;
  }

  const fullMessage = spaceIndex >= 0 ? raw.substring(0, spaceIndex) : raw;
  const packageName = raw.substring(0, dotIndex);
  const messageName =
    spaceIndex >= 0
      ? raw.substring(dotIndex + 1, spaceIndex)
      : raw.substring(dotIndex + 1);

  let data: unknown = {};

  if (spaceIndex >= 0) {
    const jsonString = raw.substring(spaceIndex + 1);

    try {
      data = JSON.parse(jsonString);
    } catch {
      logger.warn(
        `[Telnet-Client] [GMCP-Option] Failed to parse GMCP JSON data for ${fullMessage}: ${jsonString}`,
      );

      data = jsonString;
    }
  }

  return { packageName, messageName, fullMessage, data };
}

const handleGmcpDo = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeWill(TelnetOptions.TELOPT_GMCP);

  return {
    controlSequence: TelnetControlSequences.WILL,
  };
};

const handleGmcpDont = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeWont(TelnetOptions.TELOPT_GMCP);

  return {
    controlSequence: TelnetControlSequences.WONT,
  };
};

const handleGmcpWill =
  (
    socket: TelnetSocket,
    stateEmitter: EventEmitter,
  ) =>
  (): TelnetOptionResult => {
    socket.writeDo(TelnetOptions.TELOPT_GMCP);

    stateEmitter.emit('state', { active: true } satisfies GmcpState);

    return {
      controlSequence: TelnetControlSequences.DO,
    };
  };

const handleGmcpWont =
  (
    socket: TelnetSocket,
    stateEmitter: EventEmitter,
  ) =>
  (): TelnetOptionResult => {
    socket.writeDont(TelnetOptions.TELOPT_GMCP);

    stateEmitter.emit('state', { active: false } satisfies GmcpState);

    return {
      controlSequence: TelnetControlSequences.DONT,
    };
  };

const handleGmcpSub =
  (gmcpEmitter: EventEmitter) =>
  (serverChunk: Buffer): TelnetSubnegotiationResult => {
    const message = parseGmcpBuffer(serverChunk);

    if (message !== null) {
      logger.debug(
        `[Telnet-Client] [GMCP-Option] Received: ${message.fullMessage}`,
      );

      gmcpEmitter.emit('gmcp', message);
    }

    return null;
  };

export const handleGmcpOption = (
  socket: TelnetSocket,
): GmcpOptionHandler => {
  const stateEmitter = new EventEmitter();
  const gmcpEmitter = new EventEmitter();

  let state: GmcpState = { active: false };

  stateEmitter.on('state', (newState: GmcpState) => {
    state = newState;
  });

  return {
    handleDo: handleGmcpDo(socket),
    handleDont: handleGmcpDont(socket),
    handleWill: handleGmcpWill(socket, stateEmitter),
    handleWont: handleGmcpWont(socket, stateEmitter),
    handleSub: handleGmcpSub(gmcpEmitter),

    getState(): GmcpState {
      return state;
    },

    onStateChange(listener: (state: GmcpState) => void): void {
      stateEmitter.on('state', listener);

      listener(state);
    },

    offStateChange(listener: (state: GmcpState) => void): void {
      stateEmitter.off('state', listener);
    },

    sendGmcp(module: string, data: unknown): void {
      if (!state.active) {
        logger.warn(
          `[Telnet-Client] [GMCP-Option] Cannot send GMCP - not active`,
        );

        return;
      }

      const jsonString =
        data !== undefined && data !== null ? ` ${JSON.stringify(data)}` : '';
      const payload = Buffer.from(`${module}${jsonString}`, 'utf-8');

      logger.debug(
        `[Telnet-Client] [GMCP-Option] Sending: ${module}${jsonString}`,
      );

      socket.writeSub(TelnetOptions.TELOPT_GMCP, payload);
    },

    onGmcpMessage(listener: (message: GmcpMessage) => void): void {
      gmcpEmitter.on('gmcp', listener);
    },

    offGmcpMessage(listener: (message: GmcpMessage) => void): void {
      gmcpEmitter.off('gmcp', listener);
    },
  };
};
