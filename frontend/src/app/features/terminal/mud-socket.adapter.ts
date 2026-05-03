import { Observable, Subscription } from 'rxjs';

/**
 * Optional hooks invoked while processing a chunk of MUD output.
 */
export type MudSocketAdapterHooks = {
  transformMessage?: (data: string) => string;
  beforeMessage?: (data: string) => void;
  afterMessage?: (data: string) => void;
  /**
   * Called for every raw chunk arriving from the server, before any
   * transform. Used by the debug "output hex log" feature.
   */
  rawMessage?: (data: string) => void;
};

type SocketListener = EventListener;

/**
 * Minimal WebSocket-like adapter that feeds xterm's AttachAddon with the
 * server output stream coming from the MudService. Each emission from the
 * observable is converted into a `message` event, with optional transform
 * hooks to intercept or mutate the payload.
 */
export class MudSocketAdapter {
  public binaryType: BinaryType = 'arraybuffer';
  // Mimics WebSocket state; set to CLOSED when dispose/close is called.
  public readyState: number = WebSocket.OPEN;

  private readonly listeners = new Map<string, Set<SocketListener>>();
  private readonly subscription: Subscription;

  /**
   * @param output$ Observable delivering MUD output chunks.
   * @param hooks Optional callbacks invoked before/after transforming emissions.
   */
  constructor(
    output$: Observable<{ data: string }>,
    private readonly hooks?: MudSocketAdapterHooks,
  ) {
    this.subscription = output$.subscribe(({ data }) => {
      this.hooks?.rawMessage?.(data);
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

  /**
   * Registers a listener for the given event type (only `message` is relevant).
   */
  public addEventListener(type: string, listener: SocketListener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    this.listeners.get(type)!.add(listener);
  }

  /**
   * Removes a previously registered listener, cleaning up empty buckets.
   */
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

  /**
   * This is a no-op since input flows via terminal.onData. We need to implement this to satisfy
   * the WebSocket interface, but since this adapter is output-only calls to send() are ignored.
   */
  public send(): void {
    if (this.readyState !== WebSocket.OPEN) {
      console.warn(
        'MudSocketAdapter.send(): adapter is closed; input is output-only',
      );
    }
  }

  /**
   * Closes the adapter by disposing the subscription (alias of {@link dispose}).
   */
  public close() {
    this.dispose();
  }

  /**
   * Removes all listeners and unsubscribes from the output stream.
   */
  public dispose() {
    this.subscription.unsubscribe();
    this.listeners.clear();
    this.readyState = WebSocket.CLOSED;
  }

  /**
   * Dispatches a cloned event to all listeners of the given type.
   */
  private dispatch(type: string, event: Event) {
    const listeners = this.listeners.get(type);

    if (!listeners) {
      return;
    }

    listeners.forEach((listener) => listener.call(this, event));
  }
}
