import { CommonModule, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  ViewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';

import {
  compileTrigger,
  type Trigger,
  type TriggerAction,
  type TriggerDraft,
} from './models/trigger';
import { SoundLibraryService } from './sound-library.service';
import { SoundPlayerService } from './sound-player.service';
import { TriggerService } from './trigger.service';

type ActionKind = 'highlight' | 'sound';

interface PreviewSegment {
  text: string;
  matched: boolean;
  style?: Record<string, string>;
}

/**
 * UI for the user's trigger list — modeless window, registered under
 * `'trigger-config'` in WINDOW_COMPONENTS.
 *
 * State is held in signals so binding plays nicely with `[(ngModel)]` and
 * computed test previews recompute as the user types. The signals are
 * intentionally per-field rather than a single object signal so each
 * `(ngModelChange)` is cheap and doesn't fan out into unrelated updates.
 */
@Component({
  selector: 'app-trigger-config',
  templateUrl: './trigger-config.component.html',
  styleUrls: ['./trigger-config.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TriggerConfigComponent {
  private readonly triggers = inject(TriggerService);
  private readonly library = inject(SoundLibraryService);
  private readonly player = inject(SoundPlayerService);

  // ---- Lists & settings as signals via toSignal -----------------------------
  public readonly triggerList = toSignal(this.triggers.triggers$, {
    initialValue: this.triggers.triggers,
  });
  public readonly settings = toSignal(this.triggers.settings$, {
    initialValue: this.triggers.settings,
  });
  public readonly builtinSounds = toSignal(this.library.builtin$, {
    initialValue: this.library.builtin,
  });
  public readonly personalSounds = toSignal(this.library.personal$, {
    initialValue: this.library.personal,
  });

  // ---- Editor state ---------------------------------------------------------
  public readonly editorOpen = signal<boolean>(false);
  /** `undefined` while creating a new trigger, the id while editing. */
  private readonly editingId = signal<string | undefined>(undefined);
  public readonly nameField = signal<string>('');
  public readonly patternField = signal<string>('');
  public readonly flagsField = signal<string>('i');
  public readonly enabledField = signal<boolean>(true);
  public readonly actionKindField = signal<ActionKind>('highlight');
  public readonly foregroundField = signal<string>('#ffcc00');
  public readonly backgroundField = signal<string>('');
  public readonly boldField = signal<boolean>(false);
  public readonly soundIdField = signal<string>('builtin:alert');
  public readonly volumeField = signal<number>(1);
  public readonly testInput = signal<string>('');
  public readonly saveError = signal<string>('');
  public readonly importError = signal<string>('');

  @ViewChild('importInput') importInput?: ElementRef<HTMLInputElement>;

  public readonly isEditing = computed(() => this.editingId() !== undefined);

  /**
   * Compile-time view on the pattern. Used to surface regex errors
   * immediately rather than waiting for save.
   */
  public readonly compileError = computed(() => {
    if (!this.editorOpen()) return '';
    const r = compileTrigger(this.patternField(), this.flagsField());
    return r.ok ? '' : r.error;
  });

  /**
   * Highlighted preview of {@link testInput} against the current editor
   * pattern. Sound triggers render the matched substring with a dashed
   * outline so the user can still see what would have fired.
   */
  public readonly previewSegments = computed<PreviewSegment[]>(() => {
    if (!this.editorOpen()) return [];
    const input = this.testInput();
    if (input.length === 0) return [{ text: '', matched: false }];

    const r = compileTrigger(this.patternField(), this.flagsField());
    if (!r.ok) return [{ text: input, matched: false }];

    const matches: Array<{ start: number; end: number }> = [];
    r.regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = r.regex.exec(input)) !== null) {
      if (m[0].length === 0) {
        r.regex.lastIndex = m.index + 1;
        continue;
      }
      matches.push({ start: m.index, end: m.index + m[0].length });
      if (matches.length >= 32) break;
    }

    const style = this.previewStyleForCurrentAction();
    const segments: PreviewSegment[] = [];
    let cursor = 0;

    for (const match of matches) {
      if (match.start > cursor) {
        segments.push({
          text: input.slice(cursor, match.start),
          matched: false,
        });
      }
      segments.push({
        text: input.slice(match.start, match.end),
        matched: true,
        style,
      });
      cursor = match.end;
    }
    if (cursor < input.length) {
      segments.push({ text: input.slice(cursor), matched: false });
    }
    return segments;
  });

  public readonly matchCount = computed(
    () => this.previewSegments().filter((s) => s.matched).length,
  );

  // ---- List interactions ----------------------------------------------------

  public toggleEnabled(t: Trigger): void {
    try {
      this.triggers.update(t.id, { enabled: !t.enabled });
    } catch (err) {
      console.warn('[TriggerConfig] toggle failed', err);
    }
  }

  public deleteTrigger(t: Trigger): void {
    // window.confirm is the simplest match for the inventory/numpad UX style.
    const ok = window.confirm(`Trigger "${t.name}" wirklich löschen?`);
    if (ok) {
      this.triggers.delete(t.id);
    }
  }

  public setGloballyEnabled(enabled: boolean): void {
    this.triggers.setGloballyEnabled(enabled);
  }

  public setMasterVolume(volume: number): void {
    this.triggers.setMasterVolume(volume);
  }

  public moveUp(t: Trigger): void {
    const list = this.triggerList();
    const idx = list.findIndex((x) => x.id === t.id);
    if (idx > 0) {
      this.triggers.reorder(t.id, idx - 1);
    }
  }

  public moveDown(t: Trigger): void {
    const list = this.triggerList();
    const idx = list.findIndex((x) => x.id === t.id);
    if (idx >= 0 && idx < list.length - 1) {
      this.triggers.reorder(t.id, idx + 1);
    }
  }

  /**
   * Saves the current trigger list as a JSON file. Uses a transient anchor
   * element + object URL — no library, no router involvement.
   */
  public exportJson(): void {
    const data = JSON.stringify(this.triggers.triggers, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `triggers-${dateStamp()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Opens the hidden file input for importing a trigger JSON file. */
  public openImportPicker(): void {
    this.importError.set('');
    this.importInput?.nativeElement.click();
  }

  /**
   * Reads the chosen JSON file and appends every valid trigger to the
   * existing list. Invalid entries are skipped; bad regex patterns surface
   * as service errors and are aggregated into a single summary message.
   */
  public async onImportFileChosen(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) return;

    try {
      const raw = await readFileAsText(file);
      const parsed = JSON.parse(raw) as unknown;

      if (!Array.isArray(parsed)) {
        throw new Error('Datei enthält keine Trigger-Liste (Array erwartet).');
      }

      const errors: string[] = [];
      let imported = 0;

      for (const entry of parsed) {
        const draft = toDraftOrNull(entry);
        if (draft === null) {
          errors.push('Ein Eintrag wurde übersprungen (ungültige Struktur).');
          continue;
        }
        try {
          this.triggers.create(draft);
          imported++;
        } catch (err) {
          errors.push(
            `"${draft.name}": ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      if (errors.length > 0) {
        this.importError.set(
          `${imported} importiert. Fehler: ${errors.slice(0, 3).join(' • ')}` +
            (errors.length > 3 ? ` (+${errors.length - 3} weitere)` : ''),
        );
      }
    } catch (err) {
      this.importError.set(
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  public actionSummary(action: TriggerAction): string {
    if (action.kind === 'highlight') {
      const parts: string[] = [];
      if (action.foreground) parts.push(action.foreground);
      if (action.background) parts.push(`bg ${action.background}`);
      if (action.bold) parts.push('bold');
      return parts.length === 0 ? 'Highlight' : parts.join(', ');
    }
    return action.soundId;
  }

  // ---- Editor ---------------------------------------------------------------

  public openNew(): void {
    this.editingId.set(undefined);
    this.resetFields();
    this.saveError.set('');
    this.editorOpen.set(true);
  }

  public openEdit(t: Trigger): void {
    this.editingId.set(t.id);
    this.nameField.set(t.name);
    this.patternField.set(t.pattern);
    this.flagsField.set(t.flags);
    this.enabledField.set(t.enabled);

    const action = t.action;
    this.actionKindField.set(action.kind);
    if (action.kind === 'highlight') {
      this.foregroundField.set(action.foreground ?? '');
      this.backgroundField.set(action.background ?? '');
      this.boldField.set(action.bold ?? false);
    } else {
      this.soundIdField.set(action.soundId);
      this.volumeField.set(action.volume ?? 1);
    }

    this.saveError.set('');
    this.editorOpen.set(true);
  }

  public closeEditor(): void {
    this.editorOpen.set(false);
    this.saveError.set('');
  }

  public save(): void {
    const action: TriggerAction = this.buildAction();
    const draft = {
      name: this.nameField().trim() || 'Unbenannt',
      pattern: this.patternField(),
      flags: this.flagsField(),
      action,
      enabled: this.enabledField(),
    };

    try {
      const id = this.editingId();
      if (id === undefined) {
        this.triggers.create(draft);
      } else {
        this.triggers.update(id, draft);
      }
      this.closeEditor();
    } catch (err) {
      this.saveError.set(err instanceof Error ? err.message : String(err));
    }
  }

  /** Plays the currently selected sound — preview button next to the dropdown. */
  public previewSound(): void {
    if (this.actionKindField() !== 'sound') return;
    this.player.play(this.soundIdField(), this.volumeField());
  }

  /** Clears only the background colour (the input always returns a value). */
  public clearBackground(): void {
    this.backgroundField.set('');
  }

  // ---- Internal helpers -----------------------------------------------------

  private buildAction(): TriggerAction {
    if (this.actionKindField() === 'highlight') {
      const fg = this.foregroundField().trim();
      const bg = this.backgroundField().trim();
      return {
        kind: 'highlight',
        ...(fg ? { foreground: fg } : {}),
        ...(bg ? { background: bg } : {}),
        bold: this.boldField(),
      };
    }
    return {
      kind: 'sound',
      soundId: this.soundIdField(),
      volume: this.volumeField(),
    };
  }

  private resetFields(): void {
    this.nameField.set('');
    this.patternField.set('');
    this.flagsField.set('i');
    this.enabledField.set(true);
    this.actionKindField.set('highlight');
    this.foregroundField.set('#ffcc00');
    this.backgroundField.set('');
    this.boldField.set(false);
    this.soundIdField.set(
      this.builtinSounds()[0]
        ? `builtin:${this.builtinSounds()[0].id}`
        : 'builtin:alert',
    );
    this.volumeField.set(1);
  }

  private previewStyleForCurrentAction(): Record<string, string> {
    if (this.actionKindField() === 'highlight') {
      const style: Record<string, string> = {};
      const fg = this.foregroundField().trim();
      const bg = this.backgroundField().trim();
      if (fg) style['color'] = fg;
      if (bg) style['background-color'] = bg;
      if (this.boldField()) style['font-weight'] = 'bold';
      return style;
    }
    return {
      outline: '1px dashed currentColor',
      'outline-offset': '1px',
    };
  }
}

/** Filename helper: `YYYY-MM-DD` for the export download. */
function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * `File.text()` is missing in jsdom (and older browsers), so we read via
 * the `FileReader` API which is widely available and works under test.
 */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Unexpected FileReader result type'));
        return;
      }
      resolve(result);
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsText(file);
  });
}

/**
 * Best-effort coercion of an unknown record (from JSON.parse) into a valid
 * `TriggerDraft`. Returns `null` for entries that don't fit the shape — the
 * caller skips them rather than aborting the whole import.
 */
function toDraftOrNull(value: unknown): TriggerDraft | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;

  if (typeof v['name'] !== 'string') return null;
  if (typeof v['pattern'] !== 'string') return null;
  if (typeof v['flags'] !== 'string') return null;

  const action = v['action'];
  if (typeof action !== 'object' || action === null) return null;
  const kind = (action as Record<string, unknown>)['kind'];
  if (kind !== 'highlight' && kind !== 'sound') return null;

  return {
    name: v['name'],
    pattern: v['pattern'],
    flags: v['flags'],
    action: action as TriggerAction,
    enabled: v['enabled'] !== false,
  };
}
