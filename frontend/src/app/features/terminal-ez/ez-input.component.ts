import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  EventEmitter,
  inject,
  OnDestroy,
  OnInit,
  Output,
  signal,
  ViewChild,
} from '@angular/core';
import { Subscription } from 'rxjs';

import { MudService } from '@webmud3/frontend/core/mud/services/mud.service';

export type EzInputMode = 'default' | 'password' | 'editor';

/**
 * What gets emitted when the user submits a line.
 *
 * `mode` is what the wiring layer needs to branch on:
 *  - 'password' → must go out as a SecureString so the value never
 *                 ends up in logs, and **must not** be locally echoed.
 *  - 'default'  → plain `sendMessage(string)`, **with** local echo so
 *                 the user sees what they sent.
 *  - 'editor'   → plain `sendMessage(string)`, **without** local echo
 *                 because the MUD echoes each line itself in this mode.
 *
 * We keep the discriminator on the submission itself rather than
 * splitting into multiple events because the consuming shell tracks one
 * `(commit)` handler and branches once — fewer wires, harder to miswire.
 */
export interface EzInputSubmission {
  value: string;
  mode: EzInputMode;
}

const HISTORY_LIMIT = 100;

/**
 * Native, robust input component for the EZ-Shell (`/ez`).
 *
 * Three render modes, switched automatically based on TELNET state:
 *
 *  - default  : multi-line `<textarea>`, Enter sends, Shift+Enter adds newline,
 *               history via ▲/▼ buttons.
 *  - password : single-line `<input type="password">`, no history, never logged.
 *  - editor   : multi-line `<textarea>`, every Enter sends the current contents
 *               line-by-line immediately (MUD line-editor semantics, e.g. `ed`).
 *
 * Deliberate non-features (the whole point of `/ez`):
 *  - no `[(ngModel)]`, no FormsModule — values are read from the DOM only at
 *    submit time. This sidesteps the Mac-Safari freezes that the xterm
 *    helper-textarea / `MudInputController` pipeline triggers.
 *  - no `MudInputController`, no `attachCustomKeyEventHandler`. We are the
 *    input surface.
 */
