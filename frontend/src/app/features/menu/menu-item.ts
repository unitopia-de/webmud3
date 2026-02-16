/**
 * Represents a single item in the application menu hierarchy.
 * Supports up to 3 levels of nesting (menubar → dropdown → submenu).
 */
export interface MenuItem {
  /** Unique identifier for this menu item */
  id: string;
  /** Display label */
  label: string;
  /** Icon identifier (optional, for future use) */
  icon?: string;
  /** Whether the item is disabled (greyed out) */
  disabled?: boolean;
  /** Whether the item is visible */
  visible?: boolean;
  /** Whether this is a visual separator line */
  separator?: boolean;
  /** Whether the item is in a checked/toggled state */
  checked?: boolean;
  /** Action to execute when clicked */
  command?: (event: MenuEvent) => void;
  /** Child items (submenu) */
  children?: MenuItem[];
}

/**
 * Event payload passed to MenuItem command callbacks.
 */
export interface MenuEvent {
  /** The menu item that was activated */
  item: MenuItem;
  /** The original DOM event (if available) */
  originalEvent?: Event;
}
