import { inject, Injectable, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

import { MudService } from '@webmud3/frontend/core/mud/services/mud.service';
import { FooterMenuService } from '@webmud3/frontend/features/footer/footer-menu.service';

const MENU_ID = 'connection';

/**
 * Adds a "Verbinden / Trennen" entry to the footer menu.
 *
 * The label flips depending on the current MUD connection state:
 *  - connected     → "Trennen"  (action: disconnect)
 *  - disconnected  → "Verbinden" (action: reconnect using the last viewport)
 *
 * The default auto-connect at app start is unaffected; this service only
 * provides a manual handle.
 */
@Injectable({ providedIn: 'root' })
export class ConnectionMenuService implements OnDestroy {
  private readonly mudService = inject(MudService);
  private readonly footerMenu = inject(FooterMenuService);

  private subscription: Subscription | undefined;

  constructor() {
    // Initial registration (assume disconnected — first connectedToMud$ value
    // will overwrite immediately).
    this.updateItem(false);

    this.subscription = this.mudService.connectedToMud$.subscribe(
      (connected) => this.updateItem(connected),
    );
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.footerMenu.unregister(MENU_ID);
  }

  private updateItem(connected: boolean): void {
    this.footerMenu.register({
      id: MENU_ID,
      label: connected ? 'Trennen' : 'Verbinden',
      action: () => {
        if (connected) {
          this.mudService.disconnect();
        } else {
          this.mudService.reconnect();
        }
      },
    });
  }
}
