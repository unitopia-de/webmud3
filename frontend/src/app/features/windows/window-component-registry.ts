import type { Type } from '@angular/core';

import { EditorComponent } from '@webmud3/frontend/features/editor/editor.component';
import { InventoryComponent } from '@webmud3/frontend/features/inventory/inventory.component';
import { NumpadConfigComponent } from '@webmud3/frontend/features/numpad/numpad-config.component';

/**
 * Maps WindowConfig.component (a string id) to a concrete Angular component.
 *
 * The Window-Container looks up the component for each open window and renders
 * it via ngComponentOutlet. Add new entries here when you introduce new
 * window-hosted features (editor, char-stats, ...).
 */
export const WINDOW_COMPONENTS: Record<string, Type<unknown>> = {
  inventory: InventoryComponent,
  'numpad-config': NumpadConfigComponent,
  editor: EditorComponent,
};
