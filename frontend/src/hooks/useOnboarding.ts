import { useState } from "react";

export const ONBOARDING_STEPS = [
  "welcome",
  "oura",
  "sleep-profile",
  "tracking-setup",
  "data-storage",
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
