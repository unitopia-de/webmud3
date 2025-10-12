import { TelnetSocket } from 'telnet-stream';

import { logger } from '../../../shared/utils/logger.js';
import { TelnetOptions } from '../models/telnet-options.js';
import { TelnetControlSequences } from '../types/telnet-control-sequences.js';
import { TelnetOptionHandler } from '../types/telnet-option-handler.js';
import { TelnetOptionResult } from '../types/telnet-option-result.js';
import { TelnetSubnegotiationResult } from '../types/telnet-subnegotiation-result.js';

enum LinemodeSubnegotiationCommand {
  MODE = 1,
  FORWARDMASK = 2,
  SLC = 3,
}

enum LinemodeModeMask {
  EDIT = 0x01,
  TRAPSIG = 0x02,
  MODE_ACK = 0x04,
  SOFT_TAB = 0x08,
  LIT_ECHO = 0x10,
}

enum LinemodeSlcFlags {
  SLC_ACK = 0x80,
}

const DEFAULT_MODE =
  LinemodeModeMask.EDIT |
  LinemodeModeMask.TRAPSIG |
  LinemodeModeMask.SOFT_TAB;

const DEFAULT_FORWARD_MASK_CODES = [10 /* LF */, 13 /* CR */];

const CONTROL_LABELS: Record<number, string> = {
  0: 'NUL',
  3: 'ETX',
  4: 'EOT',
  8: 'BS',
  9: 'TAB',
  10: 'LF',
  12: 'FF',
  13: 'CR',
  21: 'NAK',
  23: 'ETB',
  26: 'SUB',
};

const createForwardMask = (chars: number[]): Buffer => {
  if (chars.length === 0) {
    return Buffer.alloc(0);
  }

  const maxChar = Math.max(...chars);
  const size = Math.floor(maxChar / 8) + 1;

  const mask = Buffer.alloc(size, 0);

  for (const char of chars) {
    if (char < 0) {
      continue;
    }

    const index = Math.floor(char / 8);
    const bitPosition = char % 8;
    const bit = 0x80 >> bitPosition;

    mask[index] |= bit;
  }

  return mask;
};

const DEFAULT_FORWARD_MASK = createForwardMask(DEFAULT_FORWARD_MASK_CODES);

const buildModeMessage = (mode: number, acknowledge = false): Buffer => {
  const mask = acknowledge ? mode | LinemodeModeMask.MODE_ACK : mode;

  return Buffer.from([LinemodeSubnegotiationCommand.MODE, mask]);
};

const buildForwardMaskMessage = (mask: Buffer): Buffer => {
  return Buffer.concat(
    [Buffer.from([LinemodeSubnegotiationCommand.FORWARDMASK]), mask],
    mask.length + 1,
  );
};

const trimTrailingZeros = (mask: Buffer): Buffer => {
  let end = mask.length;

  while (end > 0 && mask[end - 1] === 0) {
    end -= 1;
  }

  return mask.subarray(0, end);
};

const buffersEqual = (left: Buffer, right: Buffer): boolean => {
  return left.length === right.length && left.equals(right);
};

const modeToString = (mode: number): string => {
  const parts: string[] = [];

  if ((mode & LinemodeModeMask.EDIT) !== 0) {
    parts.push('EDIT');
  }

  if ((mode & LinemodeModeMask.TRAPSIG) !== 0) {
    parts.push('TRAPSIG');
  }

  if ((mode & LinemodeModeMask.SOFT_TAB) !== 0) {
    parts.push('SOFT_TAB');
  }

  if ((mode & LinemodeModeMask.LIT_ECHO) !== 0) {
    parts.push('LIT_ECHO');
  }

  return parts.join(' | ') || 'NONE';
};

const extractControlCodes = (mask: Buffer): number[] => {
  const codes: number[] = [];

  mask.forEach((byte, byteIndex) => {
    for (let bit = 0; bit < 8; bit += 1) {
      if ((byte & (0x80 >> bit)) !== 0) {
        codes.push(byteIndex * 8 + bit);
      }
    }
  });

  return codes;
};

const forwardMaskToString = (mask: Buffer): string => {
  const codes = extractControlCodes(mask);

  if (codes.length === 0) {
    return 'none';
  }

  return codes
    .map((code) => CONTROL_LABELS[code] ?? `0x${code.toString(16)}`)
    .join(', ');
};

