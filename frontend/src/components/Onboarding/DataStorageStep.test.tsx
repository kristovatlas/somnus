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

  it("keeps the SOMNUS_DB_PATH relocation instructions", () => {
    render(<DataStorageStep onNext={mockNext} onBack={mockBack} />);
    expect(screen.getByText(/SOMNUS_DB_PATH=/)).toBeInTheDocument();
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
