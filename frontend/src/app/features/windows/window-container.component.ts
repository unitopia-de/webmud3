import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';

import { DirListComponent } from '../gmcp-files/dirlist.component';
import { EditorComponent } from '../gmcp-files/editor.component';

import { WindowAction, WindowConfig, WindowEvent } from './window-config';
import { WindowComponent } from './window.component';
import { WindowService } from './window.service';

/**
 * Container component that renders all active modeless windows.
 *
 * Placed as an overlay on top of the main application content.
 * It subscribes to WindowService.windows$ and renders a WindowComponent
 * for each active window config.
 *
 * The container itself uses `pointer-events: none` so clicks pass through
 * to the terminal below. Each individual window has `pointer-events: auto`.
 *
 * Content components are resolved via `@switch` on `config.componentType`.
 * New component types can be added by importing the component and adding
 * a `@case` branch.
 */
@Component({
  selector: 'app-window-container',
  standalone: true,
  imports: [AsyncPipe, WindowComponent, DirListComponent, EditorComponent],
  template: `
    <div class="wm-container">
      @for (config of windowService.windows$ | async; track config.windowId) {
        <app-window
          [config]="config"
          (windowEvent)="onWindowEvent($event)"
        >
          @switch (config.componentType) {
            @case ('DirlistComponent') {
              <app-dirlist [config]="config"></app-dirlist>
            }
            @case ('EditorComponent') {
              <app-editor [config]="config"></app-editor>
            }
            @default {
              <p>Unbekannter Fenstertyp: {{ config.componentType }}</p>
            }
          }
        </app-window>
      }
    </div>
  `,
  styles: [
    `
      .wm-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 50;
      }

      :host ::ng-deep .wm-window {
        pointer-events: auto;
      }
    `,
  ],
})
export class WindowContainerComponent {
  protected readonly windowService = inject(WindowService);

  /**
   * Handles events emitted by individual WindowComponent instances.
   * Routes drag/resize position updates to the service and forwards
   * action events.
   */
  onWindowEvent(event: WindowEvent): void {
    switch (event.action) {
      case WindowAction.Focus: {
        // Check if this is a drag event with position data
        const dragData = event.data as
          | { x: number; y: number; type: string }
          | undefined;

        if (dragData?.type === 'drag') {
          this.windowService.updatePosition(
            event.windowId,
            dragData.x,
            dragData.y,
          );
        } else {
          this.windowService.focus(event.windowId);
        }

        break;
      }

      case WindowAction.Resize: {
        const sizeData = event.data as
          | { width: number; height: number }
          | undefined;

        if (sizeData) {
          this.windowService.updateSize(
            event.windowId,
            sizeData.width,
            sizeData.height,
          );
        }

        break;
      }

      default:
        // Forward all other events to the service event bus
        this.windowService.incomingEvents$.next(event);
    }
  }
}
