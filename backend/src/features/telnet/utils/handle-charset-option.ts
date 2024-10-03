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
  (socket: TelnetSocket) =>
  (serverChunk: Buffer): TelnetSubnegotiationResult => {
    if (
      new Uint8Array(serverChunk)[0] !==
      TelnetCharsetSubnogiation.CHARSET_REQUEST
    ) {
      return null;
    }

    const clientOption = 'UTF-8';

    const serverCharsets = serverChunk.toString().split(' ');

    if (serverCharsets.includes(clientOption) === false) {
      logger.error(
        `[Telnet-Client] [Charset-Option] charset ${clientOption} is not supported by the MUD server. Only ${serverCharsets.join(
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
      clientOption,
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
