import { inject, Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, Subscription, filter } from 'rxjs';

import { SocketsService } from '../sockets/sockets.service';

/**
 * A parsed GMCP message as received from the MUD server.
 */
export type GmcpMessage = {
  /** The GMCP package, e.g. "Char" from "Char.Name" */
  packageName: string;
  /** The GMCP message name, e.g. "Name" from "Char.Name" */
  messageName: string;
  /** The full module string, e.g. "Char.Name" */
  fullMessage: string;
  /** The parsed JSON data payload */
  data: unknown;
};

@Injectable({ providedIn: 'root' })
export class GmcpService implements OnDestroy {
  private readonly sockets = inject(SocketsService);

  private readonly active = new BehaviorSubject<boolean>(false);
  private readonly messages = new Subject<GmcpMessage>();
  private readonly subscriptions: Subscription[] = [];

  /** Whether GMCP is currently active (negotiated with MUD server) */
  public readonly active$ = this.active.asObservable();

  /** Stream of all incoming GMCP messages */
  public readonly messages$ = this.messages.asObservable();

  constructor() {
    this.subscriptions.push(
      this.sockets.onGmcpActive.subscribe((isActive) => {
        this.active.next(isActive);
      }),
    );

    this.subscriptions.push(
      this.sockets.onGmcpIncoming.subscribe(
        ({ packageName, messageName, data }) => {
          this.messages.next({
            packageName,
            messageName,
            fullMessage: `${packageName}.${messageName}`,
            data,
          });
        },
      ),
    );
  }

  ngOnDestroy(): void {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
  }

  /**
   * Returns an Observable that emits only GMCP messages matching the given full module string.
   * Example: `onMessage('Char.Name')` emits when the server sends `Char.Name {...}`.
   */
  public onMessage(fullMessage: string): Observable<GmcpMessage> {
    return this.messages$.pipe(
      filter((msg) => msg.fullMessage === fullMessage),
    );
  }

  /**
   * Returns an Observable that emits all GMCP messages for a given package.
   * Example: `onPackage('Char')` emits for `Char.Name`, `Char.Status`, `Char.Vitals`, etc.
   */
  public onPackage(packageName: string): Observable<GmcpMessage> {
    return this.messages$.pipe(
      filter((msg) => msg.packageName === packageName),
    );
  }

  /**
   * Sends a GMCP message to the MUD server.
   * @param module - The GMCP module string, e.g. "Core.Hello"
   * @param data - The data payload (will be JSON-serialized)
   */
  public send(module: string, data: unknown = undefined): void {
    if (!this.active.value) {
      console.warn('[GMCP] Cannot send GMCP message - not active');
      return;
    }

    this.sockets.sendGmcp(module, data);
  }
}
