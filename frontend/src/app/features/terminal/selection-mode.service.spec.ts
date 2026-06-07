import { SelectionModeService } from './selection-mode.service';

describe('SelectionModeService', () => {
  let svc: SelectionModeService;

  beforeEach(() => {
    svc = new SelectionModeService();
  });

  it('starts inactive', () => {
    expect(svc.state()).toBe('inactive');
    expect(svc.isActive()).toBe(false);
  });

  it('toggle arms the mode from inactive', () => {
    svc.toggle();
    expect(svc.state()).toBe('awaiting-anchor');
    expect(svc.isActive()).toBe(true);
  });

  it('walks anchor → extend → adjusting through taps', () => {
    svc.toggle(); // awaiting-anchor
    svc.setAnchor('xterm', { col: 1, row: 2 });
    expect(svc.state()).toBe('awaiting-extend');
    expect(svc.anchor()).toEqual({ target: 'xterm', data: { col: 1, row: 2 } });

    svc.setEnd('xterm', { col: 5, row: 2 });
    expect(svc.state()).toBe('adjusting');
    expect(svc.end()).toEqual({ target: 'xterm', data: { col: 5, row: 2 } });
  });

  it('treats a second-tap in a DIFFERENT target as a re-anchor', () => {
    svc.toggle();
    svc.setAnchor('xterm', { col: 1, row: 1 });
    svc.setEnd('editor', { lineNumber: 1, column: 1 });
    // Re-anchored in the editor, still awaiting the extend tap.
    expect(svc.state()).toBe('awaiting-extend');
    expect(svc.anchor()?.target).toBe('editor');
    expect(svc.end()).toBeNull();
  });

  it('updateAnchor / updateEnd refine the active markers', () => {
    svc.toggle();
    svc.setAnchor('xterm', { col: 1, row: 1 });
    svc.setEnd('xterm', { col: 2, row: 1 });

    svc.updateAnchor({ col: 0, row: 1 });
    svc.updateEnd({ col: 9, row: 1 });
    expect(svc.anchor()?.data).toEqual({ col: 0, row: 1 });
    expect(svc.end()?.data).toEqual({ col: 9, row: 1 });
  });

  it('updateAnchor is ignored when no anchor is set', () => {
    svc.updateAnchor({ col: 3, row: 3 });
    expect(svc.anchor()).toBeNull();
  });

  it('toggle in adjusting state commits (selection cleared from state, mode exits)', () => {
    svc.toggle();
    svc.setAnchor('xterm', { col: 1, row: 1 });
    svc.setEnd('xterm', { col: 2, row: 1 });
    svc.toggle(); // commit
    expect(svc.state()).toBe('inactive');
    expect(svc.anchor()).toBeNull();
    expect(svc.end()).toBeNull();
  });

  it('toggle while awaiting cancels', () => {
    svc.toggle(); // awaiting-anchor
    svc.toggle(); // cancel
    expect(svc.state()).toBe('inactive');
  });
});
