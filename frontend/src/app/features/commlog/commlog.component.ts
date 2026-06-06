import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';

import { CommlogService } from './commlog.service';

/**
 * Window content for the experimental CommLog feature.
 *
 * Lists every collected say / soul / tell line and offers two actions:
 *  - "Herunterladen" — saves the buffer as a plain-text file
 *  - "Löschen"       — empties the buffer
 */
@Component({
  selector: 'app-commlog',
  templateUrl: './commlog.component.html',
  styleUrls: ['./commlog.component.scss'],
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommlogComponent {
  private readonly commlog = inject(CommlogService);

  public readonly entries = this.commlog.entries;

  public clear(): void {
    this.commlog.clear();
  }

  /**
   * Builds a Blob from the current buffer and triggers a browser download.
   * The object URL is revoked right after the click to free memory.
   */
  public download(): void {
    const text = this.commlog.toText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `commlog-${stamp}.txt`;
    anchor.click();

    URL.revokeObjectURL(url);
  }
}
