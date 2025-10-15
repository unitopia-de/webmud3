import { inject, Injectable } from '@angular/core';
import { SocketsService } from '@mudlet3/frontend/features/sockets';
import { SecureString } from '@mudlet3/frontend/shared';

@Injectable({ providedIn: 'root' })
export class MudService {
  private readonly sockets = inject(SocketsService);

  /** Observable, das den Verbindungsstatus zum MUD anzeigt */
  public readonly connectedToMud$ = this.sockets.connectedToMud$;

  /** Zeigt an, ob der Echo-Modus aktiviert ist */
  public readonly showEcho$ = this.sockets.onSetEchoMode.asObservable();

  /** Aktueller LINEMODE-Status, wie vom Server verhandelt */
  public readonly linemode$ = this.sockets.onSetLinemode.asObservable();

  /** Roh-Ausgabe-Stream vom Server (ANSI-Bytes/String) */
  public readonly mudOutput$ = this.sockets.onMudOutput.asObservable();

  public connect() {
    this.sockets.connectToMud();
  }

  public disconnect() {
    this.sockets.disconnectFromMud();
  }

  public sendMessage(msg: string | SecureString) {
    this.sockets.sendMessage(msg);
  }
}
