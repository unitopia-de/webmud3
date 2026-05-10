import { TestBed } from '@angular/core/testing';

import { MxpChoiceMenuService } from './mxp-choice-menu.service';

describe('MxpChoiceMenuService', () => {
  let svc: MxpChoiceMenuService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(MxpChoiceMenuService);
  });

  it('starts closed', () => {
    expect(svc.current).toBeNull();
  });

  it('open() exposes the request via current and currentMenu$', () => {
    const onPick = jest.fn();
    svc.open({ commands: ['a', 'b'], x: 10, y: 20, onPick });
    expect(svc.current?.commands).toEqual(['a', 'b']);
  });

  it('close() drops the request without firing onPick', () => {
    const onPick = jest.fn();
    svc.open({ commands: ['a'], x: 0, y: 0, onPick });
    svc.close();
    expect(svc.current).toBeNull();
    expect(onPick).not.toHaveBeenCalled();
  });

  it('pick() fires onPick with the chosen command and closes', () => {
    const onPick = jest.fn();
    svc.open({ commands: ['nord', 'ost'], x: 0, y: 0, onPick });
    svc.pick('ost');
    expect(onPick).toHaveBeenCalledWith('ost');
    expect(svc.current).toBeNull();
  });

  it('pick() ignores commands not in the current request', () => {
    const onPick = jest.fn();
    svc.open({ commands: ['nord'], x: 0, y: 0, onPick });
    svc.pick('sued'); // not in the list
    expect(onPick).not.toHaveBeenCalled();
    expect(svc.current).not.toBeNull(); // menu stays open
  });

  it('pick() is a no-op when no menu is open', () => {
    expect(() => svc.pick('x')).not.toThrow();
  });

  it('open() while another menu is open replaces the request', () => {
    const onPickA = jest.fn();
    const onPickB = jest.fn();
    svc.open({ commands: ['a'], x: 0, y: 0, onPick: onPickA });
    svc.open({ commands: ['b'], x: 5, y: 5, onPick: onPickB });
    svc.pick('b');
    expect(onPickA).not.toHaveBeenCalled();
    expect(onPickB).toHaveBeenCalledWith('b');
  });
});
