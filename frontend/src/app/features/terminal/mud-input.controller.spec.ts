import { MudInputController } from './mud-input.controller';
import { CTRL } from './models/escapes';

describe('MudInputController', () => {
  const makeController = () => {
    const terminal = { write: jest.fn() } as { write: jest.Mock };
    const onCommit = jest.fn();
    const controller = new MudInputController(terminal as any, onCommit);
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

  it('accepts TAB but ignores other control chars', () => {
    const { controller } = makeController();

    controller.handleData(CTRL.TAB);
    controller.handleData('\u0001'); // SOH control char ignored

    expect(controller.getSnapshot()).toEqual({ buffer: CTRL.TAB, cursor: 1 });
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
});
