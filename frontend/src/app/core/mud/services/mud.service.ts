import { inject, Injectable } from '@angular/core';
import { SocketsService } from '@webmud3/frontend/features/sockets/sockets.service';
import { SecureString } from '@webmud3/frontend/shared/types/secure-string';

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

  /** Emittiert isNewConnection wenn MUD-Verbindung hergestellt wurde */
  public readonly mudConnect$ = this.sockets.onMudConnect.asObservable();

  public connect(
    initialViewPort: { columns: number; rows: number },
    mudId?: string,
  ) {
    this.sockets.connectToMud(initialViewPort, mudId);
  }

  public disconnect() {
    this.sockets.disconnectFromMud();
  }

  public sendMessage(msg: string | SecureString) {
    this.sockets.sendMessage(msg);
  }

  public updateViewportSize(columns: number, rows: number) {
    this.sockets.updateViewportSize(columns, rows);
  }
}
