import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import {
  ALLOWED_MIME_TYPES,
  MAX_PERSONAL_SOUND_BYTES,
  MAX_PERSONAL_TOTAL_BYTES,
  SoundLibraryService,
} from './sound-library.service';
import { SoundPlayerService } from './sound-player.service';
import { TriggerService } from './trigger.service';
import {
  builtinSoundId,
  personalSoundId,
  type PersonalSound,
} from './models/sound';

type Tab = 'builtin' | 'personal';

/**
 * UI for the sound library. Two tabs:
 *   - "Allgemein": read-only list of built-in sounds shipped with the app.
 *   - "Persönlich": user-imported sounds with rename / delete / import.
 *
 * The component itself does no validation beyond filtering on the file
 * picker's `accept` attribute; the service applies MIME, per-sound size and
 * total-quota checks and throws on failure.
 */
@Component({
  selector: 'app-sound-library',
  templateUrl: './sound-library.component.html',
  styleUrls: ['./sound-library.component.scss'],
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SoundLibraryComponent {
  private readonly library = inject(SoundLibraryService);
  private readonly player = inject(SoundPlayerService);
  private readonly triggers = inject(TriggerService);

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  public readonly tab = signal<Tab>('builtin');
  public readonly importError = signal<string>('');

  public readonly builtinSounds = toSignal(this.library.builtin$, {
    initialValue: this.library.builtin,
  });
  public readonly personalSounds = toSignal(this.library.personal$, {
    initialValue: this.library.personal,
  });

  /** Bytes / max bytes for the personal tab footer. */
  public readonly maxPersonalBytes = MAX_PERSONAL_TOTAL_BYTES;
  public readonly acceptAttr = ALLOWED_MIME_TYPES.join(',');
  public readonly maxPerSoundLabel = formatBytes(MAX_PERSONAL_SOUND_BYTES);

  public selectTab(tab: Tab): void {
    this.tab.set(tab);
    this.importError.set('');
  }

  public personalBytes(): number {
    return this.library.personalBytesUsed;
  }

  public playBuiltin(id: string): void {
    this.player.play(builtinSoundId(id));
  }

  public playPersonal(id: string): void {
    this.player.play(personalSoundId(id));
  }

  public renamePersonal(s: PersonalSound): void {
    const next = window.prompt('Neuer Name', s.label);
    if (next === null) return;
    try {
      this.library.renamePersonal(s.id, next);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    }
  }

  public deletePersonal(s: PersonalSound): void {
    const fqId = personalSoundId(s.id);
    const referencingTriggers = this.triggers.triggers.filter(
      (t) => t.action.kind === 'sound' && t.action.soundId === fqId,
    );

    const refCount = referencingTriggers.length;
    const refSuffix =
      refCount === 0
        ? ''
        : `\n${refCount} Trigger verweist auf diesen Sound und wird nach dem Löschen ungültig.`;

    if (!window.confirm(`Sound "${s.label}" wirklich löschen?${refSuffix}`)) {
      return;
    }
    this.library.deletePersonal(s.id);
  }

  public openFilePicker(): void {
    this.importError.set('');
    this.fileInput?.nativeElement.click();
  }

  /**
   * Handles the hidden `<input type="file">` change. Imports the chosen file
   * via the library service and surfaces any error in the panel.
   */
  public async onFileChosen(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    // Reset the input so re-selecting the same file fires `change` again.
    input.value = '';

    if (!file) return;

    try {
      await this.library.importPersonal(file);
    } catch (err) {
      this.importError.set(err instanceof Error ? err.message : String(err));
    }
  }

  /** Used by the template; kept in the class so the import is shared. */
  public formatBytes(bytes: number): string {
    return formatBytes(bytes);
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
