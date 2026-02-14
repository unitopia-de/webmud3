import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Subscription } from 'rxjs';

import { WindowAction, WindowConfig, WindowService } from '../windows';

import { FileInfo } from './file-types';
import { FilesGmcpHandler } from './files-gmcp-handler';
import { FilesService } from './files.service';

/** Available Ace themes */
const ACE_THEMES: string[] = [
  'ambiance', 'chaos', 'chrome', 'clouds', 'clouds_midnight',
  'cobalt', 'crimson_editor', 'dawn', 'dracula', 'dreamweaver',
  'eclipse', 'github', 'gob', 'gruvbox', 'idle_fingers',
  'iplastic', 'katzenmilch', 'kr_theme', 'kuroir', 'merbivore',
  'merbivore_soft', 'mono_industrial', 'monokai', 'nord_dark',
  'one_dark', 'pastel_on_dark', 'solarized_dark', 'solarized_light',
  'sqlserver', 'terminal', 'textmate', 'tomorrow',
  'tomorrow_night_blue', 'tomorrow_night_bright', 'tomorrow_night',
  'tomorrow_night_eighties', 'twilight', 'vibrant_ink', 'xcode',
];

const STORAGE_KEY_THEME = 'webmud3_editor_theme';
const DEFAULT_THEME = 'twilight';

/**
 * In-browser code editor using Ace Editor, displayed inside a modeless window.
 *
 * Features:
 * - Syntax highlighting for C/C++ and text
 * - Theme selection with persistence in localStorage
 * - Save (intermediate and final)
 * - Cancel with dirty-check warning
 * - Read-only toggle
 * - Responds to window resize events
 */
