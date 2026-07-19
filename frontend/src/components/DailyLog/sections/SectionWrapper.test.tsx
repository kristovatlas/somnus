import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { SectionWrapper } from "./SectionWrapper";

describe("SectionWrapper", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders title", () => {
    render(
      <SectionWrapper title="Caffeine" storageKey="test">
        <p>Content</p>
      </SectionWrapper>,
    );
    expect(screen.getByText("Caffeine")).toBeInTheDocument();
  });

  it("shows count badge when count > 0", () => {
    render(
      <SectionWrapper title="Caffeine" count={3} storageKey="test">
        <p>Content</p>
      </SectionWrapper>,
    );
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("hides content by default when defaultOpen is false", () => {
    render(
      <SectionWrapper title="Caffeine" storageKey="test" defaultOpen={false}>
        <p>Hidden content</p>
      </SectionWrapper>,
    );
    expect(screen.queryByText("Hidden content")).not.toBeInTheDocument();
  });

  it("shows content when defaultOpen is true", () => {
    render(
      <SectionWrapper title="Caffeine" storageKey="test" defaultOpen>
        <p>Visible content</p>
      </SectionWrapper>,
    );
    expect(screen.getByText("Visible content")).toBeInTheDocument();
  });

  it("toggles on click", async () => {
    const user = userEvent.setup();
    render(
      <SectionWrapper title="Caffeine" storageKey="test" defaultOpen={false}>
        <p>Toggle me</p>
      </SectionWrapper>,
    );
    expect(screen.queryByText("Toggle me")).not.toBeInTheDocument();
    await user.click(screen.getByText("Caffeine"));
    expect(screen.getByText("Toggle me")).toBeInTheDocument();
    await user.click(screen.getByText("Caffeine"));
    expect(screen.queryByText("Toggle me")).not.toBeInTheDocument();
  });

  it("persists state in localStorage", async () => {
    const user = userEvent.setup();
    render(
      <SectionWrapper
        title="Caffeine"
        storageKey="persist-test"
        defaultOpen={false}
      >
        <p>Content</p>
      </SectionWrapper>,
    );
    await user.click(screen.getByText("Caffeine"));
    expect(localStorage.getItem("somnus-section-persist-test")).toBe("true");
  });
});
