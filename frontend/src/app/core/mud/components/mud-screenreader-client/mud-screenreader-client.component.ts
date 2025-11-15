import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { FitAddon } from '@xterm/addon-fit';
import { IDisposable, Terminal } from '@xterm/xterm';

/**
 * Lightweight xterm wrapper that is decoupled from the backend and is optimized
 * for screen-reader experiments.  It renders a static intro text and mirrors any
 * user input back to the terminal, including a delayed echo so assistive tech can
 * be tested without talking to the backend.
 */
@Component({
  selector: 'app-mud-screenreader-client',
  standalone: true,
  templateUrl: './mud-screenreader-client.component.html',
  styleUrls: ['./mud-screenreader-client.component.scss'],
})
export class MudScreenreaderClientComponent
  implements AfterViewInit, OnDestroy
{
  private readonly terminal = new Terminal({
    fontFamily: 'JetBrainsMono, monospace',
    theme: { background: '#000', foreground: '#ccc' },
    cursorBlink: true,
    screenReaderMode: true,
  });

  private readonly fitAddon = new FitAddon();
  private readonly terminalDisposables: IDisposable[] = [];
  private readonly resizeObs = new ResizeObserver(() => this.handleResize());

  private currentInput = '';
  private readonly pendingEchoTimeouts: number[] = [];

  @ViewChild('hostRef', { static: true })
  private readonly terminalRef!: ElementRef<HTMLDivElement>;

  ngAfterViewInit(): void {
    this.terminal.open(this.terminalRef.nativeElement);
    this.terminal.loadAddon(this.fitAddon);
    this.fitAddon.fit();
    this.resizeObs.observe(this.terminalRef.nativeElement);

    this.renderStaticIntro();
    this.terminal.focus();

    this.terminalDisposables.push(
      this.terminal.onData((data) => this.handleInput(data)),
    );
  }

  ngOnDestroy(): void {
    this.resizeObs.disconnect();
    this.pendingEchoTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this.pendingEchoTimeouts.length = 0;

    this.terminalDisposables.forEach((disposable) => disposable.dispose());
    this.terminal.dispose();
  }

  private handleResize(): void {
    this.fitAddon.fit();
  }

  private handleInput(data: string): void {
    for (const char of data) {
      if (char === '\r') {
        this.commitInput();
        continue;
      }

      if (char === '\n') {
        continue;
      }

      if (char === '\u0008' || char === '\u007f') {
        this.handleBackspace();
        continue;
      }

      if (this.isPrintable(char)) {
        this.appendCharacter(char);
      }
    }
  }

  private appendCharacter(char: string): void {
    this.currentInput += char;
    this.terminal.write(char);
  }

  private handleBackspace(): void {
    if (!this.currentInput.length) {
      return;
    }

    this.currentInput = this.currentInput.slice(0, -1);
    this.terminal.write('\b \b');
  }

  private commitInput(): void {
    this.terminal.write('\r\n');
    const inputSnapshot = this.currentInput;
    this.terminal.writeln(`Eingabe: ${inputSnapshot}`);
    this.scheduleEcho(inputSnapshot);
    this.currentInput = '';
    this.terminal.writeln('');
  }

  private renderStaticIntro(): void {
    this.terminal.writeln('Willkommen zum barrierefreien Testlauf.');
    this.terminal.writeln('Die Verbindung zum Server ist deaktiviert.');
    this.terminal.writeln('');
    this.terminal.writeln(
      'Tippen Sie Ihre Eingabe und bestaetigen Sie mit Enter.',
    );
    this.terminal.writeln('');
  }

  private isPrintable(char: string): boolean {
    const code = char.charCodeAt(0);
    return code >= 0x20 && code !== 0x7f;
  }

  private scheduleEcho(message: string): void {
    const timeoutId = window.setTimeout(() => {
      this.terminal.writeln(`Echo: ${message}`);
      const idx = this.pendingEchoTimeouts.indexOf(timeoutId);
      if (idx >= 0) {
        this.pendingEchoTimeouts.splice(idx, 1);
      }
    }, 5000);

    this.pendingEchoTimeouts.push(timeoutId);
  }
}
