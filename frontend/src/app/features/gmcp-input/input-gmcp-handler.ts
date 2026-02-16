import { inject, Injectable } from '@angular/core';
import { Subject } from 'rxjs';

import { GmcpService } from '../gmcp/gmcp.service';
import type { GmcpModuleHandler } from '../gmcp/gmcp-module-handler';

/**
 * Result of a tab-completion request from the MUD.
 */
export interface CompletionResult {
  /** Type of completion response */
  type: 'text' | 'choice' | 'none';
  /** Completed text (for type='text') */
  value?: string;
  /** List of choices (for type='choice'), each entry is [display, insert] */
  options?: string[][];
}

/**
 * GMCP handler for the `Input` module.
 *
 * Handles tab-completion responses from the MUD:
 * - `Input.CompleteText`   → Single completion, replace current word
 * - `Input.CompleteChoice` → Multiple options, show overlay
 * - `Input.CompleteNone`   → No completion available
 *
 * Workflow:
 * 1. User presses Tab → MudInputController extracts current word
 * 2. GmcpService sends `Input.Complete { text: currentWord }`
 * 3. MUD responds with one of CompleteText/Choice/None
 * 4. MudClientComponent subscribes to completionResult$ and updates the input
 */
@Injectable({ providedIn: 'root' })
export class InputGmcpHandler implements GmcpModuleHandler {
  readonly moduleName = 'Input';
  readonly version = '1';

  private readonly gmcpService = inject(GmcpService);

  /** Emits completion results for the MudClientComponent to consume */
  public readonly completionResult$ = new Subject<CompletionResult>();

  /**
   * Routes incoming GMCP `Input.*` messages.
   */
  handleMessage(message: string, data: unknown): void {
    switch (message) {
      case 'CompleteText':
        this.completionResult$.next({ type: 'text', value: data as string });
        console.debug('[InputGmcpHandler] CompleteText:', data);
        break;

      case 'CompleteChoice':
        this.completionResult$.next({ type: 'choice', options: data as string[][] });
        console.debug('[InputGmcpHandler] CompleteChoice:', data);
        break;

      case 'CompleteNone':
        this.completionResult$.next({ type: 'none' });
        console.debug('[InputGmcpHandler] CompleteNone');
        break;

      default:
        console.debug(`[InputGmcpHandler] Unknown message: Input.${message}`, data);
    }
  }

  /**
   * Sends a tab-completion request to the MUD.
   *
   * @param text - The current word/text to complete
   */
  public requestCompletion(text: string): void {
    this.gmcpService.sendOutgoing('Input', 'Complete', { text });

    console.debug('[InputGmcpHandler] Requesting completion for:', text);
  }

  /**
   * Cleanup.
   */
  dispose(): void {
    console.info('[InputGmcpHandler] Disposed.');
  }
}
