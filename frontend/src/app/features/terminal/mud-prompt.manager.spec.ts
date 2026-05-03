import { Terminal } from '@xterm/xterm';

import { CTRL } from './models/escapes';
import type { MudInputController } from './mud-input.controller';
import { MudPromptManager, type MudPromptContext } from './mud-prompt.manager';

describe('MudPromptManager', () => {
  let terminal: Terminal;
  let inputController: jest.Mocked<MudInputController>;
  let manager: MudPromptManager;
  let terminalWriteSpy: jest.SpyInstance;

  const createContext = (
    overrides: Partial<MudPromptContext> = {},
  ): MudPromptContext => ({
    isEditMode: true,
    terminalReady: true,
    localEchoEnabled: true,
    ...overrides,
  });

  beforeEach(() => {
    terminal = new Terminal();
    terminalWriteSpy = jest.spyOn(terminal, 'write');

    inputController = {
      hasContent: jest.fn(),
      getSnapshot: jest.fn(),
    } as unknown as jest.Mocked<MudInputController>;

    manager = new MudPromptManager(terminal, inputController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('reset()', () => {
    it('should clear all state variables', () => {
      // Arrange: Set some state
      manager.beforeServerOutput(createContext());
      manager['currentPrompt'] = 'test> ';
      manager['stripNextLineBreak'] = true;
      manager['incompleteEscape'] = '\x1b[';

      // Act
      manager.reset();

      // Assert
      expect(manager['currentPrompt']).toBe('');
      expect(manager['stripNextLineBreak']).toBe(false);
      expect(manager['incompleteEscape']).toBe('');
      expect(manager['lineHidden']).toBe(false);
    });
  });

  describe('transformOutput()', () => {
    it('should strip leading CRLF when flag is set', () => {
      // Arrange
      manager['stripNextLineBreak'] = true;

      // Act
      const result = manager.transformOutput('\r\nHello World');

      // Assert
      expect(result).toBe('Hello World');
      expect(manager['stripNextLineBreak']).toBe(false);
    });

    it('should strip leading LF only (Unix style)', () => {
      // Arrange
      manager['stripNextLineBreak'] = true;

      // Act
      const result = manager.transformOutput('\nHello World');

      // Assert
      expect(result).toBe('Hello World');
    });

    it('should strip leading CR only (old Mac style)', () => {
      // Arrange
      manager['stripNextLineBreak'] = true;

      // Act
      const result = manager.transformOutput('\rHello World');

      // Assert
      expect(result).toBe('Hello World');
    });

    it('should return data unchanged when flag is false', () => {
      // Arrange
      manager['stripNextLineBreak'] = false;

      // Act
      const result = manager.transformOutput('\r\nHello World');

      // Assert
      expect(result).toBe('\r\nHello World');
    });

    it('should reset flag even if no line break found', () => {
      // Arrange
      manager['stripNextLineBreak'] = true;

      // Act
      const result = manager.transformOutput('Hello World');

      // Assert
      expect(result).toBe('Hello World');
      expect(manager['stripNextLineBreak']).toBe(false);
    });

    it('should handle empty string', () => {
      // Arrange
      manager['stripNextLineBreak'] = true;

      // Act
      const result = manager.transformOutput('');

      // Assert
      expect(result).toBe('');
      expect(manager['stripNextLineBreak']).toBe(true); // Not consumed
    });

    it('should not strip multiple line breaks', () => {
      // Arrange
      manager['stripNextLineBreak'] = true;

      // Act
      const result = manager.transformOutput('\r\n\r\nDouble break');

      // Assert
      expect(result).toBe('\r\nDouble break'); // Only first CRLF stripped
    });
  });

  describe('beforeServerOutput()', () => {
    it('should hide line when all conditions are met', () => {
      // Arrange
      inputController.hasContent.mockReturnValue(true);
      const context = createContext();

      // Act
      manager.beforeServerOutput(context);

      // Assert
      expect(terminalWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('\r'),
      );
      expect(manager['lineHidden']).toBe(true);
      expect(manager['stripNextLineBreak']).toBe(true);
    });

    it('should not hide line when not in edit mode', () => {
      // Arrange
      inputController.hasContent.mockReturnValue(true);
      const context = createContext({ isEditMode: false });

      // Act
      manager.beforeServerOutput(context);

      // Assert
      expect(terminalWriteSpy).not.toHaveBeenCalled();
      expect(manager['lineHidden']).toBe(false);
    });

    it('should not hide line when terminal not ready', () => {
      // Arrange
      inputController.hasContent.mockReturnValue(true);
      const context = createContext({ terminalReady: false });

      // Act
      manager.beforeServerOutput(context);

      // Assert
      expect(terminalWriteSpy).not.toHaveBeenCalled();
      expect(manager['lineHidden']).toBe(false);
    });

    it('should not hide line when local echo disabled', () => {
      // Arrange
      inputController.hasContent.mockReturnValue(true);
      const context = createContext({ localEchoEnabled: false });

      // Act
      manager.beforeServerOutput(context);

      // Assert
      expect(terminalWriteSpy).not.toHaveBeenCalled();
      expect(manager['lineHidden']).toBe(false);
    });

    it('should not hide line when already hidden', () => {
      // Arrange
      inputController.hasContent.mockReturnValue(true);
      manager['lineHidden'] = true;
      const context = createContext();

      // Act
      manager.beforeServerOutput(context);

      // Assert
      expect(terminalWriteSpy).not.toHaveBeenCalled();
    });

    it('should not hide line when no content', () => {
      // Arrange
      inputController.hasContent.mockReturnValue(false);
      manager['currentPrompt'] = '';
      const context = createContext();

      // Act
      manager.beforeServerOutput(context);

      // Assert
      expect(terminalWriteSpy).not.toHaveBeenCalled();
      expect(manager['lineHidden']).toBe(false);
    });

    it('should NOT hide line when only currentPrompt exists (no user input)', () => {
      // Hiding solely because the server-prompt tracker has accumulated
      // content breaks multi-chunk server output: a chunk ending mid-line
      // sets currentPrompt to those mid-line bytes, and the resetLine
      // emitted before the next chunk would wipe them out. Hide/restore is
      // exclusively for protecting the *user's* locally-echoed input.
      inputController.hasContent.mockReturnValue(false);
      manager['currentPrompt'] = '> ';
      const context = createContext();

      manager.beforeServerOutput(context);

      expect(terminalWriteSpy).not.toHaveBeenCalled();
      expect(manager['lineHidden']).toBe(false);
    });

    it('should preserve currentPrompt when hiding', () => {
      // Arrange
      inputController.hasContent.mockReturnValue(true);
      manager['currentPrompt'] = 'HP:100> ';
      const context = createContext();

      // Act
      manager.beforeServerOutput(context);

      // Assert
      expect(manager['currentPrompt']).toBe('HP:100> '); // Not cleared
    });
  });

  describe('afterServerOutput() and restoreLine()', () => {
    beforeEach(() => {
      // Mock queueMicrotask to execute synchronously
      global.queueMicrotask = jest.fn((callback) => callback()) as any;
    });

    it('should restore line after server output', () => {
      // Arrange
      inputController.hasContent.mockReturnValue(true);
      inputController.getSnapshot.mockReturnValue({
        buffer: 'say hello',
        cursor: 9,
      });
      manager['lineHidden'] = true;
      manager['currentPrompt'] = '> ';
      const context = createContext();

      // Act
      manager.afterServerOutput('test\r\n> ', context);

      // Assert: Line should be restored
      expect(terminalWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('> '),
      );
      expect(terminalWriteSpy).toHaveBeenCalledWith('say hello');
      expect(manager['lineHidden']).toBe(false);
    });

    it('should not restore when line is not hidden', () => {
      // Arrange
      inputController.hasContent.mockReturnValue(true);
      manager['lineHidden'] = false;
      const context = createContext();
      terminalWriteSpy.mockClear();

      // Act
      manager.afterServerOutput('test', context);

      // Assert
      expect(terminalWriteSpy).not.toHaveBeenCalled();
    });

    it('should not restore when no content', () => {
      // Arrange
      inputController.hasContent.mockReturnValue(false);
      manager['lineHidden'] = true;
      manager['currentPrompt'] = '';
      const context = createContext();
      terminalWriteSpy.mockClear();

      // Act: afterServerOutput should NOT call restoreLine when no content
      manager.afterServerOutput('test', context);

      // Assert: queueMicrotask should NOT have been called
      expect(terminalWriteSpy).not.toHaveBeenCalled();
    });

    it('should reposition cursor when not at end', () => {
      // Arrange
      inputController.hasContent.mockReturnValue(true);
      inputController.getSnapshot.mockReturnValue({
        buffer: 'say hello',
        cursor: 4, // After "say "
      });
      manager['lineHidden'] = true;
      manager['currentPrompt'] = '> ';
      const context = createContext();

      // Act
      manager.afterServerOutput('test\r\n> ', context);

      // Assert: Cursor should move left by (9 - 4) = 5
      expect(terminalWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('\x1b[5D'),
      );
    });

    it('should handle context changes during async restore (race condition)', () => {
      // Arrange
      inputController.hasContent.mockReturnValue(true);
      inputController.getSnapshot.mockReturnValue({
        buffer: 'test',
        cursor: 4,
      });
      manager['lineHidden'] = true;
      const context = createContext();

      // Mock queueMicrotask to modify context before executing
      global.queueMicrotask = jest.fn((callback) => {
        // Context changes before callback executes
        return callback();
      }) as any;

      // Change context after afterServerOutput but before restore
      const changedContext = createContext({ isEditMode: false });

      // Act: Pass original context, but it should be snapshotted
      manager.afterServerOutput('test', context);

      // Manually call restoreLine with changed context to simulate race
      terminalWriteSpy.mockClear();
      manager['restoreLine'](changedContext);

      // Assert: Should abort restore due to context change
      expect(terminalWriteSpy).not.toHaveBeenCalled();
      expect(manager['lineHidden']).toBe(false); // Flag cleared
    });

    it('should validate snapshot integrity', () => {
      // Arrange
      inputController.hasContent.mockReturnValue(true);
      inputController.getSnapshot.mockReturnValue({
        buffer: 'test',
        cursor: 10, // Invalid: cursor beyond buffer length
      });
      manager['lineHidden'] = true;
      const context = createContext();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act
      manager.afterServerOutput('test', context);

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid snapshot'),
        expect.any(Object),
        expect.any(String),
      );
      expect(manager['lineHidden']).toBe(false);
      consoleErrorSpy.mockRestore();
    });

    it('should clear lineHidden flag without restoring when buffer was emptied mid-stream', () => {
      // Edge case: beforeServerOutput hid the line because the user had a
      // buffered input, but the user pressed Enter while the server reply
      // was still streaming. We must clear the hidden flag (so the next
      // server chunk is not gated on it) but not write a stale prompt back.
      inputController.hasContent.mockReturnValue(false);
      inputController.getSnapshot.mockReturnValue({
        buffer: '',
        cursor: 0,
      });
      manager['lineHidden'] = true;
      manager['currentPrompt'] = 'HP:50> ';
      const context = createContext();
      terminalWriteSpy.mockClear();

      manager.afterServerOutput('test\r\nHP:50> ', context);

      expect(terminalWriteSpy).not.toHaveBeenCalled();
      expect(manager['lineHidden']).toBe(false);
    });
  });

  describe('trackServerLine() - ANSI handling', () => {
    it('should accumulate prompt characters', () => {
      // Act
      manager['trackServerLine']('> ');

      // Assert
      expect(manager['currentPrompt']).toBe('> ');
    });

    it('should reset prompt on CR', () => {
      // Arrange
      manager['currentPrompt'] = 'old prompt';

      // Act
      manager['trackServerLine']('new\rprompt');

      // Assert
      expect(manager['currentPrompt']).toBe('prompt');
    });

    it('should reset prompt on LF', () => {
      // Arrange
      manager['currentPrompt'] = 'old prompt';

      // Act
      manager['trackServerLine']('new\nprompt');

      // Assert
      expect(manager['currentPrompt']).toBe('prompt');
    });

    it('should preserve ANSI color codes', () => {
      // Act
      manager['trackServerLine']('\x1b[31mRed> \x1b[0m');

      // Assert
      expect(manager['currentPrompt']).toBe('\x1b[31mRed> \x1b[0m');
    });

    it('should handle incomplete escape at chunk boundary', () => {
      // Act: First chunk ends with incomplete CSI (\x1b[ has no terminator)
      manager['trackServerLine']('Test\x1b[');

      // Assert: Incomplete escape buffered (but 'Test' was added to prompt first)
      expect(manager['incompleteEscape']).toBe('\x1b[');
      expect(manager['currentPrompt']).toBe('Test');

      // Act: Second chunk completes the escape
      manager['trackServerLine']('31mRed');

      // Assert: Complete escape preserved
      expect(manager['incompleteEscape']).toBe('');
      expect(manager['currentPrompt']).toBe('Test\x1b[31mRed');
    });

    it('should handle backspace with ANSI-aware removal', () => {
      // Arrange
      manager['currentPrompt'] = 'Test\x1b[31mX\x1b[0m';

      // Act: Server sends backspace
      manager['trackServerLine'](CTRL.BS);

      // Assert: Last visible char 'X' removed, escapes preserved
      expect(manager['currentPrompt']).toBe('Test\x1b[31m\x1b[0m');
    });

    it('should handle backspace removing regular character', () => {
      // Arrange
      manager['currentPrompt'] = 'Hello';

      // Act
      manager['trackServerLine'](CTRL.BS);

      // Assert
      expect(manager['currentPrompt']).toBe('Hell');
    });

    it('should handle multiple backspaces', () => {
      // Arrange
      manager['currentPrompt'] = 'Test';

      // Act
      manager['trackServerLine'](CTRL.BS + CTRL.BS);

      // Assert
      expect(manager['currentPrompt']).toBe('Te');
    });

    it('should handle DELETE character same as backspace', () => {
      // Arrange
      manager['currentPrompt'] = 'Test';

      // Act
      manager['trackServerLine'](CTRL.DEL);

      // Assert
      expect(manager['currentPrompt']).toBe('Tes');
    });

    it('should handle complex prompt with multiple ANSI codes', () => {
      // Act
      manager['trackServerLine']('\x1b[1mBold\x1b[0m \x1b[32mGreen\x1b[0m> ');

      // Assert
      expect(manager['currentPrompt']).toBe(
        '\x1b[1mBold\x1b[0m \x1b[32mGreen\x1b[0m> ',
      );
    });

    it('should handle SS3 sequences (arrow keys)', () => {
      // Act
      manager['trackServerLine']('Prompt> \x1bOH'); // Home key

      // Assert
      expect(manager['currentPrompt']).toBe('Prompt> \x1bOH');
    });
  });

  describe('removeLastVisibleChar() - ANSI-aware backspace', () => {
    it('should remove last regular character', () => {
      // Act
      const result = manager['removeLastVisibleChar']('Hello');

      // Assert
      expect(result).toBe('Hell');
    });

    it('should skip over trailing escape sequence', () => {
      // Arrange: String ends with ANSI reset code
      const input = 'Test\x1b[0m';

      // Act
      const result = manager['removeLastVisibleChar'](input);

      // Assert: 't' removed, escape preserved
      expect(result).toBe('Tes\x1b[0m');
    });

    it('should remove character before escape sequence', () => {
      // Arrange
      const input = 'A\x1b[31mB';

      // Act
      const result = manager['removeLastVisibleChar'](input);

      // Assert: 'B' removed
      expect(result).toBe('A\x1b[31m');
    });

    it('should handle multiple escape sequences', () => {
      // Arrange: "X" then red code then reset code
      const input = 'X\x1b[31m\x1b[0m';

      // Act
      const result = manager['removeLastVisibleChar'](input);

      // Assert: 'X' removed, both escapes preserved
      expect(result).toBe('\x1b[31m\x1b[0m');
    });

    it('should handle empty string', () => {
      // Act
      const result = manager['removeLastVisibleChar']('');

      // Assert
      expect(result).toBe('');
    });

    it('should handle string with only escape sequences', () => {
      // Arrange
      const input = '\x1b[31m\x1b[0m';

      // Act
      const result = manager['removeLastVisibleChar'](input);

      // Assert: No visible chars, return unchanged
      expect(result).toBe('\x1b[31m\x1b[0m');
    });

    it('should handle complex real-world prompt', () => {
      // Arrange: HP bar with color codes
      const input = '\x1b[32mHP:\x1b[0m100\x1b[32m>\x1b[0m ';

      // Act: Remove the trailing space
      const result = manager['removeLastVisibleChar'](input);

      // Assert
      expect(result).toBe('\x1b[32mHP:\x1b[0m100\x1b[32m>\x1b[0m');
    });
  });

  describe('skipEscapeSequence()', () => {
    it('should detect CSI sequence', () => {
      // Act
      const length = manager['skipEscapeSequence']('\x1b[31mRest');

      // Assert
      expect(length).toBe(5); // ESC [ 3 1 m
    });

    it('should detect SS3 sequence', () => {
      // Act
      const length = manager['skipEscapeSequence']('\x1bOHRest');

      // Assert
      expect(length).toBe(3); // ESC O H
    });

    it('should return 0 for incomplete CSI', () => {
      // Act: ESC[ without terminator is incomplete
      const length = manager['skipEscapeSequence']('\x1b[');

      // Assert: Should return 0 (incomplete)
      expect(length).toBe(0);
    });

    it('should return 0 for incomplete SS3', () => {
      // Act
      const length = manager['skipEscapeSequence']('\x1bO');

      // Assert
      expect(length).toBe(0); // Incomplete
    });

    it('should return 0 for lone ESC', () => {
      // Act
      const length = manager['skipEscapeSequence']('\x1b');

      // Assert
      expect(length).toBe(0); // Incomplete, might be start of sequence
    });

    it('should handle ESC followed by unexpected character', () => {
      // Act
      const length = manager['skipEscapeSequence']('\x1bX');

      // Assert
      expect(length).toBe(1); // Just ESC, not a known sequence
    });

    it('should detect complex CSI with parameters', () => {
      // Act
      const length = manager['skipEscapeSequence']('\x1b[1;32mRest');

      // Assert
      expect(length).toBe(7); // ESC [ 1 ; 3 2 m
    });
  });

  describe('Integration: Full hide/restore cycle', () => {
    beforeEach(() => {
      global.queueMicrotask = jest.fn((callback) => callback()) as any;
    });

    it('should complete full cycle with ANSI prompt', () => {
      // Arrange
      inputController.hasContent.mockReturnValue(true);
      inputController.getSnapshot.mockReturnValue({
        buffer: 'look',
        cursor: 4,
      });

      // Initial prompt from server
      manager['trackServerLine']('\x1b[32mHP:100\x1b[0m> ');
      expect(manager['currentPrompt']).toBe('\x1b[32mHP:100\x1b[0m> ');

      const context = createContext();

      // Act: Hide before server output
      manager.beforeServerOutput(context);
      expect(manager['lineHidden']).toBe(true);

      // Server sends output with new prompt
      const transformed = manager.transformOutput(
        '\r\nYou see nothing.\r\n\x1b[32mHP:95\x1b[0m> ',
      );
      expect(transformed).toBe('You see nothing.\r\n\x1b[32mHP:95\x1b[0m> ');

      // Restore after server output
      terminalWriteSpy.mockClear();
      manager.afterServerOutput(transformed, context);

      // Assert: Prompt updated and line restored
      expect(manager['currentPrompt']).toBe('\x1b[32mHP:95\x1b[0m> ');
      expect(manager['lineHidden']).toBe(false);
      expect(terminalWriteSpy).toHaveBeenCalledWith('\x1b[32mHP:95\x1b[0m> ');
      expect(terminalWriteSpy).toHaveBeenCalledWith('look');
    });

    it('should handle rapid server output bursts', () => {
      // Arrange
      inputController.hasContent.mockReturnValue(true);
      inputController.getSnapshot.mockReturnValue({
        buffer: 'test',
        cursor: 4,
      });
      const context = createContext();

      // Act: First output
      manager.beforeServerOutput(context);
      manager.afterServerOutput('Message 1\r\n> ', context);
      expect(manager['lineHidden']).toBe(false);

      // Second output arrives immediately
      manager.beforeServerOutput(context);
      manager.afterServerOutput('Message 2\r\n> ', context);

      // Assert: Should complete successfully both times
      expect(manager['lineHidden']).toBe(false);
      expect(manager['currentPrompt']).toBe('> ');
    });
  });
});
