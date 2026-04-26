import { Subject } from 'rxjs';

/**
 * Event sent from the window component to the WindowService.
 * Format: action followed by colon-separated parameters.
 * Examples: "do_focus", "do_hide", "FileOpen:/path/to/file"
 */
export type WindowEvent = string;

/**
 * Configuration for a single modeless window.
 *
 * Each window has a unique id, a title, position/size, a z-index,
 * and bidirectional event channels to communicate with the WindowService
 * and its hosting component.
 */
export type WindowConfig = {
  /** Unique window id (assigned by WindowService) */
  windowId: string;

  /** Optional parent window id (used for closing children together) */
  parentWindowId?: string;

  /** Window title shown in the title bar */
  title: string;

  /** Tooltip / extended description */
  tooltip?: string;

  /** Component selector or kind (e.g. 'editor', 'inventory', 'char-stat') */
  component: string;

  /** Whether the window is currently visible */
  visible: boolean;

  /** Current z-index (managed by WindowService.focus()) */
  zIndex: number;

  /** Position X in pixels */
  posX: number;

  /** Position Y in pixels */
  posY: number;

  /** Width in pixels (0 = auto) */
  width: number;

  /** Height in pixels (0 = auto) */
  height: number;

  /** Whether the window can be saved (e.g. editor with unsaved changes) */
  saveable: boolean;

  /** Whether the cancel button should be hidden */
  noCancel: boolean;

  /** Arbitrary payload for the hosted component */
  data?: unknown;

  /**
   * Events sent FROM the window component TO the WindowService.
   * The WindowService subscribes to this in newWindow().
   */
  outgoing: Subject<WindowEvent>;

  /**
   * Events sent FROM the WindowService TO the window component.
   * The component subscribes to this in ngOnInit().
   */
  incoming: Subject<WindowEvent>;
};

/**
 * Subset of WindowConfig that the caller provides when creating a new window.
 * The WindowService fills in the rest (windowId, zIndex, outgoing, incoming).
 */
export type WindowConfigInput = Partial<
  Omit<WindowConfig, 'windowId' | 'zIndex' | 'outgoing' | 'incoming'>
> & {
  title: string;
  component: string;
};
