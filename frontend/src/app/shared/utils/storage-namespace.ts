/**
 * Per-instance namespacing for `localStorage`.
 *
 * Browsers scope `localStorage` to the origin (scheme + host + port), so two
 * deployments on the same domain — e.g. `unitopia.de/Webmud3` and
 * `unitopia.de/webmud3test` — share the same storage bucket and step on each
 * other's session tokens, history and settings.
 *
 * This module derives a stable per-instance prefix from `document.baseURI`
 * (the `<base href>` set at build time) and provides a small wrapper that
 * applies it transparently. Production and test deployment now have
 * disjoint storage:
 *
 *   unitopia.de/Webmud3:webmud3-history
 *   unitopia.de/webmud3test:webmud3-history
 *
 * To avoid wiping settings for users upgrading from the previous build, a
 * one-shot migration copies any legacy un-namespaced value into the new key
 * on first read. The legacy entry is intentionally left in place so the
 * sibling deployment can adopt it as well.
 */

let cachedPrefix: string | null | undefined;

function getNamespacePrefix(): string | null {
  if (cachedPrefix !== undefined) {
    return cachedPrefix;
  }

  try {
    const url = new URL(document.baseURI);
    const path = url.pathname.replace(/\/+$/, '');

    cachedPrefix = `${url.host}${path}`;
  } catch {
    cachedPrefix = null;
  }

  return cachedPrefix;
}

/**
 * Returns the fully-qualified storage key for `suffix`. Exported mainly so
 * tests / debugging can construct the same key the wrapper writes under.
 */
export function namespacedKey(suffix: string): string {
  const prefix = getNamespacePrefix();

  return prefix ? `${prefix}:${suffix}` : suffix;
}

export const namespacedStorage = {
  /**
   * Reads `suffix` from the namespaced bucket. Falls back to the legacy
   * (un-namespaced) entry once and copies it forward — see file header.
   */
  get(suffix: string): string | null {
    const key = namespacedKey(suffix);

    try {
      const current = localStorage.getItem(key);

      if (current !== null) {
        return current;
      }

      // Migrate from the previous (un-namespaced) layout if present.
      if (key === suffix) {
        // No prefix in effect — legacy and namespaced collapse to the same key.
        return null;
      }

      const legacy = localStorage.getItem(suffix);

      if (legacy === null) {
        return null;
      }

      try {
        localStorage.setItem(key, legacy);
      } catch {
        // Quota or other storage error during forward-copy is non-fatal:
        // the caller still receives the legacy value.
      }

      return legacy;
    } catch {
      return null;
    }
  },

  set(suffix: string, value: string): void {
    try {
      localStorage.setItem(namespacedKey(suffix), value);
    } catch {
      // Caller decides whether to surface storage errors.
    }
  },

  remove(suffix: string): void {
    try {
      localStorage.removeItem(namespacedKey(suffix));
    } catch {
      // ignore
    }
  },
};
