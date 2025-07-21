// src/app/mud/mud.service.ts
import { Injectable } from '@angular/core';
import { SocketsService } from '@mudlet3/frontend/features/sockets';
import { isSecureString, SecureString } from '@mudlet3/frontend/shared';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MudService {
  /* ---------------- öffentliche Status-Streams ---------------- */
  readonly connectedToMud$ = this.socketService.connectedToMud$;
  /** true = Klartext-Echo, false = Passwort-Echo */
  readonly showEcho$: Observable<boolean> =
    this.socketService.onSetEchoMode.asObservable();

  /* ---------------- Terminal-Objekt ---------------- */
  private term!: Terminal;
  private fit = new FitAddon();

  constructor(private readonly socketService: SocketsService) {}

  /** 1× im MudOutputComponent aufrufen, um das Terminal einzubetten */
  initTerminal(host: HTMLElement): void {
    if (this.term) {
      return;
    }

    /* Terminal instanzieren */
    this.term = new Terminal({
      convertEol: true,
      fontFamily: 'JetBrainsMono, monospace',
      theme: { background: '#000', foreground: '#ccc' },
    });

    this.socketService.onMudOutput.subscribe(({ data }) => {
      this.term.write(data); // ANSI kommt 1-zu-1 an
    });

    this.term.onData((text) => this.socketService.sendMessage(text));

    this.term.loadAddon(this.fit);
    this.term.open(host);
    this.fit.fit();

    /* Resize -> Fit */
    window.addEventListener('resize', this.onResize);
  }

  private onResize = () => this.fit.fit();

  /* ---------------------------------------------------------------- */

  sendMessage(msg: string | SecureString): void {
    this.socketService.sendMessage(msg);

    /* Lokales Echo nur bei Klartext */
    if (!isSecureString(msg)) {
      this.term?.writeln(msg.toString());
    }
  }

  connect(): void {
    this.socketService.connectToMud();
  }
  disconnect(): void {
    this.socketService.disconnectFromMud();
  }

  /* Good practice, wenn Service jemals zerstört wird */
  disposeTerminal(): void {
    window.removeEventListener('resize', this.onResize);
    this.term?.dispose();
  }
}
