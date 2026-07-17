import { useEffect, useState } from "react";
import { syncOura } from "../../api/oura";
import { launchSyncHasFired, markLaunchSyncFired } from "../../launchSync";
import type { OuraSyncResponse } from "../../types";
import "./OuraSyncIndicator.css";

type SyncState =
  | { phase: "syncing" }
  | { phase: "done"; syncedCount: number; errors: string[] }
  | { phase: "failed" };

/** #57: auto-sync Oura once per app launch.
 *
 * Visible, unobtrusive, unambiguous (the #35 lesson: no invisible
 * background writes): a nav-area chip announces the sync while it runs,
 * reports the outcome, and offers Retry on failure. The backend's
 * watermark + lock make the POST cheap and idempotent, so an overlapping
 * Settings "Sync Now" is harmless; the module-level guard keeps it to one
 * launch sync per page load across remounts.
 */
export function OuraSyncIndicator() {
  // If this mount is the one that fires the sync, it starts in "syncing" —
  // set via the initializer so the effect never sets state synchronously.
  const [state, setState] = useState<SyncState | null>(() =>
    launchSyncHasFired() ? null : { phase: "syncing" },
  );

  useEffect(() => {
    if (launchSyncHasFired()) return;
    markLaunchSyncFired();
    syncOura()
      .then((result: OuraSyncResponse) => {
        setState({
          phase: "done",
          syncedCount: result.synced_count,
          errors: result.errors,
        });
      })
      .catch(() => setState({ phase: "failed" }));
  }, []);

  const retry = () => {
    setState({ phase: "syncing" });
    syncOura()
      .then((result: OuraSyncResponse) => {
        setState({
          phase: "done",
          syncedCount: result.synced_count,
          errors: result.errors,
        });
      })
      .catch(() => setState({ phase: "failed" }));
  };

  if (state === null) return null;

  if (state.phase === "syncing") {
    return (
      <span className="oura-sync-chip" role="status">
        Syncing Oura…
      </span>
    );
  }

  if (state.phase === "failed") {
    return (
      <span className="oura-sync-chip oura-sync-chip--error" role="alert">
        Oura sync failed
        <button type="button" onClick={retry}>
          Retry
        </button>
      </span>
    );
  }

  if (state.errors.length > 0) {
    return (
      <span className="oura-sync-chip oura-sync-chip--error" role="alert">
        Oura synced with {state.errors.length} error
        {state.errors.length === 1 ? "" : "s"}
      </span>
    );
  }

  return (
    <span className="oura-sync-chip oura-sync-chip--done" role="status">
      Oura synced{state.syncedCount > 0 ? ` · ${state.syncedCount} new` : ""}
    </span>
  );
}
