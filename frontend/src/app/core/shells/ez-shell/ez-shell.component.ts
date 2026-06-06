import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { MudService } from '@webmud3/frontend/core/mud/services/mud.service';
import { OutputHistoryService } from '@webmud3/frontend/shared/services/output-history.service';
import { ConnectionMenuService } from '@webmud3/frontend/features/connection/connection-menu.service';
import { WakeLockService } from '@webmud3/frontend/features/connection/wake-lock.service';
import { DirlistWindowService } from '@webmud3/frontend/features/editor/dirlist-window.service';
import { EditorWindowService } from '@webmud3/frontend/features/editor/editor-window.service';
import { CharFooterComponent } from '@webmud3/frontend/features/footer/char-footer.component';
import { FooterMenuService } from '@webmud3/frontend/features/footer/footer-menu.service';
import { InventoryWindowService } from '@webmud3/frontend/features/inventory/inventory-window.service';
import { NumpadWindowService } from '@webmud3/frontend/features/numpad/numpad-window.service';
import { PlayermapWindowService } from '@webmud3/frontend/features/playermap/playermap-window.service';
import { SettingsWindowService } from '@webmud3/frontend/features/settings/settings-window.service';
import { SoundService } from '@webmud3/frontend/features/sound/sound.service';
import { EzInputComponent, EzInputSubmission } from '@webmud3/frontend/features/terminal-ez/ez-input.component';
import { EzOutputComponent } from '@webmud3/frontend/features/terminal-ez/ez-output.component';
import { StickyInputService } from '@webmud3/frontend/features/terminal-ez/sticky-input.service';
import { PerfHudService } from '@webmud3/frontend/features/terminal-ez/perf-hud.service';
import { QuietOutputService } from '@webmud3/frontend/features/terminal-ez/quiet-output.service';
import {
  MxpChoiceMenuComponent,
  TerminalThemeService,
  TERMINAL_THEME_ORDER,
  TERMINAL_THEMES,
} from '@webmud3/frontend/features/terminal';
import {
  SoundLibraryWindowService,
  TriggerConfigWindowService,
} from '@webmud3/frontend/features/triggers';
import { WindowContainerComponent } from '@webmud3/frontend/features/windows/window-container.component';
import { WindowService } from '@webmud3/frontend/features/windows/window.service';

/**
 * Splitscreen-Variante des MUD-Clients unter `/ez`.
 *
 * Phase 5: Output + native Eingabezeile + echtes MudService-Wiring +
 * Footer + Window-Container + Footer-Menü-Einträge für Themes / Sound /
 * Fenster-Recentern + ein Wechsel-zu-Classic-Eintrag (ersetzt den
 * Mobile-Input-Eintrag, der hier keinen Sinn ergibt).
 *
 * Die Window-Services (Settings, Editor, Inventar, Numpad, Playermap,
 * Triggers, Sound-Library, Dirlist, Connection-Menü) sind root-singletons
 * und registrieren ihre Menü-Einträge im Konstruktor. Wir injecten sie
 * hier ausschließlich für den Side-Effect, damit sie auch dann
 * instantiiert werden, wenn der User `/ez` direkt aufruft, ohne dass
 * die Classic-Shell jemals gemountet wurde.
 *
 * Connection-Lifecycle:
 *  - Beim Mount: nur connecten, wenn `mudService` noch keine
 *    aktive Telnet-Session hält.
 *  - Beim Destroy: **kein** `disconnect()` — der Wechsel zurück nach `/`
 *    soll die Session behalten.
 *
 * Diese Datei darf nichts vom bestehenden xterm-Eingabe-Pfad
 * (`MudInputController`, Helper-Textarea, `MobileInputComponent`)
 * importieren oder anstoßen.
 */
