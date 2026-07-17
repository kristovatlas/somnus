import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { OuraSyncIndicator } from "./OuraSyncIndicator";
import { resetLaunchSyncGuard } from "../../launchSync";

function mockSyncResponse(body: object, status = 200) {
  vi.spyOn(globalThis, "fetch").mockImplementation(
    async () => new Response(JSON.stringify(body), { status }),
  );
}

const okResult = {
  synced_count: 3,
  start_date: "2026-07-01",
  end_date: "2026-07-16",
  errors: [],
};

describe("OuraSyncIndicator", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetLaunchSyncGuard();
  });

  it("fires the sync once on mount and reports the count", async () => {
    mockSyncResponse(okResult);
    render(<OuraSyncIndicator />);
    expect(screen.getByRole("status")).toHaveTextContent("Syncing Oura…");

    expect(await screen.findByText("Oura synced · 3 new")).toBeInTheDocument();
    const syncCalls = vi
      .mocked(globalThis.fetch)
      .mock.calls.filter(([url]) => String(url).includes("/api/oura/sync"));
    expect(syncCalls).toHaveLength(1);
  });

  it("omits the count when nothing was new", async () => {
    mockSyncResponse({ ...okResult, synced_count: 0 });
    render(<OuraSyncIndicator />);
    expect(await screen.findByText("Oura synced")).toBeInTheDocument();
  });

  it("a failed sync is unambiguous and offers Retry", async () => {
    let fail = true;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      if (fail)
        return new Response(JSON.stringify({ detail: "boom" }), {
          status: 502,
        });
      return new Response(JSON.stringify(okResult));
    });
    const user = userEvent.setup();
    render(<OuraSyncIndicator />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Oura sync failed",
    );

    fail = false;
    await user.click(screen.getByText("Retry"));
    expect(await screen.findByText("Oura synced · 3 new")).toBeInTheDocument();
  });

  it("partial errors from the backend are surfaced, not hidden", async () => {
    mockSyncResponse({ ...okResult, errors: ["chunk 2026-03 failed"] });
    render(<OuraSyncIndicator />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Oura synced with 1 error",
    );
  });

  it("only one launch sync fires per page load, even across remounts", async () => {
    mockSyncResponse(okResult);
    const first = render(<OuraSyncIndicator />);
    await screen.findByText("Oura synced · 3 new");
    first.unmount();

    render(<OuraSyncIndicator />);
    const syncCalls = vi
      .mocked(globalThis.fetch)
      .mock.calls.filter(([url]) => String(url).includes("/api/oura/sync"));
    expect(syncCalls).toHaveLength(1);
  });
});
