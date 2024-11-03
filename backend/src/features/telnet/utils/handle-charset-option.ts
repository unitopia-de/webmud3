import { TelnetSocket } from 'telnet-stream';

import { logger } from '../../../shared/utils/logger.js';
import { TelnetControlSequences } from '../types/telnet-control-sequences.js';
import { TelnetNegotiationResult } from '../types/telnet-negotiation-result.js';
import { TelnetOptionHandler } from '../types/telnet-option-handler.js';
import { TelnetOptions } from '../types/telnet-options.js';
import { TelnetSubnegotiationResult } from '../types/telnet-subnegotiation-result.js';

const DEFAULT_CLIENT_ENCODING = 'UTF-8';

enum TelnetCharsetSubnogiation {
  CHARSET_REJECTED = 0,
  CHARSET_REQUEST = 1,
  CHARSET_ACCEPTED = 2,
}

const handleCharsetDo =
  (socket: TelnetSocket) => (): TelnetNegotiationResult => {
    socket.writeWill(TelnetOptions.TELOPT_CHARSET);

    return {
      controlSequence: TelnetControlSequences.WILL,
    };
  };

const handleCharsetDont =
  (socket: TelnetSocket) => (): TelnetNegotiationResult => {
    socket.writeWont(TelnetOptions.TELOPT_CHARSET);

    return {
      controlSequence: TelnetControlSequences.WONT,
    };
  };

const handleCharsetWill =
  (socket: TelnetSocket) => (): TelnetNegotiationResult => {
    socket.writeDo(TelnetOptions.TELOPT_CHARSET);

    return {
      controlSequence: TelnetControlSequences.DO,
    };
  };

const handleCharsetWont =
  (socket: TelnetSocket) => (): TelnetNegotiationResult => {
    socket.writeDont(TelnetOptions.TELOPT_CHARSET);

    return {
      controlSequence: TelnetControlSequences.DONT,
    };
  };

const handleCharsetSub =
  (socket: TelnetSocket) =>
  (serverChunk: Buffer): TelnetSubnegotiationResult => {
    if (
      new Uint8Array(serverChunk)[0] !==
      TelnetCharsetSubnogiation.CHARSET_REQUEST
    ) {
      return null;
    }

    const serverCharsets = serverChunk.toString().split(' ');

    if (serverCharsets.includes(DEFAULT_CLIENT_ENCODING) === false) {
      logger.error(
        `[Telnet-Client] [Charset-Option] charset ${DEFAULT_CLIENT_ENCODING} is not supported by the MUD server. Only ${serverCharsets.join(
          ', ',
        )} are supported.`,
      );
    }

    const command = Buffer.alloc(1, TelnetCharsetSubnogiation.CHARSET_ACCEPTED);

    const data = Buffer.from('UTF-8');

    const message = Buffer.concat([command, data], data.length + 1);

    socket.writeSub(TelnetOptions.TELOPT_CHARSET, message);

    return {
      clientChunk: message,
      clientOption: DEFAULT_CLIENT_ENCODING,
    };
  };

export const handleCharsetOption = (
  socket: TelnetSocket,
): TelnetOptionHandler => {
  return {
    handleDo: handleCharsetDo(socket),
    handleDont: handleCharsetDont(socket),
    handleWill: handleCharsetWill(socket),
    handleWont: handleCharsetWont(socket),
    handleSub: handleCharsetSub(socket),
  };
};
