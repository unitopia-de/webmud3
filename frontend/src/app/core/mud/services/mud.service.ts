import { inject, Injectable } from '@angular/core';
import { SocketsService } from '@webmud3/frontend/features/sockets/sockets.service';
import { GmcpService } from '@webmud3/frontend/features/gmcp/gmcp.service';
import { MudSignalService } from '@webmud3/frontend/features/gmcp/signals/mud-signal.service';
import { SecureString } from '@webmud3/frontend/shared/types/secure-string';
import type { MudSignalType, MudSignal } from '@webmud3/frontend/features/gmcp/signals/mud-signals';

@Injectable({ providedIn: 'root' })
export class MudService {
  private readonly sockets = inject(SocketsService);
  private readonly gmcp = inject(GmcpService);
  private readonly signalService = inject(MudSignalService);

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

  /** Ob GMCP aktiv ist (erfolgreich mit MUD-Server verhandelt) */
  public readonly gmcpActive$ = this.gmcp.active$;

  /** Stream aller eingehenden GMCP-Nachrichten */
  public readonly gmcpMessages$ = this.gmcp.messages$;

  /** Stream aller typisierten MUD-Signals */
  public readonly signals$ = this.signalService.signals$;

  public connect(initialViewPort: { columns: number; rows: number }) {
    this.sockets.connectToMud(initialViewPort);
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

  /** Sendet eine GMCP-Nachricht an den MUD-Server */
  public sendGmcp(module: string, data?: unknown) {
    this.gmcp.send(module, data);
  }

  /** Observable das nur GMCP-Nachrichten eines bestimmten Moduls liefert */
  public onGmcpMessage(fullMessage: string) {
    return this.gmcp.onMessage(fullMessage);
  }

  /** Observable das alle GMCP-Nachrichten eines Pakets liefert */
  public onGmcpPackage(packageName: string) {
    return this.gmcp.onPackage(packageName);
  }

  /**
   * Typsicheres Observable fuer einen bestimmten Signal-Typ.
   * Beispiel: `onSignal('Char.Name').subscribe(s => s.name)`
   */
  public onSignal<T extends MudSignalType>(type: T) {
    return this.signalService.on(type);
  }
}
