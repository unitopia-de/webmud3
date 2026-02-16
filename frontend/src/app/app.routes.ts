import { Routes } from '@angular/router';

import { MudConfigService } from './features/mud-config/mud-config.service';
import { MudSelectorComponent } from './features/mud-config/mud-selector.component';
import { MudClientShellComponent } from './features/mud-config/mud-client-shell.component';

/**
 * Builds routes dynamically based on whether multi-MUD mode is active.
 *
 * - Multi-MUD mode: "/" shows MudSelector, "/:mudId" loads the client.
 * - Single-MUD mode: "/" loads the client directly (no selector page).
 */
export function buildAppRoutes(mudConfig: MudConfigService): Routes {
  if (mudConfig.isMultiMud) {
    return [
      {
        path: '',
        component: MudSelectorComponent,
        pathMatch: 'full',
      },
      {
        path: ':mudId',
        component: MudClientShellComponent,
      },
    ];
  }

  // Single-MUD mode: go straight to the client
  return [
    {
      path: '',
      component: MudClientShellComponent,
      pathMatch: 'full',
    },
    {
      path: '**',
      redirectTo: '',
    },
  ];
}
