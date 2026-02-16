import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { MudConfigService, MudListEntry } from './mud-config.service';

/**
 * Landing page that shows all available MUDs and lets the user pick one.
 *
 * Displayed when multi-MUD mode is active and the user navigates to "/".
 * Each card shows name, description, and MUD family. Clicking navigates
 * to `/:mudId` which bootstraps the MudClientComponent.
 */
@Component({
  selector: 'app-mud-selector',
  standalone: true,
  template: `
    <div class="mud-selector" role="main" aria-label="MUD-Auswahl">
      <h1 class="mud-selector__title">WebMUD 3</h1>
      <p class="mud-selector__subtitle">Wähle ein MUD zum Verbinden:</p>

      <ul class="mud-selector__list" role="list">
        @for (entry of mudEntries; track entry.id) {
          <li class="mud-selector__item" role="listitem">
            <button
              class="mud-card"
              (click)="selectMud(entry.id)"
              (keydown.enter)="selectMud(entry.id)"
              [attr.aria-label]="'Verbinden mit ' + entry.mud.name"
            >
              <span class="mud-card__name">{{ entry.mud.name }}</span>
              <span class="mud-card__description">{{ entry.mud.description }}</span>
              <span class="mud-card__family">{{ entry.mud.mudfamily }}</span>
            </button>
          </li>
        }
      </ul>

      @if (mudEntries.length === 0) {
        <p class="mud-selector__empty">Keine MUDs konfiguriert.</p>
      }
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
      background: #1e1e2e;
      color: #cdd6f4;
      font-family: 'JetBrainsMono', 'Segoe UI', sans-serif;
      padding: 2rem;
    }

    .mud-selector {
      max-width: 800px;
      width: 100%;
    }

    .mud-selector__title {
      font-size: 2rem;
      font-weight: 700;
      margin: 0 0 0.5rem;
      color: #cba6f7;
    }

    .mud-selector__subtitle {
      font-size: 1rem;
      margin: 0 0 2rem;
      color: #a6adc8;
    }

    .mud-selector__list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }

    .mud-selector__item {
      display: contents;
    }

    .mud-card {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 1.25rem 1.5rem;
      background: #313244;
      border: 2px solid #45475a;
      border-radius: 12px;
      cursor: pointer;
      text-align: left;
      transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;
      color: #cdd6f4;
      font-family: inherit;
      font-size: 1rem;
      width: 100%;
    }

    .mud-card:hover,
    .mud-card:focus-visible {
      border-color: #cba6f7;
      box-shadow: 0 4px 16px rgba(203, 166, 247, 0.15);
      transform: translateY(-2px);
      outline: none;
    }

    .mud-card:active {
      transform: translateY(0);
    }

    .mud-card__name {
      font-size: 1.25rem;
      font-weight: 600;
      color: #f5c2e7;
    }

    .mud-card__description {
      font-size: 0.9rem;
      color: #bac2de;
      line-height: 1.4;
    }

    .mud-card__family {
      font-size: 0.75rem;
      color: #6c7086;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .mud-selector__empty {
      text-align: center;
      color: #6c7086;
      font-style: italic;
      margin-top: 2rem;
    }
  `],
})
export class MudSelectorComponent {
  private readonly mudConfig = inject(MudConfigService);
  private readonly router = inject(Router);

  /** Flattened list of MUD entries for the template. */
  protected readonly mudEntries: Array<{ id: string; mud: MudListEntry }>;

  constructor() {
    const muds = this.mudConfig.muds;

    this.mudEntries = Object.entries(muds).map(([id, mud]) => ({ id, mud }));
  }

  /**
   * Navigates to the MUD client route for the selected MUD.
   */
  protected selectMud(mudId: string): void {
    this.router.navigate(['/', mudId]);
  }
}
