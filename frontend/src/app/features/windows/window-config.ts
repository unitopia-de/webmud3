/**
 * Actions that can be communicated between a window and the WindowService.
 */
export enum WindowAction {
  /** Bring window to front */
  Focus = 'focus',
  /** Close / hide the window */
  Hide = 'hide',
  /** Content requests a save operation */
  Save = 'save',
  /** Content requests cancel (close without saving) */
  Cancel = 'cancel',
  /** Save completed, close the window */
  SaveAndClose = 'saveAndClose',
  /** An error occurred inside the window content */
  WinError = 'winError',
  /** Window was resized by the user */
  Resize = 'resize',
  /** Parent window was closed → children should clean up */
  CloseParent = 'closeParent',
}

/**
 * Event payload flowing between the WindowService and window content components.
 */
export interface WindowEvent {
  /** The action being performed */
  action: WindowAction;
  /** The ID of the window this event relates to */
  windowId: string;
  /** Optional payload (e.g. error message, new size) */
  data?: unknown;
}

/**
 * Configuration for a single modeless window instance.
 *
 * Immutable after creation — updates are done by replacing the config
 * in the WindowService's BehaviorSubject.
 */
export interface WindowConfig {
  /** Unique identifier (UUID) */
  windowId: string;
  /** ID of the parent window (for parent-child relationships) */
  parentWindowId?: string;
  /** Whether the window is currently visible */
  visible: boolean;
  /** Title displayed in the title bar */
  title: string;
  /** Optional tooltip on hover */
  tooltip?: string;
  /** Whether the window should start in a locked (non-draggable) state */
  initialLock: boolean;
  /** Whether the save button is shown */
  allowSave: boolean;
  /** Whether the cancel button is shown */
  showCancel: boolean;
  /**
   * String key identifying which component to render inside the window.
   * The WindowContainerComponent uses this to select the correct content.
   */
  componentType: string;
  /** Z-index for stacking order */
  zIndex: number;
  /** Position on screen (top-left corner) */
  position: { x: number; y: number };
  /** Optional explicit size; if omitted, window sizes to content */
  size?: { width: number; height: number };
  /** Arbitrary data passed to the content component */
  data?: unknown;
}