const ensureMandatoryModeBits = (mode: number): number => {
  let result = mode;

  result |= LinemodeModeMask.EDIT;
  result |= LinemodeModeMask.TRAPSIG;

  if ((DEFAULT_MODE & LinemodeModeMask.SOFT_TAB) !== 0) {
    result |= LinemodeModeMask.SOFT_TAB;
  }

  return result;
};

const handleLinemodeDo =
  (
    socket: TelnetSocket,
    sendMode: (mode: number, acknowledge?: boolean) => Buffer,
    sendForwardMask: (mask: Buffer) => Buffer,
    desiredMode: () => number,
    desiredForwardMask: () => Buffer,
  ) =>
  (): TelnetOptionResult => {
    socket.writeWill(TelnetOptions.TELOPT_LINEMODE);

    const mode = desiredMode();
    sendMode(mode);

    sendForwardMask(desiredForwardMask());

    const summary = `MODE=${modeToString(mode)};FORWARDMASK=${forwardMaskToString(
      desiredForwardMask(),
    )}`;

    return {
      controlSequence: TelnetControlSequences.WILL,
      subNegotiationResult: {
        clientChunk: Buffer.from(summary, 'utf-8'),
        clientOption: summary,
      },
    };
  };

const handleLinemodeDont = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeWont(TelnetOptions.TELOPT_LINEMODE);

  return { controlSequence: TelnetControlSequences.WONT };
};

const handleLinemodeWill = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeDo(TelnetOptions.TELOPT_LINEMODE);

  return { controlSequence: TelnetControlSequences.DO };
};

const handleLinemodeWont =
  (socket: TelnetSocket) => (): TelnetOptionResult => {
    socket.writeDont(TelnetOptions.TELOPT_LINEMODE);

    return { controlSequence: TelnetControlSequences.DONT };
  };

const handleModeSubnegotiation =
  (
    socket: TelnetSocket,
    sendMode: (mode: number, acknowledge?: boolean) => Buffer,
    updateMode: (mode: number) => void,
  ) =>
  (serverChunk: Buffer): TelnetSubnegotiationResult => {
    if (serverChunk.length < 2) {
      return null;
    }

    const [, rawMode] = serverChunk;

    const isAcknowledged =
      (rawMode & LinemodeModeMask.MODE_ACK) === LinemodeModeMask.MODE_ACK;

    const requestedMode = ensureMandatoryModeBits(
      rawMode & ~LinemodeModeMask.MODE_ACK,
    );

    if (isAcknowledged) {
      updateMode(requestedMode);
      return null;
    }

    updateMode(requestedMode);
    sendMode(requestedMode, true);
    const description = modeToString(requestedMode);

    return {
      clientChunk: Buffer.from(description, 'utf-8'),
      clientOption: description,
    };
  };

const handleForwardMaskNegotiation =
  (
    socket: TelnetSocket,
    sendForwardMask: (mask: Buffer) => Buffer,
    updateForwardMask: (mask: Buffer) => void,
    desiredForwardMask: () => Buffer,
  ) =>
  (
    command: TelnetControlSequences,
    payload: Buffer,
  ): TelnetSubnegotiationResult | null => {
    switch (command) {
      case TelnetControlSequences.DO: {
        const acknowledgement = Buffer.from([
          TelnetControlSequences.WILL,
          LinemodeSubnegotiationCommand.FORWARDMASK,
        ]);

        socket.writeSub(
          TelnetOptions.TELOPT_LINEMODE,
          acknowledgement,
        );

        updateForwardMask(desiredForwardMask());

        sendForwardMask(desiredForwardMask());
        const maskDescription = forwardMaskToString(desiredForwardMask());

        logger.verbose('[Telnet-Linemode] Negotiated FORWARDMASK with server', {
          requestedMask: forwardMaskToString(trimTrailingZeros(payload)),
          negotiatedMask: maskDescription,
        });

        return {
          clientChunk: Buffer.from(maskDescription, 'utf-8'),
          clientOption: maskDescription,
        };
      }
      case TelnetControlSequences.DONT: {
        const acknowledgement = Buffer.from([
          TelnetControlSequences.WONT,
          LinemodeSubnegotiationCommand.FORWARDMASK,
        ]);

        socket.writeSub(
          TelnetOptions.TELOPT_LINEMODE,
          acknowledgement,
        );

        updateForwardMask(Buffer.alloc(0));

        return {
          clientChunk: Buffer.from('forwardmask disabled', 'utf-8'),
          clientOption: 'forwardmask disabled',
        };
      }
      default:
        return null;
    }
  };

