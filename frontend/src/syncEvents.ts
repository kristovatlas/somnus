/** #100: sync-completion announcements.
 *
 * The launch auto-sync (#57) races the Dashboard's mount fetch and always
 * loses — the Oura round-trip outlasts the local read — so the first paint
 * showed pre-sync data with no way to recover short of another reload.
 * Data consumers subscribe here to refetch the moment a sync lands.
 * A window CustomEvent keeps this dependency-free: the chip and any page
 * can stay strangers.
 */

export const SYNC_COMPLETE_EVENT = "somnus:oura-sync-complete";

export function announceSyncComplete(syncedCount: number): void {
  window.dispatchEvent(
    new CustomEvent(SYNC_COMPLETE_EVENT, { detail: { syncedCount } }),
  );
}

/** Subscribe to sync completions; returns the unsubscribe function. */
export function onSyncComplete(
  handler: (syncedCount: number) => void,
): () => void {
  const listener = (e: Event) => {
    const detail = (e as CustomEvent<{ syncedCount: number }>).detail;
    handler(detail?.syncedCount ?? 0);
  };
  window.addEventListener(SYNC_COMPLETE_EVENT, listener);
  return () => window.removeEventListener(SYNC_COMPLETE_EVENT, listener);
}
