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

      <div
        role="alert"
        style={{
          border: "1px solid var(--color-warning)",
          borderRadius: "8px",
          background: "var(--color-bg-elevated)",
          padding: "1rem 1.25rem",
          margin: "0 0 1.5rem",
        }}
      >
        <p
          style={{
            color: "var(--color-warning)",
            fontWeight: 600,
            margin: "0 0 0.5rem",
          }}
        >
          ⚠ This database is not encrypted — protect it before you connect Oura
        </p>
        <p
          style={{
            color: "var(--color-text-secondary)",
            margin: "0 0 0.75rem",
            lineHeight: 1.6,
          }}
        >
          The file stores your Oura API token and every health entry you record
          — sleep, and sensitive categories like alcohol, illness, and sexual
          activity — as plain text. Anyone who can read the file can read all of
          it: a lost or stolen device without disk encryption, or another user
          account on a shared computer.
        </p>
        <p
          style={{
            color: "var(--color-text-secondary)",
            fontWeight: 600,
            margin: "0 0 0.25rem",
          }}
        >
          Recommended before continuing:
        </p>
        <ol
          style={{
            color: "var(--color-text-secondary)",
            paddingLeft: "1.5rem",
            lineHeight: 1.7,
            margin: 0,
          }}
        >
          <li>
            Turn on <strong>full-disk encryption</strong> on this device —
            FileVault (macOS), BitLocker (Windows), or LUKS/dm-crypt (Linux).
            This is the baseline that protects the file if the device is lost or
            stolen.
          </li>
          <li>
            For a second layer, keep the database inside an{" "}
            <strong>encrypted volume such as VeraCrypt</strong> and point Somnus
            at it (see below), so the data stays encrypted even while you are
            logged in and the volume is unmounted.
          </li>
        </ol>
      </div>

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
          To store it on an encrypted volume, quit and relaunch with{" "}
          <code>SOMNUS_DB_PATH=/your/encrypted/path/somnus.db</code> now — before
          connecting Oura — so your token is never written to the default
          location. The wizard saves your answers from the first screen, so
          after relaunching also delete <code>~/.somnus/somnus.db</code> and
          re-enter the few fields you have filled in so far.
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
