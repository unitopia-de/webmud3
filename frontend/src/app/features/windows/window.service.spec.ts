import { WindowAction, WindowConfig, WindowEvent } from './window-config';
import { WindowService } from './window.service';

describe('WindowService', () => {
  let service: WindowService;
  let emittedWindows: WindowConfig[][];

  beforeEach(() => {
    service = new WindowService();
    emittedWindows = [];
    service.windows$.subscribe((configs) => {
      emittedWindows.push([...configs]);
    });
  });

  describe('open()', () => {
    it('should create a window with a unique ID', () => {
      const id = service.open({ title: 'Test', componentType: 'TestComp' });
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should add the window to the registry', () => {
      const id = service.open({ title: 'Test', componentType: 'TestComp' });
      const config = service.getConfig(id);
      expect(config).toBeDefined();
      expect(config?.title).toBe('Test');
      expect(config?.componentType).toBe('TestComp');
      expect(config?.visible).toBe(true);
    });

    it('should emit the new window via windows$', () => {
      service.open({ title: 'A', componentType: 'CompA' });

      // First emission is empty (BehaviorSubject initial), second has the window
      const last = emittedWindows[emittedWindows.length - 1];
      expect(last.length).toBe(1);
      expect(last[0].title).toBe('A');
    });

    it('should assign incrementing z-index', () => {
      const idA = service.open({ title: 'A', componentType: 'CompA' });
      const idB = service.open({ title: 'B', componentType: 'CompB' });

      const cfgA = service.getConfig(idA);
      const cfgB = service.getConfig(idB);

      expect(cfgB!.zIndex).toBeGreaterThan(cfgA!.zIndex);
    });

    it('should stagger default positions', () => {
      const idA = service.open({ title: 'A', componentType: 'CompA' });
      const idB = service.open({ title: 'B', componentType: 'CompB' });

      const cfgA = service.getConfig(idA);
      const cfgB = service.getConfig(idB);

      expect(cfgB!.position.x).toBeGreaterThan(cfgA!.position.x);
      expect(cfgB!.position.y).toBeGreaterThan(cfgA!.position.y);
    });

    it('should apply partial config overrides', () => {
      const id = service.open({
        title: 'Custom',
        componentType: 'Comp',
        allowSave: true,
        showCancel: false,
        position: { x: 100, y: 200 },
      });

      const config = service.getConfig(id);
      expect(config?.allowSave).toBe(true);
      expect(config?.showCancel).toBe(false);
      expect(config?.position).toEqual({ x: 100, y: 200 });
    });
  });

  describe('close()', () => {
    it('should remove the window from the registry', () => {
      const id = service.open({ title: 'Test', componentType: 'TestComp' });
      service.close(id);

      expect(service.getConfig(id)).toBeUndefined();

      const last = emittedWindows[emittedWindows.length - 1];
      expect(last.length).toBe(0);
    });

    it('should close child windows recursively', () => {
      const parentId = service.open({
        title: 'Parent',
        componentType: 'CompP',
      });
      const childId = service.open({
        title: 'Child',
        componentType: 'CompC',
        parentWindowId: parentId,
      });

      service.close(parentId);

      expect(service.getConfig(parentId)).toBeUndefined();
      expect(service.getConfig(childId)).toBeUndefined();
    });

    it('should emit CloseParent event to outgoingEvents$', () => {
      const events: WindowEvent[] = [];
      service.outgoingEvents$.subscribe((e) => events.push(e));

      const id = service.open({ title: 'Test', componentType: 'TestComp' });
      service.close(id);

      expect(events.some((e) => e.action === WindowAction.CloseParent)).toBe(
        true,
      );
    });
  });

  describe('focus()', () => {
    it('should give the focused window a higher z-index', () => {
      const idA = service.open({ title: 'A', componentType: 'CompA' });
      const idB = service.open({ title: 'B', componentType: 'CompB' });

      const zBefore = service.getConfig(idA)!.zIndex;
      service.focus(idA);
      const zAfter = service.getConfig(idA)!.zIndex;

      expect(zAfter).toBeGreaterThan(zBefore);
      expect(zAfter).toBeGreaterThan(service.getConfig(idB)!.zIndex);
    });
  });

  describe('updatePosition()', () => {
    it('should update the window position', () => {
      const id = service.open({ title: 'Test', componentType: 'TestComp' });
      service.updatePosition(id, 300, 400);

      expect(service.getConfig(id)?.position).toEqual({ x: 300, y: 400 });
    });
  });

  describe('updateSize()', () => {
    it('should update the window size', () => {
      const id = service.open({ title: 'Test', componentType: 'TestComp' });
      service.updateSize(id, 500, 350);

      expect(service.getConfig(id)?.size).toEqual({
        width: 500,
        height: 350,
      });
    });
  });

  describe('updateData()', () => {
    it('should update the data payload', () => {
      const id = service.open({ title: 'Test', componentType: 'TestComp' });
      const testData = { foo: 'bar', count: 42 };
      service.updateData(id, testData);

      expect(service.getConfig(id)?.data).toEqual(testData);
    });
  });

  describe('closeAll()', () => {
    it('should remove all windows', () => {
      service.open({ title: 'A', componentType: 'CompA' });
      service.open({ title: 'B', componentType: 'CompB' });
      service.open({ title: 'C', componentType: 'CompC' });

      service.closeAll();

      const last = emittedWindows[emittedWindows.length - 1];
      expect(last.length).toBe(0);
    });
  });

  describe('incomingEvents$ handling', () => {
    it('should close window on Hide event', () => {
      const id = service.open({ title: 'Test', componentType: 'TestComp' });

      service.incomingEvents$.next({
        action: WindowAction.Hide,
        windowId: id,
      });

      expect(service.getConfig(id)).toBeUndefined();
    });

    it('should close window on Cancel event', () => {
      const id = service.open({ title: 'Test', componentType: 'TestComp' });

      service.incomingEvents$.next({
        action: WindowAction.Cancel,
        windowId: id,
      });

      expect(service.getConfig(id)).toBeUndefined();
    });

    it('should focus window on Focus event', () => {
      const idA = service.open({ title: 'A', componentType: 'CompA' });
      const idB = service.open({ title: 'B', componentType: 'CompB' });

      service.incomingEvents$.next({
        action: WindowAction.Focus,
        windowId: idA,
      });

      expect(service.getConfig(idA)!.zIndex).toBeGreaterThan(
        service.getConfig(idB)!.zIndex,
      );
    });

    it('should forward Save event to outgoingEvents$', () => {
      const events: WindowEvent[] = [];
      service.outgoingEvents$.subscribe((e) => events.push(e));

      const id = service.open({ title: 'Test', componentType: 'TestComp' });

      service.incomingEvents$.next({
        action: WindowAction.Save,
        windowId: id,
      });

      expect(events.some((e) => e.action === WindowAction.Save)).toBe(true);
    });
  });
});