const handleForwardMaskUpdate =
  (
    socket: TelnetSocket,
    sendForwardMask: (mask: Buffer) => Buffer,
    updateForwardMask: (mask: Buffer) => void,
    desiredForwardMask: () => Buffer,
  ) =>
  (serverMask: Buffer): TelnetSubnegotiationResult | null => {
    const trimmedMask = trimTrailingZeros(serverMask);

    if (buffersEqual(trimmedMask, desiredForwardMask())) {
      updateForwardMask(trimmedMask);
      return null;
    }

    logger.verbose('[Telnet-Linemode] Server requested unsupported FORWARDMASK', {
      serverMask: forwardMaskToString(trimmedMask),
      overriddenMask: forwardMaskToString(desiredForwardMask()),
    });

    updateForwardMask(desiredForwardMask());

    sendForwardMask(desiredForwardMask());
    const maskDescription = forwardMaskToString(desiredForwardMask());

    return {
      clientChunk: Buffer.from(maskDescription, 'utf-8'),
      clientOption: maskDescription,
    };
  };

const acknowledgeSlc =
  (socket: TelnetSocket) =>
  (serverChunk: Buffer): TelnetSubnegotiationResult | null => {
    if ((serverChunk.length - 1) % 3 !== 0) {
      return null;
    }

    const response = Buffer.from(serverChunk);

    for (let index = 1; index < response.length; index += 3) {
      response[index] |= LinemodeSlcFlags.SLC_ACK;
    }

    socket.writeSub(TelnetOptions.TELOPT_LINEMODE, response);

    return {
      clientChunk: Buffer.from('slc ack', 'utf-8'),
      clientOption: 'slc ack',
    };
  };

export const handleLinemodeOption = (
  socket: TelnetSocket,
): TelnetOptionHandler => {
  let negotiatedMode = DEFAULT_MODE;
  let negotiatedForwardMask = Buffer.from(DEFAULT_FORWARD_MASK);

  const sendMode = (mode: number, acknowledge = false) => {
    const message = buildModeMessage(mode, acknowledge);

    socket.writeSub(TelnetOptions.TELOPT_LINEMODE, message);

    return message;
  };

  const sendForwardMask = (mask: Buffer) => {
    const message = buildForwardMaskMessage(mask);

    socket.writeSub(TelnetOptions.TELOPT_LINEMODE, message);

    return message;
  };

  const openLinemode =
    handleLinemodeDo(
      socket,
      sendMode,
      sendForwardMask,
      () => negotiatedMode,
      () => negotiatedForwardMask,
    );

  const modeHandler = handleModeSubnegotiation(socket, sendMode, (mode) => {
    negotiatedMode = mode;
  });

  const forwardMaskNegotiation = handleForwardMaskNegotiation(
    socket,
    sendForwardMask,
    (mask) => {
      negotiatedForwardMask = Buffer.from(mask);
    },
    () => negotiatedForwardMask,
  );

  const forwardMaskUpdate = handleForwardMaskUpdate(
    socket,
    sendForwardMask,
    (mask) => {
      negotiatedForwardMask = Buffer.from(mask);
    },
    () => negotiatedForwardMask,
  );

  const slcAcknowledgement = acknowledgeSlc(socket);

  return {
    handleDo: openLinemode,
    handleDont: handleLinemodeDont(socket),
    handleWill: handleLinemodeWill(socket),
    handleWont: handleLinemodeWont(socket),
    handleSub: (serverChunk: Buffer) => {
      if (serverChunk.length === 0) {
        return null;
      }

      const command = serverChunk[0];

      if (command === LinemodeSubnegotiationCommand.MODE) {
        return modeHandler(serverChunk);
      }

      if (
        command === TelnetControlSequences.DO ||
        command === TelnetControlSequences.DONT ||
        command === TelnetControlSequences.WILL ||
        command === TelnetControlSequences.WONT
      ) {
        const subCommand = serverChunk[1];

        if (subCommand !== LinemodeSubnegotiationCommand.FORWARDMASK) {
          return null;
        }

        return forwardMaskNegotiation(
          command,
          serverChunk.subarray(2),
        );
      }

      if (command === LinemodeSubnegotiationCommand.FORWARDMASK) {
        return forwardMaskUpdate(serverChunk.subarray(1));
      }

      if (command === LinemodeSubnegotiationCommand.SLC) {
        return slcAcknowledgement(serverChunk);
      }

      return null;
    },
  };
};
