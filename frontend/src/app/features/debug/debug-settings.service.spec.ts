import { DebugSettingsService } from './debug-settings.service';

describe('DebugSettingsService', () => {
  let svc: DebugSettingsService;

  beforeEach(() => {
    svc = new DebugSettingsService();
  });

  it('defaults every flag to false', () => {
    expect(svc.screenReaderLogging).toBe(false);
    expect(svc.pasteLogging).toBe(false);
    expect(svc.outputHexLogging).toBe(false);
  });

  it('setters update the getter and the stream', () => {
    const seen: boolean[] = [];
    const sub = svc.screenReaderLogging$.subscribe((v) => seen.push(v));
    svc.setScreenReaderLogging(true);
    expect(svc.screenReaderLogging).toBe(true);
    // no-op when unchanged → no extra emission
    svc.setScreenReaderLogging(true);
    expect(seen).toEqual([false, true]);
    sub.unsubscribe();
  });

  it('toggles return and apply the new value', () => {
    expect(svc.togglePasteLogging()).toBe(true);
    expect(svc.pasteLogging).toBe(true);
    expect(svc.togglePasteLogging()).toBe(false);
    expect(svc.pasteLogging).toBe(false);
  });

  it('flags are independent', () => {
    svc.setOutputHexLogging(true);
    expect(svc.outputHexLogging).toBe(true);
    expect(svc.screenReaderLogging).toBe(false);
    expect(svc.pasteLogging).toBe(false);
  });
});
