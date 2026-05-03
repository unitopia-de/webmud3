import { MudInputController } from './mud-input.controller';
import { CTRL } from './models/escapes';

describe('MudInputController', () => {
  const makeController = (
    options: { onTabComplete?: jest.Mock } = {},
  ) => {
    const terminal = { write: jest.fn() } as { write: jest.Mock };
    const onCommit = jest.fn();
    const controller = new MudInputController(
      terminal as any,
      onCommit,
      undefined,
      options.onTabComplete,
    );
    return { controller, terminal, onCommit };
  };

  it('commits exactly once on CRLF', () => {
    const { controller, onCommit, terminal } = makeController();

    controller.handleData(CTRL.CR + CTRL.LF);

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({ message: '', echoed: true });
    // Local echo should emit CRLF once
    expect(terminal.write).toHaveBeenCalledTimes(1);
    expect(terminal.write).toHaveBeenCalledWith(CTRL.CR + CTRL.LF);
  });

  it('commits empty buffer on CR (allowed)', () => {
    const { controller, onCommit } = makeController();

    controller.handleData(CTRL.CR);

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({ message: '', echoed: true });
  });

  it('ignores backspace at buffer start', () => {
    const { controller, onCommit, terminal } = makeController();

    controller.handleData(CTRL.BS);

    expect(onCommit).not.toHaveBeenCalled();
    expect(terminal.write).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toEqual({ buffer: '', cursor: 0 });
  });

  it('inserts mid-line after moving cursor left', () => {
    const { controller } = makeController();

    controller.handleData('ab');
    controller.handleData('\u001b[D'); // Arrow left
    controller.handleData('X');

    expect(controller.getSnapshot()).toEqual({ buffer: 'aXb', cursor: 2 });
  });

  it('applies delete (CSI 3~) at cursor position', () => {
    const { controller } = makeController();

    controller.handleData('abc');
    controller.handleData('\u001b[D'); // move to between b|c
    controller.handleData('\u001b[3~'); // delete

    expect(controller.getSnapshot()).toEqual({ buffer: 'ab', cursor: 2 });
  });

  it('suppresses terminal writes when echo is disabled, but still buffers', () => {
    const { controller, terminal } = makeController();

    controller.setLocalEcho(false);
    controller.handleData('abc');

    expect(controller.getSnapshot()).toEqual({ buffer: 'abc', cursor: 3 });
    expect(terminal.write).not.toHaveBeenCalled();
  });

  it('commit reports echoed=false when echo is disabled', () => {
    const { controller, onCommit } = makeController();

    controller.setLocalEcho(false);
    controller.handleData('hi' + CTRL.CR);

    expect(onCommit).toHaveBeenCalledWith({ message: 'hi', echoed: false });
  });

  it('ignores other control chars and never inserts TAB into the buffer', () => {
    // TAB is reserved for triggering GMCP-driven command completion (see the
    // separate test below). All other sub-0x20 control characters are dropped.
    const { controller } = makeController();

    controller.handleData(CTRL.TAB);
    controller.handleData('\u0001'); // SOH control char ignored

    expect(controller.getSnapshot()).toEqual({ buffer: '', cursor: 0 });
  });

  it('invokes the tab-complete callback with the current buffer on stand-alone Tab', () => {
    const onTabComplete = jest.fn();
    const { controller } = makeController({ onTabComplete });

    controller.handleData('look');
    controller.handleData(CTRL.TAB);

    expect(onTabComplete).toHaveBeenCalledTimes(1);
    expect(onTabComplete).toHaveBeenCalledWith('look');
    // Buffer must be unchanged: Tab was consumed, not inserted.
    expect(controller.getSnapshot()).toEqual({ buffer: 'look', cursor: 4 });
  });

  it('does not invoke the tab-complete callback on an empty buffer', () => {
    const onTabComplete = jest.fn();
    const { controller } = makeController({ onTabComplete });

    controller.handleData(CTRL.TAB);

    expect(onTabComplete).not.toHaveBeenCalled();
  });

  it('does not invoke the tab-complete callback for Tab embedded in a paste', () => {
    // Tab arriving as part of a multi-character chunk (e.g. paste) must be
    // silently dropped; treating each pasted Tab as a completion request
    // would clobber the surrounding text.
    const onTabComplete = jest.fn();
    const { controller } = makeController({ onTabComplete });

    controller.handleData('foo' + CTRL.TAB + 'bar');

    expect(onTabComplete).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toEqual({ buffer: 'foobar', cursor: 6 });
  });

  it('buffers incomplete escape and resumes on next chunk', () => {
    const { controller } = makeController();

    controller.handleData('ab');
    controller.handleData('\u001b['); // incomplete CSI
    // No movement yet
    expect(controller.getSnapshot()).toEqual({ buffer: 'ab', cursor: 2 });

    controller.handleData('D'); // completes ESC[D (cursor left)

    expect(controller.getSnapshot()).toEqual({ buffer: 'ab', cursor: 1 });
  });

  describe('command history', () => {
    const ESC = '';
    const ARROW_UP = `${ESC}[A`;
    const ARROW_DOWN = `${ESC}[B`;
    const ALT_ARROW_UP = `${ESC}[1;3A`;
    const ALT_ARROW_DOWN = `${ESC}[1;3B`;

    // Alt prefix variant (xterm meta-sends-ESC default): ESC ESC [A/B.
    const META_ARROW_UP = ESC + ESC + '[A';
    const META_ARROW_DOWN = ESC + ESC + '[B';

    it('arrow up recalls the most recent commit', () => {
      const { controller } = makeController();

      controller.handleData('look' + CTRL.CR);
      controller.handleData(ARROW_UP);

      expect(controller.getSnapshot()).toEqual({ buffer: 'look', cursor: 4 });
    });

    it('arrow up walks further back through history', () => {
      const { controller } = makeController();

      controller.handleData('north' + CTRL.CR);
      controller.handleData('south' + CTRL.CR);
      controller.handleData(ARROW_UP);

      expect(controller.getSnapshot()).toEqual({ buffer: 'south', cursor: 5 });

      controller.handleData(ARROW_UP);

      expect(controller.getSnapshot()).toEqual({ buffer: 'north', cursor: 5 });
    });

    it('arrow down past the newest entry restores the typed anchor', () => {
      const { controller } = makeController();

      controller.handleData('north' + CTRL.CR);
      controller.handleData('typi'); // partially typed before browsing
      controller.handleData(ARROW_UP); // go to "north"

      expect(controller.getSnapshot()).toEqual({ buffer: 'north', cursor: 5 });

      controller.handleData(ARROW_DOWN); // back to anchor

      expect(controller.getSnapshot()).toEqual({ buffer: 'typi', cursor: 4 });
    });

    it('deduplicates consecutive identical commits', () => {
      const { controller } = makeController();

      controller.handleData('schau' + CTRL.CR);
      controller.handleData('schau' + CTRL.CR);
      controller.handleData(ARROW_UP);
      controller.handleData(ARROW_UP); // would walk further if duplicate stored

      expect(controller.getSnapshot()).toEqual({ buffer: 'schau', cursor: 5 });
    });

    it('does not store empty commits', () => {
      const { controller } = makeController();

      controller.handleData(CTRL.CR); // empty commit
      controller.handleData('hi' + CTRL.CR);
      controller.handleData(ARROW_UP);
      controller.handleData(ARROW_UP); // empty would land here if stored

      expect(controller.getSnapshot()).toEqual({ buffer: 'hi', cursor: 2 });
    });

    it('alt+up filters history by current buffer prefix', () => {
      const { controller } = makeController();

      controller.handleData('look' + CTRL.CR);
      controller.handleData('north' + CTRL.CR);
      controller.handleData('look at me' + CTRL.CR);
      controller.handleData('lo'); // prefix
      controller.handleData(ALT_ARROW_UP);

      expect(controller.getSnapshot()).toEqual({
        buffer: 'look at me',
        cursor: 10,
      });

      controller.handleData(ALT_ARROW_UP);

      // 'north' is skipped because it does not start with 'lo'.
      expect(controller.getSnapshot()).toEqual({ buffer: 'look', cursor: 4 });
    });

    it('alt+down restores anchor when no further prefix match exists', () => {
      const { controller } = makeController();

      controller.handleData('look' + CTRL.CR);
      controller.handleData('lo');
      controller.handleData(ALT_ARROW_UP); // -> 'look'
      controller.handleData(ALT_ARROW_DOWN); // no newer match -> anchor

      expect(controller.getSnapshot()).toEqual({ buffer: 'lo', cursor: 2 });
    });

    it('typing exits browse mode but keeps the recalled buffer', () => {
      const { controller } = makeController();

      controller.handleData('look' + CTRL.CR);
      controller.handleData(ARROW_UP); // buffer = 'look'
      controller.handleData('!'); // append, exits browse

      expect(controller.getSnapshot()).toEqual({ buffer: 'look!', cursor: 5 });

      // After exit, Down should be a no-op (browse already exited).
      controller.handleData(ARROW_DOWN);

      expect(controller.getSnapshot()).toEqual({ buffer: 'look!', cursor: 5 });
    });

    it('arrow up with empty history is a no-op', () => {
      const { controller } = makeController();

      controller.handleData(ARROW_UP);

      expect(controller.getSnapshot()).toEqual({ buffer: '', cursor: 0 });
    });

    it('does not record commits while local echo is disabled (passwords)', () => {
      const { controller } = makeController();

      controller.setLocalEcho(false);
      controller.handleData('hunter2' + CTRL.CR);

      controller.setLocalEcho(true);
      controller.handleData(ARROW_UP);

      // History should not contain the password-mode commit.
      expect(controller.getSnapshot()).toEqual({ buffer: '', cursor: 0 });
    });

    it('treats the meta-sends-ESC variant the same as alt+up', () => {
      const { controller } = makeController();

      controller.handleData('look' + CTRL.CR);
      controller.handleData('north' + CTRL.CR);
      controller.handleData('look at me' + CTRL.CR);
      controller.handleData('lo'); // prefix
      controller.handleData(META_ARROW_UP);

      expect(controller.getSnapshot()).toEqual({
        buffer: 'look at me',
        cursor: 10,
      });

      controller.handleData(META_ARROW_UP);

      expect(controller.getSnapshot()).toEqual({ buffer: 'look', cursor: 4 });
    });

    it('meta-down restores anchor when no further prefix match exists', () => {
      const { controller } = makeController();

      controller.handleData('look' + CTRL.CR);
      controller.handleData('lo');
      controller.handleData(META_ARROW_UP); // -> 'look'
      controller.handleData(META_ARROW_DOWN); // anchor

      expect(controller.getSnapshot()).toEqual({ buffer: 'lo', cursor: 2 });
    });

    it('still records commits made before echo was disabled', () => {
      const { controller } = makeController();

      controller.handleData('look' + CTRL.CR); // echoed -> stored
      controller.setLocalEcho(false);
      controller.handleData('secret' + CTRL.CR); // not stored

      controller.setLocalEcho(true);
      controller.handleData(ARROW_UP);

      expect(controller.getSnapshot()).toEqual({ buffer: 'look', cursor: 4 });
    });
  });
});
