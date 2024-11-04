import { logger } from '../../../shared/utils/logger.js';
import { TelnetOptions } from '../models/telnet-options.js';

export function logNegotiation(
  perspective: 'Received' | 'Send',
  action: string,
  option: number,
  data?: Buffer,
) {
  // be careful since typescript does not recognize the value as undefined if you provide a number not in the enum
  const opt = TelnetOptions[option] as string | undefined;

  logger.verbose(
    `[Telnet-Socket] ${perspective} ${action} for option ${opt ?? 'unknown (number: ' + option + ')'}`,
    data ? { data: data.toString() } : {},
  );
}
