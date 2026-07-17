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
          {/* U+FE0E forces text (monochrome) presentation so the glyph
              inherits --color-warning instead of rendering as a yellow
              color emoji, which would violate the circadian palette (ADR 004). */}
          {"⚠︎ "}This database is not encrypted — protect it with disk encryption
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
            <strong>encrypted volume such as VeraCrypt</strong>. If you have not
            already pointed Somnus at one (you chose the location when you
            started it — see below), you can move it there anytime; on an
            encrypted volume the data stays protected even while it is
            unmounted.
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
          Your database is stored at the location you chose when you started
          Somnus (the launcher prompted you before any data was written).
        </li>
        <li>
          To move it — for example onto an encrypted volume you set up later —
          mount the volume, then re-run <code>make db-location</code> (or set{" "}
          <code>SOMNUS_DB_PATH</code>) and restart Somnus.
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
