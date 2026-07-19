import { useState } from "react";

// data-storage intentionally precedes oura: the Oura token is persisted into
// the SQLite file, so users must learn how to relocate it (e.g. onto an
// encrypted volume) BEFORE any secret is written (issue #8)
export const ONBOARDING_STEPS = [
  "welcome",
  "data-storage",
  "oura",
  "sleep-profile",
  "tracking-setup",
  "done",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function useOnboarding() {
  const [stepIndex, setStepIndex] = useState(0);

  const step = ONBOARDING_STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === ONBOARDING_STEPS.length - 1;
  const progress = ((stepIndex + 1) / ONBOARDING_STEPS.length) * 100;

  const next = () =>
    setStepIndex((i) => Math.min(i + 1, ONBOARDING_STEPS.length - 1));
  const back = () => setStepIndex((i) => Math.max(i - 1, 0));

  return { step, stepIndex, isFirst, isLast, progress, next, back };
}