@Component({
  selector: 'app-ez-shell',
  templateUrl: './ez-shell.component.html',
  styleUrls: ['./ez-shell.component.scss'],
  imports: [
    EzOutputComponent,
    EzInputComponent,
    CharFooterComponent,
    WindowContainerComponent,
    MxpChoiceMenuComponent,
  ],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EzShellComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly mudService = inject(MudService);
  private readonly outputHistory = inject(OutputHistoryService);
  private readonly footerMenu = inject(FooterMenuService);
  private readonly windowService = inject(WindowService);
  private readonly soundService = inject(SoundService);
  private readonly terminalThemes = inject(TerminalThemeService);
  private readonly wakeLock = inject(WakeLockService);
  private readonly stickyInput = inject(StickyInputService);
  private readonly perfHud = inject(PerfHudService);
  private readonly quietOutput = inject(QuietOutputService);
  private readonly router = inject(Router);

  // ---------------------------------------------------------------------------
  // Side-effect injects — these root-singleton services register their
  // own footer-menu entries in their constructors. Injecting them here
  // ensures the entries appear even when the user opened `/ez` directly
  // and the Classic shell was never mounted. If Classic *was* mounted
  // earlier, these are no-ops (the constructor only runs once).
  //
  // We prefix with `_` so the linter doesn't flag the unused symbols —
  // they're intentionally only here for the side-effect.
  // ---------------------------------------------------------------------------
  private readonly _settingsWindow = inject(SettingsWindowService);
  private readonly _editorWindow = inject(EditorWindowService);
  private readonly _dirlistWindow = inject(DirlistWindowService);
  private readonly _inventoryWindow = inject(InventoryWindowService);
  private readonly _numpadWindow = inject(NumpadWindowService);
  private readonly _playermapWindow = inject(PlayermapWindowService);
  private readonly _triggerConfigWindow = inject(TriggerConfigWindowService);
  private readonly _soundLibraryWindow = inject(SoundLibraryWindowService);
  private readonly _connectionMenu = inject(ConnectionMenuService);

  @ViewChild(EzOutputComponent, { static: true })
  private readonly ezOutput!: EzOutputComponent;

  // Footer-menu IDs. Identical to the ones MudClient uses — the router
  // mounts only one shell at a time, so there's no risk of a duplicate
  // registration. Each shell unregisters in its ngOnDestroy.
  private readonly RECENTER_MENU_ID = 'windows-recenter';
  private readonly SOUND_MENU_ID = 'sound-enabled';
  private readonly THEME_PARENT_MENU_ID = 'terminal-theme';
  private readonly THEME_MENU_PREFIX = 'terminal-theme:';
  // EZ-specific: replaces MudClient's "Eingabezeile (Mobile)" entry —
  // mobile input has no purpose here because `/ez` IS the native input.
  private readonly SHELL_SWITCH_MENU_ID = 'shell-switch-classic';
  // Opens the static help page (`/hilfe`). Same id in both shells; only one
  // shell is mounted at a time, so there is no duplicate registration.
  private readonly HILFE_MENU_ID = 'hilfe';
  // EZ-only toggle: keep the just-sent command in the input line, selected,
  // so bare Enter repeats it (Idee 1). The classic shell never registers this.
  private readonly STICKY_INPUT_MENU_ID = 'ez-sticky-input';
  // EZ-only diagnostics toggle: shows the on-screen performance HUD. The only
  // way to enable it once installed as a PWA (no address bar for `?perf=1`),
  // and reachable by VoiceOver so a blind tester can switch it on too.
  private readonly PERF_HUD_MENU_ID = 'ez-perf-hud';
  // EZ-only toggle: "quiet output" mode — coalesces announcements and shrinks
  // the screen-reader DOM so iOS VoiceOver doesn't stall on heavy output. Off
  // by default (keeps the validated NVDA/JAWS behaviour).
  private readonly QUIET_OUTPUT_MENU_ID = 'ez-quiet-output';

  private readonly subscriptions = new Subscription();

  ngOnInit(): void {
    this.registerShellMenus();
  }

  ngAfterViewInit(): void {
    // Idempotent connect — see class doc.
    if (!this.mudService.isConnected) {
      const { columns, rows } = this.ezOutput.getDimensions();
      this.mudService.connect({ columns, rows });
    }

    // Hold a screen wake lock so iOS Safari / Android Chrome don't suspend
    // the tab and drop the socket. Idempotent — see WakeLockService.acquire.
    void this.wakeLock.acquire();

    // Expose WindowService on `window` for ad-hoc debugging, same trick
    // ClassicShell uses. Last shell that mounted wins; that's fine.
    (window as unknown as Record<string, unknown>)['__windowService'] =
      this.windowService;
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.footerMenu.unregister(this.RECENTER_MENU_ID);
    this.footerMenu.unregister(this.SOUND_MENU_ID);
    this.footerMenu.unregister(this.THEME_PARENT_MENU_ID);
    this.footerMenu.unregister(this.SHELL_SWITCH_MENU_ID);
    this.footerMenu.unregister(this.HILFE_MENU_ID);
    this.footerMenu.unregister(this.STICKY_INPUT_MENU_ID);
    this.footerMenu.unregister(this.PERF_HUD_MENU_ID);
    this.footerMenu.unregister(this.QUIET_OUTPUT_MENU_ID);
    // No mudService.disconnect — the user expects the telnet session to
    // survive a route switch to `/`. Explicit disconnect lives in the
    // ConnectionMenuService (footer menu).
    void this.wakeLock.release();
  }

  protected onCommit(submission: EzInputSubmission): void {
    switch (submission.mode) {
      case 'password':
        // SecureString path: never echo, never log, never persist.
        // Passwords have no business in the localStorage backlog.
        this.mudService.sendMessage({ value: submission.value });
        // Start buffering the post-login block NOW, before the server
        // responds. The server sends "du warst zuletzt eingeloggt …" + room
        // before re-enabling echo, so an echo-edge trigger inside EzOutput
        // would fire too late and miss it. The submit is the reliable early
        // signal. EzOutput collects the whole burst and announces it once it
        // settles, so VoiceOver reads it uninterrupted.
        this.ezOutput.primeForLogin();
        return;

      case 'default':
        this.mudService.sendMessage(submission.value);
        this.ezOutput.writeLocalEcho(submission.value);
        // Persist the input so the backlog re-injection on the next route
        // switch shows the same line the user actually typed. Stored as
        // `value\r\n` (without a prompt prefix; EZ has no prompt-manager).
        this.outputHistory.appendInputLine(`${submission.value}\r\n`);
        return;

      case 'editor':
        // Server echoes the line itself in editor mode, so no local echo.
        // We still persist the input line so the backlog matches what
        // the user typed even when the server's echo arrives in a
        // separate chunk during a later session.
        this.mudService.sendMessage(submission.value);
        this.outputHistory.appendInputLine(`${submission.value}\r\n`);
        return;
    }
  }

  private registerShellMenus(): void {
    // "Wechsel zu klassisch": navigates back to `/` so a user who hit
    // the EZ mode by mistake can get out without typing the URL. Note
    // that the telnet session is preserved across the switch (Phase 8
    // formalises the persistence — for Phase 5 the singleton property
    // of MudService already handles this).
    this.footerMenu.register({
      id: this.SHELL_SWITCH_MENU_ID,
      label: 'Eingabe-Modus: klassisch',
      checked: false,
      action: () => void this.router.navigate(['/']),
    });

    // Help page. Pinned to the bottom of the menu (high order value).
    this.footerMenu.register({
      id: this.HILFE_MENU_ID,
      label: 'Hilfe',
      order: 900,
      checked: false,
      action: () => void this.router.navigate(['/hilfe']),
    });

    // Sticky input line (Idee 1) — EZ-only. Keeps the just-sent command in
    // the line, fully selected, so bare Enter repeats it.
    this.footerMenu.register({
      id: this.STICKY_INPUT_MENU_ID,
      label: 'Eingabezeile stehen lassen',
      checked: this.stickyInput.enabled,
      action: () => this.stickyInput.toggle(),
    });

    // Quiet output mode (VoiceOver). Off by default; toggling coalesces
    // announcements and shrinks the screen-reader DOM in EzOutput.
    this.footerMenu.register({
      id: this.QUIET_OUTPUT_MENU_ID,
      label: 'Ruhige Ausgabe (VoiceOver)',
      checked: this.quietOutput.enabled(),
      action: () => {
        const on = this.quietOutput.toggle();
        this.footerMenu.setChecked(this.QUIET_OUTPUT_MENU_ID, on);
      },
    });

    // Performance-HUD (Diagnose). Off by default; toggling shows/hides the
    // on-screen diagnostics overlay in EzOutput.
    this.footerMenu.register({
      id: this.PERF_HUD_MENU_ID,
      label: 'Performance-Anzeige',
      checked: this.perfHud.enabled(),
      action: () => {
        const on = this.perfHud.toggle();
        this.footerMenu.setChecked(this.PERF_HUD_MENU_ID, on);
      },
    });

    this.footerMenu.register({
      id: this.RECENTER_MENU_ID,
      label: 'Fenster ins Bild',
      checked: false,
      action: () => this.windowService.bringAllIntoView(),
    });

    this.footerMenu.register({
      id: this.SOUND_MENU_ID,
      label: 'Sound',
      checked: this.soundService.enabled,
      action: () => this.soundService.toggle(),
    });

    const activeThemeId = this.terminalThemes.themeId;
    this.footerMenu.register({
      id: this.THEME_PARENT_MENU_ID,
      label: 'Farben',
      // Same `order: 0` as MudClient so the Farben submenu pins to the
      // top regardless of how the window-services registered themselves.
      order: 0,
      children: TERMINAL_THEME_ORDER.map((id) => {
        const def = TERMINAL_THEMES[id];
        return {
          id: `${this.THEME_MENU_PREFIX}${id}`,
          label: def.label,
          checked: id === activeThemeId,
          action: () => this.terminalThemes.setTheme(id),
        };
      }),
    });

    // Keep the menu's `checked` flag in sync when sound is toggled from
    // elsewhere (e.g. the GMCP Sound module on (re)connect).
    this.subscriptions.add(
      this.soundService.enabled$.subscribe((enabled) => {
        this.footerMenu.setChecked(this.SOUND_MENU_ID, enabled);
      }),
    );

    // Keep the sticky-input menu check in sync if toggled elsewhere.
    this.subscriptions.add(
      this.stickyInput.enabled$.subscribe((enabled) => {
        this.footerMenu.setChecked(this.STICKY_INPUT_MENU_ID, enabled);
      }),
    );

    this.subscriptions.add(
      this.terminalThemes.themeId$.subscribe((activeId) => {
        for (const id of TERMINAL_THEME_ORDER) {
          this.footerMenu.setChecked(
            `${this.THEME_MENU_PREFIX}${id}`,
            id === activeId,
          );
        }
      }),
    );
  }
}
