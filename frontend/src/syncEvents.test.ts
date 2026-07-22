// #100: sync-completion announcements connect the launch-sync chip to data
// consumers without either knowing about the other.
import { describe, expect, it, vi } from "vitest";
import { announceSyncComplete, onSyncComplete } from "./syncEvents";

describe("syncEvents (#100)", () => {
  it("delivers the synced count to subscribers", () => {
    const handler = vi.fn();
    const unsubscribe = onSyncComplete(handler);
    announceSyncComplete(3);
    expect(handler).toHaveBeenCalledWith(3);
    unsubscribe();
  });

  it("stops delivering after unsubscribe", () => {
    const handler = vi.fn();
    const unsubscribe = onSyncComplete(handler);
    unsubscribe();
    announceSyncComplete(1);
    expect(handler).not.toHaveBeenCalled();
  });
});
