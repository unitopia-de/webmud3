import { TelnetSocket } from 'telnet-stream';

import { logger } from '../../../shared/utils/logger.js';
import { TelnetControlSequences } from '../types/telnet-control-sequences.js';
import { TelnetOptionHandler } from '../types/telnet-option-handler.js';
import { TelnetOptions } from '../types/telnet-options.js';
import { TelnetSubnegotiationResult } from '../types/telnet-subnegotiation-result.js';

enum TelnetCharsetSubnogiation {
  CHARSET_REJECTED = 0,
  CHARSET_REQUEST = 1,
  CHARSET_ACCEPTED = 2,
}

const handleCharsetDo =
  (socket: TelnetSocket) => (): TelnetControlSequences => {
    socket.writeWill(TelnetOptions.TELOPT_CHARSET);

    return TelnetControlSequences.WILL;
  };

const handleCharsetDont =
  (socket: TelnetSocket) => (): TelnetControlSequences => {
    socket.writeWont(TelnetOptions.TELOPT_CHARSET);

    return TelnetControlSequences.WONT;
  };

const handleCharsetWill =
  (socket: TelnetSocket) => (): TelnetControlSequences => {
    socket.writeDo(TelnetOptions.TELOPT_CHARSET);

    return TelnetControlSequences.DO;
  };

const handleCharsetWont =
  (socket: TelnetSocket) => (): TelnetControlSequences => {
    socket.writeDont(TelnetOptions.TELOPT_CHARSET);

    return TelnetControlSequences.DONT;
  };

const handleCharsetSub =
  (socket: TelnetSocket, encoding: BufferEncoding) =>
  (serverChunk: Buffer): TelnetSubnegotiationResult => {
    if (
      new Uint8Array(serverChunk)[0] ===
      TelnetCharsetSubnogiation.CHARSET_REQUEST
    ) {
      const command = Buffer.alloc(
        1,
        TelnetCharsetSubnogiation.CHARSET_ACCEPTED,
      );

      /**
       * This function remappes the given charset from the environment to the one supported by the Telnet server
       */
      const matchCharset = (
        charset: BufferEncoding,
        serverCharsets: string[],
      ): string => {
        if (charset === 'utf-8') {
          if (serverCharsets.includes('UTF-8')) {
            return 'UTF-8';
          }
        }

        if (charset === 'ascii') {
          if (serverCharsets.includes('US-ASCII')) {
            return 'US-ASCII';
          }
        }

        if (charset === 'latin1') {
          if (serverCharsets.includes('ISO-8859-1')) {
            return 'ISO-8859-1';
          }
        }

        logger.warn(
          `[Socket-Manager] [Client] charset ${charset} is not supported by the Telnet server. Only ${serverCharsets.join(', ')} are supported. Default to utf-8`,
        );

        return 'UTF-8';
      };

      const serverCharsets = serverChunk.toString().split(' ');

      const charset = matchCharset(encoding, serverCharsets);

      const data = Buffer.from(charset);

      const message = Buffer.concat([command, data], data.length + 1);

      socket.writeSub(TelnetOptions.TELOPT_CHARSET, message);

      return {
        clientChunk: message,
        clientOption: charset.toLocaleLowerCase(),
      };
    }

    return null;
  };

export const handleCharsetOption = (
  socket: TelnetSocket,
  encoding: BufferEncoding,
): TelnetOptionHandler => {
  return {
    handleDo: handleCharsetDo(socket),
    handleDont: handleCharsetDont(socket),
    handleWill: handleCharsetWill(socket),
    handleWont: handleCharsetWont(socket),
    handleSub: handleCharsetSub(socket, encoding),
  };
};
