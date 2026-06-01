import { lazy, ComponentType } from "react";

// Wraps React.lazy with automatic recovery from stale chunk errors after a new
// deploy. When a dynamic import fails (chunk no longer exists on the server),
// we force a one-time hard reload so the user gets the new asset manifest
// instead of a blank white page.
const RELOAD_KEY = "megsy:chunk-reloaded-at";

export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): ReturnType<typeof lazy<T>> {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err: any) {
      const msg = String(err?.message || err || "");
      const isChunkError =
        /Loading chunk|Loading CSS chunk|Failed to fetch dynamically imported module|Importing a module script failed|dynamically imported module/i.test(
          msg,
        );
      if (!isChunkError) throw err;

      // Avoid infinite reload loop — only reload once per minute.
      try {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || "0");
        if (Date.now() - last < 60_000) throw err;
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      } catch {}

      window.location.reload();
      // Return a never-resolving promise so Suspense keeps the fallback while
      // the page reloads.
      return new Promise<never>(() => {});
    }
  });
}
