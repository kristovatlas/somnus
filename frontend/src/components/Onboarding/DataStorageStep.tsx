import { StepNavigation } from "./StepNavigation";

interface DataStorageStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function DataStorageStep({ onNext, onBack }: DataStorageStepProps) {
  return (
    <div>
      <h2>Your Data Stays Local</h2>
      <p
        style={{
          color: "var(--color-text-secondary)",
          margin: "0.5rem 0 1.5rem",
        }}
      >
        All your sleep and health data — including the Oura token you can add in
        the next step — is stored in a local SQLite database. Nothing is sent to
        external servers.
      </p>

      <ul
        style={{
          color: "var(--color-text-secondary)",
          paddingLeft: "1.5rem",
          lineHeight: 2,
        }}
      >
        <li>
          Default location: <code>~/.somnus/somnus.db</code>
        </li>
        <li>
          Prefer an encrypted volume? Quit and relaunch with{" "}
          <code>SOMNUS_DB_PATH=/your/path/somnus.db</code> now — before
          connecting Oura — so your token is never written to the default
          location.
        </li>
        <li>Export your data anytime as CSV or JSON</li>
        <li>No cloud accounts required</li>
      </ul>

      <StepNavigation
        isFirst={false}
        isLast={false}
        onBack={onBack}
        onNext={onNext}
      />
    </div>
  );
}
