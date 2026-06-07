import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';

import { GmcpService } from './gmcp.service';
import { InputCompletionService } from './input-completion.service';
import { InputGmcpModule } from './modules/input-gmcp.module';
import { MudSignalService } from './signals/mud-signal.service';

describe('InputCompletionService', () => {
  let send: jest.Mock;
  let signalSubjects: Map<string, Subject<any>>;
  let svc: InputCompletionService;

  function signal(name: string): Subject<any> {
    let s = signalSubjects.get(name);
    if (!s) {
      s = new Subject();
      signalSubjects.set(name, s);
    }
    return s;
  }

  beforeEach(() => {
    send = jest.fn();
    signalSubjects = new Map();
    const signals = { on: (name: string) => signal(name) };

    TestBed.configureTestingModule({
      providers: [
        { provide: GmcpService, useValue: { send } as unknown as GmcpService },
        {
          provide: MudSignalService,
          useValue: signals as unknown as MudSignalService,
        },
        { provide: InputGmcpModule, useValue: {} },
      ],
    });
    svc = TestBed.inject(InputCompletionService);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('sends Input.Complete with the buffer', () => {
    svc.requestCompletion('nimm sch');
    expect(send).toHaveBeenCalledWith('Input.Complete', 'nimm sch');
  });

  it('is a no-op for an empty buffer', () => {
    svc.requestCompletion('');
    expect(send).not.toHaveBeenCalled();
  });

  it('re-exposes a single completion on text$', () => {
    const seen: string[] = [];
    svc.text$.subscribe((t) => seen.push(t));
    signal('Input.CompleteText').next({ text: 'schwert' });
    expect(seen).toEqual(['schwert']);
  });

  it('re-exposes multiple options on choices$', () => {
    const seen: string[][] = [];
    svc.choices$.subscribe((c) => seen.push(c));
    signal('Input.CompleteChoice').next({ choices: ['schwert', 'schild'] });
    expect(seen).toEqual([['schwert', 'schild']]);
  });

  it('re-exposes "no match" on none$', () => {
    let count = 0;
    svc.none$.subscribe(() => (count += 1));
    signal('Input.CompleteNone').next({});
    expect(count).toBe(1);
  });
});
