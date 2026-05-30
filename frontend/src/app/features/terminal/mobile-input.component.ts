import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';

/**
 * Bridge interface so the mobile input does not need to import the full
 * MudInputController. Only the bits we actually use are required.
 */
export interface MobileInputHistoryProvider {
  getHistorySnapshot(): readonly string[];
  recordHistoryEntry(message: string): void;
}

/**
 * Native single-line input shown beneath the terminal when the user is on a
 * touch device (or has explicitly toggled the mobile input mode).
 *
 * Why this exists: xterm.js routes keystrokes through a hidden textarea, which
 * does not cooperate well with Android soft keyboards. Cursor keys, delete,
 * IME composition and word suggestions either fire the wrong events or none at
 * all. Using a real `<input>` lets the soft keyboard behave natively.
 *
 * Behaviour:
 *  - Enter on the field commits the text via the `commit` output (parent
 *    decides what to do with it — typically: send to the MUD, optionally echo
 *    locally, record in history).
 *  - The component owns no socket / history side-effects. History is read /
 *    appended through the supplied `historyProvider`, so this component and
 *    the regular xterm-driven input share one history source.
 *  - Up / Down buttons walk the history (without prefix filter; long-press for
 *    prefix is intentionally omitted to keep the UI simple — Alt+Up on a
 *    physical keyboard remains the prefix-search path).
 *  - Typing exits browse mode without rolling back the recalled buffer.
 */
@Component({
  selector: 'app-mobile-input',
  standalone: true,
  imports: [],
  templateUrl: './mobile-input.component.html',
  styleUrls: ['./mobile-input.component.scss'],
})
export class MobileInputComponent {
  @Input({ required: true }) historyProvider!: MobileInputHistoryProvider;

  /**
   * When false, the component renders the input as a password field so the
   * soft keyboard does not autocomplete / suggest. Set to false when the
   * server has disabled local echo (password prompt).
   */
  @Input() echoVisible = true;

  /** Emits the committed text. Parent decides how to forward it. */
  @Output() commit = new EventEmitter<string>();

  @ViewChild('field', { static: true })
  private fieldRef!: ElementRef<HTMLInputElement>;

  public value = '';

  /** Index into the history snapshot; -1 means "not browsing". */
  private historyIndex = -1;

  /** Buffer the user had typed before browse started; restored on Down past end. */
  private historyAnchor = '';

  /**
   * True while a (Mac/IME) composition is in progress. We deliberately skip
   * value updates during composition so the partial dead-key state isn't
   * sent prematurely; the final character lands via `compositionend`.
   */
  private composing = false;

  /**
   * Mirrors the native input value back into our component state. Replaces
   * the previous `[(ngModel)]` two-way binding, which exhibited a Safari
   * bug where rapid keystrokes occasionally landed in the DOM but not in
   * the bound property — leaving the user "stuck" with no apparent typing.
   * Reading directly from `event.target.value` sidesteps the ngModel
   * round-trip entirely.
   */
  public onInput(event: Event): void {
    if (this.composing) {
      // Composition in progress — wait for compositionend before mirroring.
      return;
    }

    const target = event.target as HTMLInputElement | null;
    if (target) {
      this.value = target.value;
    }

    this.exitBrowse();
  }

  public onCompositionStart(): void {
    this.composing = true;
  }

  public onCompositionEnd(event: CompositionEvent): void {
    this.composing = false;
    // The final composed value is in the input by now — pick it up so we
    // don't miss a character when the next input event doesn't fire (some
    // browsers swallow it after composition).
    const target = event.target as HTMLInputElement | null;
    if (target) {
      this.value = target.value;
    }

    this.exitBrowse();
  }

  public onSubmit(event?: Event): void {
    event?.preventDefault();

    const text = this.value;
    this.value = '';
    this.exitBrowse();

    this.commit.emit(text);

    // Refocus the field so the soft keyboard stays open for the next command.
    queueMicrotask(() => this.fieldRef.nativeElement.focus());
  }

  public onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey) {
      event.preventDefault();
      this.onSubmit();
    }
  }

  public onHistoryBack(): void {
    const history = this.historyProvider.getHistorySnapshot();
    if (history.length === 0) return;

    if (this.historyIndex === -1) {
      this.historyAnchor = this.value;
      this.historyIndex = history.length;
    }

    if (this.historyIndex > 0) {
      this.historyIndex -= 1;
      this.value = history[this.historyIndex];
      this.placeCursorAtEnd();
    }
  }

  public onHistoryForward(): void {
    if (this.historyIndex === -1) return;

    const history = this.historyProvider.getHistorySnapshot();

    if (this.historyIndex < history.length - 1) {
      this.historyIndex += 1;
      this.value = history[this.historyIndex];
    } else {
      this.value = this.historyAnchor;
      this.exitBrowse();
    }

    this.placeCursorAtEnd();
  }

  /** Move keyboard focus back onto the input (used when toggling mode). */
  public focus(): void {
    this.fieldRef.nativeElement.focus();
  }

  private exitBrowse(): void {
    this.historyIndex = -1;
    this.historyAnchor = '';
  }

  private placeCursorAtEnd(): void {
    queueMicrotask(() => {
      const el = this.fieldRef.nativeElement;
      const len = el.value.length;
      try {
        el.setSelectionRange(len, len);
      } catch {
        // Some input types reject setSelectionRange; ignore.
      }
      el.focus();
    });
  }
}
