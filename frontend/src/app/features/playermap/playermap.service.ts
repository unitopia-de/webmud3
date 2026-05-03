import { inject, Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';

import { MudSignalService } from '@webmud3/frontend/features/gmcp/signals/mud-signal.service';
import type { PlayermapInfoSignal } from '@webmud3/frontend/features/gmcp/signals/mud-signals';

/** Reactive snapshot of the current playermap state. */
export type PlayermapState = {
  /** Map text as delivered by the MUD (no further normalization). */
  map: string | null;
  /** Player position on the map, if reported by the provider. */
  pos?: [number, number];
  /** Fill character used by the provider (defaults to space). */
  fill?: string;
};

const EMPTY_STATE: PlayermapState = { map: null };

/**
 * Holds the current Playermap state derived from `Playermap.Info` GMCP
 * messages (UNItopia-specific). The component layer subscribes to `state$`
 * and re-renders the 25x25 view whenever the player moves.
 */
@Injectable({ providedIn: 'root' })
export class PlayermapService implements OnDestroy {
  private readonly signals = inject(MudSignalService);

  private readonly stateSubject = new BehaviorSubject<PlayermapState>(EMPTY_STATE);
  private readonly subscription: Subscription;

  public readonly state$ = this.stateSubject.asObservable();

  constructor() {
    this.subscription = this.signals
      .on('Playermap.Info')
      .subscribe((signal) => this.update(signal));
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  public get state(): PlayermapState {
    return this.stateSubject.value;
  }

  public clear(): void {
    this.stateSubject.next(EMPTY_STATE);
  }

  private update(signal: PlayermapInfoSignal): void {
    this.stateSubject.next({
      map: signal.map,
      pos: signal.pos,
      fill: signal.fill,
    });
  }
}
