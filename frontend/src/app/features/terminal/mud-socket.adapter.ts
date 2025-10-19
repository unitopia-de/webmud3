import { Observable, Subscription } from 'rxjs';

export type MudSocketAdapterHooks = {
  transformMessage?: (data: string) => string;
  beforeMessage?: (data: string) => void;
  afterMessage?: (data: string) => void;
};

type SocketListener = EventListener;

/**
 * Minimal WebSocket-like adapter that feeds xterm's AttachAddon with the
 * server output stream coming from the MudService. It translates output$
 * emissions into `message` events for the addon.
 */
export class MudSocketAdapter {
  public binaryType: BinaryType = 'arraybuffer';
  public readyState = WebSocket.OPEN;

  private readonly listeners = new Map<string, Set<SocketListener>>();
  private readonly subscription: Subscription;

  constructor(
    output$: Observable<{ data: string }>,
    private readonly hooks?: MudSocketAdapterHooks,
  ) {
    this.subscription = output$.subscribe(({ data }) => {
      this.hooks?.beforeMessage?.(data);

      const transformed = this.hooks?.transformMessage?.(data) ?? data;

      if (transformed.length > 0) {
        this.dispatch(
          'message',
          new MessageEvent('message', { data: transformed }),
        );
      }

      this.hooks?.afterMessage?.(transformed);
    });
  }

  public addEventListener(type: string, listener: SocketListener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    this.listeners.get(type)!.add(listener);
  }

  public removeEventListener(type: string, listener: SocketListener) {
    const listeners = this.listeners.get(type);
    if (!listeners) {
      return;
    }

    listeners.delete(listener);

    if (listeners.size === 0) {
      this.listeners.delete(type);
    }
  }

  public send(): void {
    // Input handling is managed separately via terminal.onData
  }

  public close() {
    this.dispose();
  }

  public dispose() {
    this.subscription.unsubscribe();
    this.listeners.clear();
  }

  private dispatch(type: string, event: Event) {
    const listeners = this.listeners.get(type);

    if (!listeners) {
      return;
    }

    listeners.forEach((listener) => listener.call(this, event));
  }
}