@Component({
  selector: 'app-editor',
  standalone: true,
  template: `
    <div class="editor-toolbar">
      <select
        class="editor-theme-select"
        [value]="currentTheme"
        (change)="onThemeChange($event)"
        aria-label="Editor-Theme auswählen"
      >
        @for (theme of themes; track theme) {
          <option [value]="theme">{{ theme }}</option>
        }
      </select>

      <div class="editor-toolbar-buttons">
        <button
          class="editor-btn"
          (click)="toggleReadOnly()"
          [title]="readOnly ? 'Bearbeitungsmodus aktivieren' : 'Lesemodus aktivieren'"
          [attr.aria-pressed]="readOnly"
        >
          {{ readOnly ? '🔒' : '🔓' }}
        </button>

        @if (!readOnly && fileInfo?.writeacl) {
          <button
            class="editor-btn"
            (click)="onSave(false)"
            title="Zwischenspeichern"
            aria-label="Zwischenspeichern"
          >💾</button>

          <button
            class="editor-btn editor-btn--primary"
            (click)="onSave(true)"
            title="Speichern & Schließen"
            aria-label="Speichern und Schließen"
          >💾✓</button>
        }

        <button
          class="editor-btn editor-btn--danger"
          (click)="onCancel()"
          title="Schließen"
          aria-label="Schließen"
        >✕</button>
      </div>
    </div>

    <div class="editor-container" #editorContainer></div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
      }

      .editor-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 4px 0;
        gap: 8px;
        flex-shrink: 0;
      }

      .editor-theme-select {
        background: #313244;
        color: #cdd6f4;
        border: 1px solid #45475a;
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 11px;
        max-width: 160px;

        &:focus-visible {
          outline: 2px solid #89b4fa;
        }
      }

      .editor-toolbar-buttons {
        display: flex;
        gap: 4px;
      }

      .editor-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 28px;
        height: 24px;
        border: none;
        border-radius: 4px;
        background: #313244;
        color: #cdd6f4;
        cursor: pointer;
        font-size: 12px;
        padding: 0 6px;

        &:hover {
          background: #45475a;
        }

        &:focus-visible {
          outline: 2px solid #89b4fa;
          outline-offset: 1px;
        }
      }

      .editor-btn--primary {
        background: #a6e3a1;
        color: #1e1e2e;

        &:hover {
          background: #94e2d5;
        }
      }

      .editor-btn--danger {
        &:hover {
          background: #f38ba8;
          color: #1e1e2e;
        }
      }

      .editor-container {
        flex: 1;
        min-height: 100px;
        position: relative;
      }
    `,
  ],
})
export class EditorComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input({ required: true }) config!: WindowConfig;
  @ViewChild('editorContainer', { static: true }) editorContainer!: ElementRef<HTMLElement>;

  readonly themes = ACE_THEMES;
  currentTheme = DEFAULT_THEME;
  readOnly = false;
  fileInfo: FileInfo | null = null;

  private aceEditor: any; // ace.Ace.Editor — dynamically imported
  private aceSession: any; // ace.Ace.EditSession
  private initialContent = '';

  private readonly windowService = inject(WindowService);
  private readonly filesService = inject(FilesService);
  private readonly filesHandler = inject(FilesGmcpHandler);

  private eventSub?: Subscription;

  ngOnInit(): void {
    this.fileInfo = (this.config.data as FileInfo) ?? null;
    this.initialContent = this.fileInfo?.content ?? '';

    // Load saved theme
    const savedTheme = localStorage.getItem(STORAGE_KEY_THEME);

    if (savedTheme !== null && ACE_THEMES.includes(savedTheme)) {
      this.currentTheme = savedTheme;
    }

    // Listen for window events (resize, errors)
    this.eventSub = this.windowService.outgoingEvents$.subscribe((event) => {
      if (event.windowId !== this.config.windowId) {
        return;
      }

      switch (event.action) {
        case WindowAction.Resize:
          this.aceEditor?.resize(true);
          break;

        case WindowAction.WinError:
          console.error('[EditorComponent] Save error:', event.data);
          break;
      }
    });
  }

  async ngAfterViewInit(): Promise<void> {
    // Dynamic import for lazy loading (~1MB)
    const ace = await import('ace-builds');
    await import('ace-builds/src-noconflict/mode-c_cpp');
    await import('ace-builds/src-noconflict/mode-text');

    this.aceEditor = ace.edit(this.editorContainer.nativeElement);
    this.aceEditor.setAutoScrollEditorIntoView(true);
    this.aceEditor.setShowPrintMargin(false);

    // Apply theme (dynamic import)
    try {
      await import(`ace-builds/src-noconflict/theme-${this.currentTheme}`);
    } catch {
      // Fallback if theme module not found
      await import('ace-builds/src-noconflict/theme-twilight');
    }

    this.aceEditor.setTheme(`ace/theme/${this.currentTheme}`);

    // Create session with file content and mode
    const mode = this.fileInfo?.editorMode ?? 'text';

    this.aceSession = new ace.EditSession(this.initialContent);
    this.aceSession.setMode(`ace/mode/${mode}`);
    this.aceEditor.setSession(this.aceSession);
    this.aceEditor.setReadOnly(this.readOnly);
  }

  ngOnDestroy(): void {
    this.eventSub?.unsubscribe();

    if (this.aceEditor !== undefined) {
      this.aceEditor.destroy();
    }
  }

  async onThemeChange(event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    this.currentTheme = select.value;

    localStorage.setItem(STORAGE_KEY_THEME, this.currentTheme);

    if (this.aceEditor !== undefined) {
      try {
        await import(`ace-builds/src-noconflict/theme-${this.currentTheme}`);
      } catch {
        // Theme module might not exist
      }

      this.aceEditor.setTheme(`ace/theme/${this.currentTheme}`);
    }
  }

  toggleReadOnly(): void {
    this.readOnly = !this.readOnly;

    if (this.aceEditor !== undefined) {
      this.aceEditor.setReadOnly(this.readOnly);
    }
  }

  onSave(closable: boolean): void {
    if (this.readOnly || this.fileInfo === null) {
      return;
    }

    // Update fileInfo content from editor
    this.fileInfo.content = this.aceEditor?.getValue() ?? '';

    this.filesHandler.saveFile(this.fileInfo.file, closable);
  }

  onCancel(): void {
    if (this.fileInfo === null) {
      this.windowService.close(this.config.windowId);
      return;
    }

    const currentContent = this.aceEditor?.getValue() ?? '';
    const isDirty = currentContent !== this.initialContent;

    if (isDirty) {
      const confirmed = window.confirm(
        'Willst Du ohne Speichern schließen?',
      );

      if (!confirmed) {
        return;
      }
    }

    this.filesService.removeFile(this.fileInfo.file);
    this.windowService.close(this.config.windowId);
  }
}
