import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import loader from '@monaco-editor/loader';
import type * as MonacoNs from 'monaco-editor';

import type { WindowConfig } from '@webmud3/frontend/features/windows/window-config';
import type { FileInfo } from '../gmcp/signals/mud-signals';
import { FilesService } from './files.service';

type EditorPayload = {
  fileinfo: FileInfo;
};

/**
 * Code editor window content. Hosts a lazy-loaded Monaco editor instance.
 *
 * Receives its `WindowConfig` via the `config` input wired up by the
 * Window-Container's `ngComponentOutletInputs`. The hosted file is read from
 * `config.data.fileinfo`; the body is fetched via `FilesService.loadContent`.
 *
 * Save / cancel actions communicate back to the WindowService through
 * `config.outgoing` so the surrounding window can be closed by the host.
 *
 * Accessibility: `accessibilitySupport: 'on'` activates Monaco's screen-reader
 * paging mode (NVDA / JAWS / VoiceOver compatible).
 */
@Component({
  selector: 'app-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.scss'],
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input({ required: true }) config!: WindowConfig;

  @ViewChild('host', { static: true })
  private hostRef!: ElementRef<HTMLDivElement>;

  private readonly files = inject(FilesService);

  private editor: MonacoNs.editor.IStandaloneCodeEditor | undefined;
  private initialContent = '';
  private hasUnsavedChanges = false;
  private destroyed = false;

  public saving = false;

  public statusMessage = 'Lade Datei …';
  public errorMessage: string | null = null;

  public get fileinfo(): FileInfo | undefined {
    return (this.config?.data as EditorPayload | undefined)?.fileinfo;
  }

  public get title(): string {
    return this.fileinfo?.title || this.fileinfo?.filename || 'Editor';
  }

  public get readOnly(): boolean {
    return this.fileinfo?.writeacl === false;
  }

  ngOnInit(): void {
    if (!this.fileinfo) {
      this.errorMessage = 'Keine Datei-Information vorhanden.';
      this.statusMessage = '';
    }
  }

  ngAfterViewInit(): void {
    if (!this.fileinfo) {
      return;
    }

    void this.bootstrap(this.fileinfo);
  }

  ngOnDestroy(): void {
    this.destroyed = true;

    if (this.editor) {
      const model = this.editor.getModel();
      this.editor.dispose();
      model?.dispose();
      this.editor = undefined;
    }
  }

  public onSave(closeAfter: boolean): void {
    if (this.readOnly || this.editor === undefined || this.saving) {
      return;
    }

    const fileinfo = this.fileinfo;
    if (!fileinfo) {
      return;
    }

    const content = this.editor.getValue();

    this.saving = true;
    this.statusMessage = 'Speichere …';
    this.errorMessage = null;

    this.files.saveFile(fileinfo, content).subscribe({
      next: () => {
        if (this.destroyed) {
          return;
        }

        this.initialContent = content;
        this.hasUnsavedChanges = false;
        this.saving = false;
        this.statusMessage = 'Gespeichert.';

        if (closeAfter) {
          this.config.outgoing.next('do_close');
        }
      },
      error: (err: unknown) => {
        if (this.destroyed) {
          return;
        }

        this.saving = false;
        this.errorMessage = `Fehler beim Speichern: ${this.formatError(err)}`;
        this.statusMessage = '';
      },
    });
  }

  public onCancel(): void {
    if (
      this.hasUnsavedChanges &&
      !window.confirm('Willst Du ohne Speichern schliessen?')
    ) {
      return;
    }

    this.config.outgoing.next('do_close');
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private async bootstrap(fileinfo: FileInfo): Promise<void> {
    let monaco: typeof MonacoNs;

    try {
      monaco = await loader.init();
    } catch (err) {
      this.errorMessage = `Editor konnte nicht geladen werden: ${this.formatError(err)}`;
      this.statusMessage = '';
      return;
    }

    if (this.destroyed) {
      return;
    }

    let content = fileinfo.content ?? '';

    if (content === '' && fileinfo.lasturl) {
      try {
        content = await this.files.loadContent(fileinfo).toPromise() ?? '';
      } catch (err) {
        this.errorMessage = `Datei konnte nicht geladen werden: ${this.formatError(err)}`;
        this.statusMessage = '';
        return;
      }
    }

    if (this.destroyed) {
      return;
    }

    this.initialContent = content;
    this.statusMessage = '';

    this.editor = monaco.editor.create(this.hostRef.nativeElement, {
      value: content,
      language: this.toMonacoLanguage(fileinfo.editortype),
      readOnly: this.readOnly,
      automaticLayout: true,
      accessibilitySupport: 'on',
      ariaLabel: `Datei-Editor: ${this.title}`,
      tabSize: 4,
      insertSpaces: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
    });

    this.editor.onDidChangeModelContent(() => {
      this.hasUnsavedChanges = this.editor?.getValue() !== this.initialContent;
    });
  }

  private toMonacoLanguage(editortype: string | undefined): string {
    switch (editortype) {
      case 'c_cpp':
        return 'cpp';

      case 'text':
      case undefined:
      case '':
        return 'plaintext';

      default:
        return editortype;
    }
  }

  private formatError(err: unknown): string {
    if (err instanceof Error) {
      return err.message;
    }

    if (typeof err === 'string') {
      return err;
    }

    return String(err);
  }
}
