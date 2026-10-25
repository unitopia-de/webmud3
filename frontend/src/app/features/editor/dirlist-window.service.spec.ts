import { TestBed } from '@angular/core/testing';
import { FooterMenuService } from '@webmud3/frontend/features/footer/footer-menu.service';
import { GmcpService } from '@webmud3/frontend/features/gmcp/gmcp.service';
import { MudSignalService } from '@webmud3/frontend/features/gmcp/signals/mud-signal.service';
import { WindowService } from '@webmud3/frontend/features/windows/window.service';
import { WindowGeometryService } from '@webmud3/frontend/features/windows/window-geometry.service';
import { BehaviorSubject, Subject } from 'rxjs';

import { DirlistWindowService } from './dirlist-window.service';
import { FilesService } from './files.service';

const MENU_ID = 'dirlist-window';

/**
 * Deckt die Sichtbarkeitsregel des "Verzeichnis"-Eintrags ab.
 *
 * Der zweite Test ist eine Regression: Ein früherer `else`-Zweig entfernte
 * den Eintrag bei jedem `Char.Name` ohne `wizard` wieder. Da der MUD diese
 * Meldung mehrfach pro Verbindung schickt — unter anderem vor dem Einloggen,
 * wenn der Charakter noch unbekannt ist — verloren Götter den Eintrag beim
 * erneuten Anmelden in derselben Sitzung.
 */
describe('DirlistWindowService', () => {
  let charName: Subject<{ type: 'Char.Name'; wizard?: number }>;
  let active: BehaviorSubject<boolean>;
  let footer: FooterMenuService;

  beforeEach(() => {
    charName = new Subject();
    active = new BehaviorSubject<boolean>(true);

    const signals = {
      on: (name: string) => (name === 'Char.Name' ? charName : new Subject()),
    };

    TestBed.configureTestingModule({
      providers: [
        {
          provide: MudSignalService,
          useValue: signals as unknown as MudSignalService,
        },
        {
          provide: GmcpService,
          useValue: {
            active$: active.asObservable(),
            send: jest.fn(),
          } as unknown as GmcpService,
        },
        {
          provide: WindowService,
          useValue: {
            newWindow: jest.fn(),
            close: jest.fn(),
            focus: jest.fn(),
            getWindow: jest.fn(),
            windows$: new Subject(),
          } as unknown as WindowService,
        },
        {
          provide: FilesService,
          useValue: {
            getCurrentListing: () => null,
          } as unknown as FilesService,
        },
        {
          provide: WindowGeometryService,
          useValue: {
            load: () => undefined,
            save: jest.fn(),
          } as unknown as WindowGeometryService,
        },
      ],
    });

    footer = TestBed.inject(FooterMenuService);
    TestBed.inject(DirlistWindowService);
  });

  afterEach(() => TestBed.resetTestingModule());

  function menuIds(): string[] {
    let ids: string[] = [];
    footer.items$
      .subscribe((items) => (ids = items.map((i) => i.id)))
      .unsubscribe();
    return ids;
  }

  it('zeigt den Eintrag nicht, solange kein Gott angemeldet ist', () => {
    charName.next({ type: 'Char.Name' });

    expect(menuIds()).not.toContain(MENU_ID);
  });

  it('registriert den Eintrag, sobald Char.Name wizard meldet', () => {
    charName.next({ type: 'Char.Name', wizard: 1 });

    expect(menuIds()).toContain(MENU_ID);
  });

  it('behält den Eintrag bei einem späteren Char.Name ohne wizard', () => {
    charName.next({ type: 'Char.Name', wizard: 1 });
    // Der MUD schickt Char.Name erneut, diesmal ohne `wizard` — etwa die vor
    // dem Einloggen gesendete Meldung nach einem Reconnect.
    charName.next({ type: 'Char.Name' });

    expect(menuIds()).toContain(MENU_ID);
  });

  it('entfernt den Eintrag erst, wenn die GMCP-Sitzung endet', () => {
    charName.next({ type: 'Char.Name', wizard: 1 });
    expect(menuIds()).toContain(MENU_ID);

    active.next(false);

    expect(menuIds()).not.toContain(MENU_ID);
  });

  it('bringt den Eintrag nach einem Reconnect zurück', () => {
    charName.next({ type: 'Char.Name', wizard: 1 });
    active.next(false);
    active.next(true);
    // Nach dem Handshake schickt der MUD Char.Name erneut.
    charName.next({ type: 'Char.Name', wizard: 1 });

    expect(menuIds()).toContain(MENU_ID);
  });
});