@Component({
  selector: 'app-ez-input',
  standalone: true,
  templateUrl: './ez-input.component.html',
  styleUrls: ['./ez-input.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EzInputComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly mudService = inject(MudService);

  @Output() readonly commit = new EventEmitter<EzInputSubmission>();

  @ViewChild('defaultField')
  private readonly defaultField?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('passwordField')
  private readonly passwordField?: ElementRef<HTMLInputElement>;
  @ViewChild('editorField')
  private readonly editorField?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('modeAnnouncer', { static: true })
  private readonly modeAnnouncer!: ElementRef<HTMLDivElement>;

  // ---------------------------------------------------------------------------
  // Mode signals
  //
  // Initial defaults match what `MudClientComponent` assumes before the server
  // negotiates anything (isEditMode=true, showEcho=true) — i.e. start in the
  // default multi-line mode. The subscriptions in ngOnInit overwrite these as
  // soon as the server reports its actual state.
  // ---------------------------------------------------------------------------
  protected readonly isEditMode = signal(true);
  protected readonly showEcho = signal(true);

  protected readonly mode = computed<EzInputMode>(() => {
    if (!this.isEditMode()) return 'editor';
    if (!this.showEcho()) return 'password';
    return 'default';
  });

  // Heading text for the section's <h2> — visually hidden but read by AT
  // when the user navigates with the H key.
  protected readonly headingText = computed(() => {
    switch (this.mode()) {
      case 'password':
        return 'Passwort-Eingabe';
      case 'editor':
        return 'Editor-Modus aktiv — zeilenweise Eingabe';
      default:
        return 'Befehl-Eingabe';
    }
  });

  // ---------------------------------------------------------------------------
  // History (default mode only)
  // ---------------------------------------------------------------------------
  private history: string[] = [];
  // -1 means "no entry selected, user is editing a fresh line". Otherwise an
  // index into `history`; ▲ navigates toward 0, ▼ navigates back toward -1.
  private historyCursor = -1;
  // Snapshot of the unsent draft when the user first walks into history with ▲
  // so we can restore it on ▼ past the newest entry. Without this the draft
  // would be lost the moment the user starts browsing.
  private historyDraft: string | null = null;

  private subscriptions = new Subscription();

  constructor() {
    let prevMode: EzInputMode | null = null;
    // We hide the announcer until at least one transition has happened so the
    // initial render does not blurt out "Befehl-Eingabe" unprompted.
    effect(() => {
      const current = this.mode();
      const previous = prevMode;
      prevMode = current;
      if (previous === null || previous === current) {
        return;
      }
      queueMicrotask(() => {
        this.focusActiveField();
        this.announceModeChange(current);
      });
    });
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.mudService.linemode$.subscribe((state) => {
        this.isEditMode.set(state.edit);
      }),
    );
    this.subscriptions.add(
      this.mudService.showEcho$.subscribe((value) => {
        this.showEcho.set(value);
      }),
    );
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.focusActiveField());
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // ---------------------------------------------------------------------------
  // Default mode (multi-line textarea)
  // ---------------------------------------------------------------------------

  protected onDefaultKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      this.submitDefault();
    }
    // Shift+Enter: fall through — the browser inserts \n into the textarea
    // exactly as the user expects.
  }

  protected onDefaultSubmit(event: Event): void {
    event.preventDefault();
    this.submitDefault();
  }

  private submitDefault(): void {
    const field = this.defaultField?.nativeElement;
    if (!field) return;

    const raw = field.value;
    const lines = raw.split(/\r?\n/).filter((line) => line.length > 0);

    for (const line of lines) {
      this.commit.emit({ value: line, mode: 'default' });
      this.pushHistory(line);
    }

    field.value = '';
    this.resetDefaultHeight();
    this.historyCursor = -1;
    this.historyDraft = null;
    this.focusActiveField();
  }

  protected autoResizeDefault(): void {
    const field = this.defaultField?.nativeElement;
    if (!field) return;
    // Reset to auto first so shrinking is detected — otherwise scrollHeight
    // would stay at the previous expanded value.
    field.style.height = 'auto';
    field.style.height = `${field.scrollHeight}px`;
  }

  private resetDefaultHeight(): void {
    const field = this.defaultField?.nativeElement;
    if (!field) return;
    field.style.height = 'auto';
  }

  // ---------------------------------------------------------------------------
  // Password mode (single-line)
  // ---------------------------------------------------------------------------

  protected onPasswordSubmit(event: Event): void {
    event.preventDefault();
    const field = this.passwordField?.nativeElement;
    if (!field) return;

    const value = field.value;
    // Submit even an empty value — the user might be acknowledging an empty
    // password prompt. Lower-level layers can decide whether to reject it.
    this.commit.emit({ value, mode: 'password' });

    field.value = '';
    this.focusActiveField();
    // Deliberately NOT pushed to history. Passwords must never be retrievable
    // via the ▲/▼ buttons.
  }

  // ---------------------------------------------------------------------------
  // Editor mode (MUD linemode, e.g. `ed`)
  // ---------------------------------------------------------------------------

  protected onEditorKeydown(event: KeyboardEvent): void {
    // In editor mode ANY Enter (with or without modifiers) submits a line
    // immediately. Shift+Enter is intentionally not honored — otherwise the
    // user would silently accumulate a multi-line block that the editor
    // doesn't expect.
    if (event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    this.submitEditor();
  }

  protected onEditorSubmit(event: Event): void {
    event.preventDefault();
    this.submitEditor();
  }

  private submitEditor(): void {
    const field = this.editorField?.nativeElement;
    if (!field) return;

    const raw = field.value;
    // Editor semantics: empty lines are meaningful (paragraph breaks etc.),
    // so we do NOT filter them out the way default mode does.
    const lines = raw.split(/\r?\n/);

    for (const line of lines) {
      this.commit.emit({ value: line, mode: 'editor' });
    }

    field.value = '';
    this.focusActiveField();
    // Editor lines are not pushed to history either — history is for command
    // lines, not editor content, and would pollute the ▲ pile with chunks
    // the user never wants to recall as commands.
  }

  // ---------------------------------------------------------------------------
  // History (default mode only)
  // ---------------------------------------------------------------------------

  protected onHistoryBack(): void {
    if (this.history.length === 0) return;
    const field = this.defaultField?.nativeElement;
    if (!field) return;

    // Stash the unsent draft on first entry into history so ▼ past the
    // newest entry restores what the user was typing.
    if (this.historyCursor === -1) {
      this.historyDraft = field.value;
      this.historyCursor = this.history.length - 1;
    } else if (this.historyCursor > 0) {
      this.historyCursor -= 1;
    }

    field.value = this.history[this.historyCursor]!;
    this.autoResizeDefault();
    this.focusActiveField();
  }

  protected onHistoryForward(): void {
    const field = this.defaultField?.nativeElement;
    if (!field) return;

    if (this.historyCursor === -1) {
      // Already at the draft; nothing newer to walk to.
      return;
    }

    if (this.historyCursor < this.history.length - 1) {
      this.historyCursor += 1;
      field.value = this.history[this.historyCursor]!;
    } else {
      // Walked past the newest entry → restore draft (or empty).
      this.historyCursor = -1;
      field.value = this.historyDraft ?? '';
      this.historyDraft = null;
    }

    this.autoResizeDefault();
    this.focusActiveField();
  }

  private pushHistory(line: string): void {
    // Avoid pushing duplicate consecutive entries — `look\nlook\nlook` should
    // not flood the history pile with three identical lines.
    if (this.history[this.history.length - 1] === line) {
      return;
    }
    this.history.push(line);
    if (this.history.length > HISTORY_LIMIT) {
      this.history.shift();
    }
  }

  // ---------------------------------------------------------------------------
  // Focus + announcements
  // ---------------------------------------------------------------------------

  private focusActiveField(): void {
    const mode = this.mode();
    const target =
      mode === 'password'
        ? this.passwordField?.nativeElement
        : mode === 'editor'
          ? this.editorField?.nativeElement
          : this.defaultField?.nativeElement;
    if (!target) return;
    // Don't yank focus away from interactive elements the user is currently
    // engaged with (e.g. a footer-menu button being opened with the keyboard).
    // A textarea/input that's already focused is fine to re-focus — it's a
    // no-op anyway.
    const active = document.activeElement;
    if (
      active instanceof HTMLElement &&
      active !== target &&
      active.tagName === 'BUTTON' &&
      active.closest('app-ez-input') === null
    ) {
      return;
    }
    target.focus();
  }

  private announceModeChange(next: EzInputMode): void {
    const region = this.modeAnnouncer.nativeElement;
    // Two-step write so AT picks the change up reliably:
    // clear → microtask → set. Without the clear, identical re-announcements
    // (e.g. password→default→password) wouldn't be re-read by some screen
    // readers because the text content didn't actually change.
    region.textContent = '';
    queueMicrotask(() => {
      switch (next) {
        case 'password':
          region.textContent = 'Passwort-Eingabe aktiv.';
          break;
        case 'editor':
          region.textContent =
            'Editor-Modus aktiv. Jede Zeile wird beim Enter sofort gesendet.';
          break;
        case 'default':
          region.textContent =
            'Befehlseingabe aktiv. Enter sendet, Umschalt+Enter für Zeilenumbruch.';
          break;
      }
    });
  }
}
