import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import {
  NumpadBindings,
  NumpadKey,
  NumpadModifiers,
  NumpadService,
  isNumpadCode,
  numpadLayerId,
} from './numpad.service';

type Cell = {
  /** Logical key id (or null for empty grid cell) */
  key: NumpadKey | null;
  /** Label shown on the key (e.g. "8", "+") */
  label: string;
  /** Optional column-span hint (for the wide "0" key) */
  span?: number;
};

/**
 * 4-column grid mirroring a hardware numpad. `null` cells render empty
 * to preserve visual alignment.
 */
const LAYOUT: Cell[] = [
  // Row 1: /  *  _  _
  { key: 'NumpadDivide', label: '/' },
  { key: 'NumpadMultiply', label: '×' },
  { key: null, label: '' },
  { key: null, label: '' },
  // Row 2: 7  8  9  +
  { key: 'Numpad7', label: '7' },
  { key: 'Numpad8', label: '8' },
  { key: 'Numpad9', label: '9' },
  { key: 'NumpadAdd', label: '+' },
  // Row 3: 4  5  6  −
  { key: 'Numpad4', label: '4' },
  { key: 'Numpad5', label: '5' },
  { key: 'Numpad6', label: '6' },
  { key: 'NumpadSubtract', label: '−' },
  // Row 4: 1  2  3  _
  { key: 'Numpad1', label: '1' },
  { key: 'Numpad2', label: '2' },
  { key: 'Numpad3', label: '3' },
  { key: null, label: '' },
  // Row 5: 0(span 2)  ,  Enter
  { key: 'Numpad0', label: '0', span: 2 },
  { key: 'NumpadDecimal', label: ',' },
  { key: 'NumpadEnter', label: '⏎' },
];

@Component({
  selector: 'app-numpad-config',
  templateUrl: './numpad-config.component.html',
  styleUrls: ['./numpad-config.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NumpadConfigComponent {
  private readonly numpad = inject(NumpadService);

  public readonly layout = LAYOUT;
  public readonly editingKey = signal<NumpadKey | null>(null);
  public readonly editingValue = signal<string>('');

  /** Last command sent from the capture input (feedback line). */
  public readonly lastSent = signal<string>('');

  /** Currently selected modifier layer (toggled via the checkboxes). */
  public readonly mods = signal<NumpadModifiers>({
    shift: false,
    ctrl: false,
    alt: false,
    meta: false,
  });

  private readonly layers = toSignal(this.numpad.layers$, {
    initialValue: this.numpad.layers,
  });

  /** Bindings of the currently selected layer. */
  public readonly currentBindings = computed<NumpadBindings>(() => {
    const id = numpadLayerId(this.mods());
    return this.layers()[id] ?? {};
  });

  /** Human-readable label of the active layer (for the heading). */
  public readonly layerLabel = computed<string>(() => {
    const id = numpadLayerId(this.mods());
    return id === '' ? 'ohne Modifier' : id;
  });

  public toggleMod(mod: keyof NumpadModifiers): void {
    // Switching layer while editing would save into the wrong layer.
    this.cancelEdit();
    this.mods.update((m) => ({ ...m, [mod]: !m[mod] }));
  }

  public commandFor(key: NumpadKey | null): string {
    if (!key) return '';
    return this.currentBindings()[key] ?? '';
  }

  public onKeyClick(key: NumpadKey | null): void {
    if (!key || this.editingKey() !== null) return;
    this.numpad.trigger(key, this.mods());
  }

  public startEdit(key: NumpadKey | null, current: string, event: Event): void {
    event.stopPropagation();
    if (!key) return;
    this.editingKey.set(key);
    this.editingValue.set(current);
  }

  public saveEdit(): void {
    const key = this.editingKey();
    if (key === null) return;
    this.numpad.setBinding(
      numpadLayerId(this.mods()),
      key,
      this.editingValue(),
    );
    this.editingKey.set(null);
    this.editingValue.set('');
  }

  public cancelEdit(): void {
    this.editingKey.set(null);
    this.editingValue.set('');
  }

  public onResetClick(): void {
    this.numpad.resetToDefaults();
  }

  /**
   * Capture-input keydown: while the line is focused, real numpad keys fire
   * the bound command instead of typing. The layer is resolved from the held
   * modifier keys OR-ed with the active checkboxes (unified resolution). All
   * numpad keys are swallowed so the read-only line stays clean; other keys
   * (Tab etc.) pass through so the user can leave the field.
   */
  public onCaptureKeydown(event: KeyboardEvent): void {
    if (!isNumpadCode(event.code)) {
      return;
    }
    event.preventDefault();
    const sent = this.numpad.triggerFromEvent(event, this.mods());
    this.lastSent.set(sent ?? '(unbelegt)');
  }
}
