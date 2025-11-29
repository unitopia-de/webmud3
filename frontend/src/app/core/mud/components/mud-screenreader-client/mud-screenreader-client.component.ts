import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { FitAddon } from '@xterm/addon-fit';
import { IDisposable, Terminal } from '@xterm/xterm';
import { Subscription } from 'rxjs';

import { MudService } from '../../services/mud.service';

/**
 * Lightweight xterm wrapper that streams directly to/from the backend for
 * screen-reader experiments.  It forwards raw server output 1:1 to xterm and
 * ships user input to the server on CR, echoing the submitted line locally.
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
  private readonly mudService = inject(MudService);

  private readonly terminal = new Terminal({
    fontFamily: 'JetBrainsMono, monospace',
    theme: { background: '#000', foreground: '#ccc' },
    cursorBlink: true,
    screenReaderMode: true,
  });

  private readonly fitAddon = new FitAddon();
  private readonly terminalDisposables: IDisposable[] = [];
  private readonly resizeObs = new ResizeObserver(() => this.handleResize());
  private mudOutputSubscription?: Subscription;

  private currentInput = '';

  @ViewChild('hostRef', { static: true })
  private readonly terminalRef!: ElementRef<HTMLDivElement>;

  ngAfterViewInit(): void {
    this.terminal.open(this.terminalRef.nativeElement);
    this.terminal.loadAddon(this.fitAddon);
    this.fitAddon.fit();
    this.resizeObs.observe(this.terminalRef.nativeElement);

    this.mudOutputSubscription = this.mudService.mudOutput$.subscribe(
      ({ data }) => this.terminal.write(data),
    );

    this.terminal.focus();

    this.terminalDisposables.push(
      this.terminal.onData((data) => this.handleInput(data)),
    );

    this.connectToBackend();
  }

  ngOnDestroy(): void {
    this.resizeObs.disconnect();

    this.mudOutputSubscription?.unsubscribe();
    this.terminalDisposables.forEach((disposable) => disposable.dispose());
    this.mudService.disconnect();
    this.terminal.dispose();
  }

  private handleResize(): void {
    this.fitAddon.fit();

    const columns = this.terminal.cols;
    const rows = this.terminal.rows;

    if (Number.isFinite(columns) && Number.isFinite(rows)) {
      this.mudService.updateViewportSize(columns, rows);
    }
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
    // this.terminal.write('\r\n');
    const inputSnapshot = this.currentInput;
    // this.terminal.writeln(`Eingabe: ${inputSnapshot}`);
    if (inputSnapshot.length > 0) {
      this.mudService.sendMessage(inputSnapshot);
    }
    this.currentInput = '';
    this.terminal.writeln('');
  }

  private isPrintable(char: string): boolean {
    const code = char.charCodeAt(0);
    return code >= 0x20 && code !== 0x7f;
  }

  private connectToBackend(): void {
    const columns = this.terminal.cols;
    const rows = this.terminal.rows;

    this.mudService.connect({ columns, rows });
  }
}
