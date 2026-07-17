/** #57: once-per-page-load guard for the launch Oura sync. Module state —
 * survives Layout remounts (route changes, StrictMode) within one load. */
let fired = false;

export function launchSyncHasFired(): boolean {
  return fired;
}

export function markLaunchSyncFired(): void {
  fired = true;
}

/** Test seam. */
export function resetLaunchSyncGuard(): void {
  fired = false;
}
