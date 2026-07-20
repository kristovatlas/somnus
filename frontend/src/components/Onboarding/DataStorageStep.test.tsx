import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { DataStorageStep } from "./DataStorageStep";

describe("DataStorageStep", () => {
  let mockNext: Mock<() => void>;
  let mockBack: Mock<() => void>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = vi.fn<() => void>();
    mockBack = vi.fn<() => void>();
  });

  // T-07 (docs/THREAT_MODEL.md): the plaintext-at-rest residual is accepted
  // for v0.1 *on the condition* that the user is warned loudly and pointed at
  // full-disk encryption + an optional encrypted volume. These assertions
  // guard that guidance against silent removal.
  it("warns that the database is not encrypted", () => {
    render(<DataStorageStep onNext={mockNext} onBack={mockBack} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/not encrypted/i);
    expect(alert).toHaveTextContent(/plain text/i);
  });

  it("names the sensitive data at risk", () => {
    render(<DataStorageStep onNext={mockNext} onBack={mockBack} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/Oura API token/i);
    expect(alert).toHaveTextContent(/lost or stolen device/i);
  });

  it("recommends full-disk encryption and an encrypted volume such as VeraCrypt", () => {
    render(<DataStorageStep onNext={mockNext} onBack={mockBack} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/full-disk encryption/i);
    expect(alert).toHaveTextContent(/FileVault/);
    expect(alert).toHaveTextContent(/BitLocker/);
    expect(alert).toHaveTextContent(/VeraCrypt/);
  });

  // #41 (ADR 015): the location is chosen at launch, so this step CONFIRMS
  // where data lives and how to move it — it no longer instructs a
  // quit-relaunch-delete dance (that contradicted the launcher).
  it("confirms the launcher-chosen location and how to change it", () => {
    render(<DataStorageStep onNext={mockNext} onBack={mockBack} />);
    expect(
      screen.getByText(/location you chose when you started Somnus/i),
    ).toBeInTheDocument();
    // #97: the instruction must name the WORKING command — a bare
    // `make db-location` is a report-only no-op once configured.
    expect(
      screen.getByText(/make db-location ARGS="--force"/),
    ).toBeInTheDocument();
    // the obsolete "delete ~/.somnus/somnus.db and relaunch" copy is gone
    expect(screen.queryByText(/delete/i)).not.toBeInTheDocument();
  });

  // #98: the old absolute claim ("Nothing is sent to external servers") was
  // false once Oura is connected — the PAT + date ranges go to Oura's API
  // (THREAT_MODEL B3). The copy must name that egress, not deny it.
  it("qualifies the local-only claim with the Oura egress", () => {
    render(<DataStorageStep onNext={mockNext} onBack={mockBack} />);
    expect(
      screen.queryByText(/nothing is sent to external servers/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/only outbound traffic is to Oura/i),
    ).toBeInTheDocument();
  });

  it("navigates forward and back", async () => {
    const user = userEvent.setup();
    render(<DataStorageStep onNext={mockNext} onBack={mockBack} />);
    await user.click(screen.getByRole("button", { name: /back/i }));
    expect(mockBack).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: /next|continue/i }));
    expect(mockNext).toHaveBeenCalledOnce();
  });
});
