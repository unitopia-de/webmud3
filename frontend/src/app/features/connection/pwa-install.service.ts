import { inject, Injectable } from '@angular/core';

import { FooterMenuService } from '@webmud3/frontend/features/footer/footer-menu.service';

/**
 * The `beforeinstallprompt` event is not in the standard DOM lib typings.
 * Minimal shape of what we use.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Manages the Android/Chromium "Add to home screen" install flow.
 *
 * Chromium fires `beforeinstallprompt` when the PWA is installable. The
 * browser's own mini-infobar appears at unpredictable times, so we suppress it
 * (`preventDefault`) and instead expose an "App installieren" entry in the
 * footer menu. Clicking it triggers the stashed prompt. The entry disappears
 * once the app is installed or after the prompt was used.
 *
 * iOS Safari does NOT fire this event (install there is the manual
 * Share → "Zum Home-Bildschirm"), so on iOS no entry appears — which is
 * correct, there is no programmatic prompt to offer.
 *
 * Instantiated for its side effects by AppComponent so it is alive in both
 * shells. It registers/unregisters its own footer-menu entry via the
 * root-singleton FooterMenuService.
 */
@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  private readonly footerMenu = inject(FooterMenuService);

  private readonly MENU_ID = 'pwa-install';
  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  constructor() {
    // Already running as an installed PWA → nothing to offer.
    if (this.isStandalone()) {
      return;
    }

    window.addEventListener('beforeinstallprompt', (event) => {
      // Suppress the browser's default mini-infobar; we drive the prompt.
      event.preventDefault();
      this.deferredPrompt = event as BeforeInstallPromptEvent;
      this.registerEntry();
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.footerMenu.unregister(this.MENU_ID);
    });
  }

  private registerEntry(): void {
    this.footerMenu.register({
      id: this.MENU_ID,
      label: 'App installieren',
      // Below the regular actions, above "Hilfe".
      order: 800,
      checked: false,
      action: () => void this.promptInstall(),
    });
  }

  private async promptInstall(): Promise<void> {
    const prompt = this.deferredPrompt;
    if (!prompt) {
      return;
    }
    // The prompt can only be used once; drop it and the entry up front.
    this.deferredPrompt = null;
    this.footerMenu.unregister(this.MENU_ID);

    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      // User dismissed or the browser refused — nothing to do.
    }
  }

  private isStandalone(): boolean {
    const navStandalone = (
      window.navigator as Navigator & { standalone?: boolean }
    ).standalone;
    return (
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
      navStandalone === true
    );
  }
}
