import { FormatData } from '../types/format-data';

import { processAnsiCodes } from './process-ansi-codes';

/**
 * Handles ANSI escape sequences and updates the ANSI data attributes.
 *
 * This function processes the ANSI escape sequences from the provided ANSI data
 * and updates the attributes accordingly. It returns the updated ANSI data object.
 *
 * @param {string} sequence - The ANSI sequence to process.
 * @returns {(FormatData & { lastEscape: string }) | { lastEscape: string } | null} - The updated ANSI data object or null for unsupported sequences.
 *
 * @todo Ich bin mir nicht sicher, warum hier die Position immer mitgenommen wird. Wenn es mehrere Sequenzen pro String sind, sind diese doch bitte vorher aufzuteilen.
 * @todo Check if the ANSI position is at the end.
 * @example
 * // Example usage
 * const result = processAnsiSequences('\1xb[32m');
 * console.log(result); // { lastEscape: '\x1b[32m', fgcolor: 'green' }
 */
export function processAnsiSequences(
  sequence: string,
): Partial<FormatData & { text?: string }> | null {
  // Hier bekomme ich reine Codes mit und ohne [ aber auch den reinen Text zurück. Der erste Buchstabe ist dabei immer das Steuerzeichen
  // Format: ('[' | '<einzelnes Steuerzeichen>')(Parameter für '[')(Abschlusszeichen für '[')Restlicher Text

  const char = sequence[0];

  let escape = '';

  // Handle sequences starting with '['
  if (char === '[') {
    const [command, text] = handleBracketSequence(sequence);

    const result = {
      ...processAnsiCodes(command),
      ...(text !== undefined ? { text } : {}),
    };

    return result;
  } else {
    switch (char) {
      case '7':
      case '8':
      case 'D':
        return null;
      default:
        escape = handleOtherSequences(sequence, char);

        const result = {
          text: escape,
        };

        return result;
    }
  }
}

/**
 * Handles bracketed ANSI sequences.
 *
 * @param {string} sequence - The ANSI sequence to process.
 * @returns {string} - The processed escape sequence.
 * @throws {Error} - If the sequence cannot be parsed.
 *
 * @todo Hier wurde vorher die ansiPos nachhaltig jeweils um 1 erhöht.
 * @example
 * // Example usage
 * const escape = handleBracketSequence('[32m');
 * console.log(escape); // '32m'
 */
function handleBracketSequence(sequence: string): [string, string | undefined] {
  const sequenceToParse = sequence.substring(1, sequence.length);

  let splitIndex = 0; // Skip the initial '['

  for (splitIndex; splitIndex < sequenceToParse.length; splitIndex++) {
    const char = sequenceToParse[splitIndex];

    if (!/\d|;/g.test(char)) {
      splitIndex++;
      break;
    }
  }

  const command = sequenceToParse.substring(0, splitIndex);
  const text = sequenceToParse.substring(splitIndex, sequenceToParse.length);

  return [command, text.length > 0 ? text : undefined];
}

/**
 * Handles non-bracketed ANSI sequences.
 *
 * @param {string} sequence - The ANSI sequence to process.
 * @param {string} initialChar - The initial character of the sequence.
 * @returns {string} - The processed escape sequence.
 * @throws {Error} - If the sequence cannot be parsed.
 *
 * @example
 * // Example usage
 * const escape = handleOtherSequences('32m', '3');
 * console.log(escape); // '32m'
 */
function handleOtherSequences(sequence: string, initialChar: string): string {
  // Ich verstehe die Funktionen nicht, daher hier die einfache Variante
  return sequence.substring(0, sequence.length);

  // let escape = initialChar;

  // for (let i = 1; i < sequence.length; i++) {
  //   const char = sequence[i];
  //   escape += char;

  // const stop = !ESCAPE_SEQUENCES.VALID.test(char);

  // if (stop) {
  //   return escape;
  // }

  // if (!ESCAPE_SEQUENCES.VALID.test(char)) {
  //   break;
  // }
  // }

  // throw new Error(`handleOtherSequences could not parse sequence ${sequence}`);
}
