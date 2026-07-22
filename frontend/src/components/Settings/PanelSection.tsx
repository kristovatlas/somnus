import { useCallback, useEffect, useState } from "react";
import { listPanels, createPanel, updatePanel } from "../../api/redLightPanels";
import type {
  RedLightPanelOut,
  RedLightPanelCreate,
} from "../../api/redLightPanels";
import { fetchVoid } from "../../api/client";
import { blurOnWheel } from "../../wheelGuard";
import "./PanelSection.css";

interface FormState {
  name: string;
  wavelength: string;
  irradiance: string;
  distance: string;
}

const EMPTY: FormState = {
  name: "",
  wavelength: "",
  irradiance: "",
  distance: "",
};

function toForm(p: RedLightPanelOut): FormState {
  return {
    name: p.name,
    wavelength: p.wavelength_nm?.toString() ?? "",
    irradiance: p.irradiance_mw_cm2?.toString() ?? "",
    distance: p.default_distance_inches?.toString() ?? "",
  };
}

function toPayload(f: FormState): RedLightPanelCreate {
  return {
    name: f.name.trim(),
    wavelength_nm: f.wavelength ? Number(f.wavelength) : null,
    irradiance_mw_cm2: f.irradiance ? Number(f.irradiance) : null,
    default_distance_inches: f.distance ? Number(f.distance) : null,
  };
}

export function PanelSection() {
  const [panels, setPanels] = useState<RedLightPanelOut[]>([]);
  // null = closed; "new" = add form; a number = editing that panel id
  const [editing, setEditing] = useState<"new" | number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const loadPanels = useCallback(() => {
    listPanels()
      .then(setPanels)
      .catch(() => setError("Failed to load panels"));
  }, []);

  useEffect(() => {
    loadPanels();
  }, [loadPanels]);

  function openAdd() {
    setForm(EMPTY);
    setEditing("new");
    setError(null);
  }

  function openEdit(p: RedLightPanelOut) {
    setForm(toForm(p));
    setEditing(p.id);
    setError(null);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setError(null);
    try {
      if (editing === "new") {
        await createPanel(toPayload(form));
      } else if (typeof editing === "number") {
        await updatePanel(editing, toPayload(form));
      }
      setEditing(null);
      loadPanels();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save panel");
    }
  }

  async function handleDelete(id: number) {
    try {
      await fetchVoid(`/api/red-light-panels/${id}`, { method: "DELETE" });
      loadPanels();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete panel");
    }
  }

  const set =
    (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const formFields = (
    <div className="panel-add-form">
      <input
        placeholder="Panel name"
        value={form.name}
        onChange={set("name")}
      />
      <input
        type="number"
        placeholder="Wavelength (nm)"
        value={form.wavelength}
        onChange={set("wavelength")}
        onWheel={blurOnWheel}
        min={600}
        max={900}
      />
      <input
        type="number"
        placeholder="Irradiance (mW/cm²)"
        value={form.irradiance}
        onChange={set("irradiance")}
        onWheel={blurOnWheel}
        min={0}
        step={0.1}
      />
      <input
        type="number"
        placeholder="Distance (inches)"
        value={form.distance}
        onChange={set("distance")}
        onWheel={blurOnWheel}
        min={0}
        step={0.5}
      />
      <p className="panel-field-hint">
        Distance is where the panel's irradiance is rated — used to
        inverse-square-adjust each session's dose. Pre-fills a session's
        distance in the Daily Log.
      </p>
      <div className="panel-add-actions">
        <button onClick={handleSave} disabled={!form.name.trim()}>
          Save
        </button>
        <button className="panel-cancel-btn" onClick={() => setEditing(null)}>
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <section className="settings-section">
      <h2 className="settings-section-title">Red Light Panels</h2>

      {panels.length === 0 && editing !== "new" && (
        <p className="panel-empty">No panels configured yet.</p>
      )}

      <ul className="panel-list">
        {panels.map((p) =>
          editing === p.id ? (
            <li key={p.id} className="panel-item panel-item-editing">
              {formFields}
            </li>
          ) : (
            <li key={p.id} className="panel-item">
              <div className="panel-info">
                <span className="panel-name">{p.name}</span>
                {p.wavelength_nm && (
                  <span className="panel-detail">{p.wavelength_nm}nm</span>
                )}
                {p.irradiance_mw_cm2 != null && (
                  <span className="panel-detail">
                    {p.irradiance_mw_cm2} mW/cm²
                  </span>
                )}
                {p.default_distance_inches != null && (
                  <span className="panel-detail">
                    @ {p.default_distance_inches}″
                  </span>
                )}
              </div>
              <div className="panel-actions">
                <button className="panel-edit-btn" onClick={() => openEdit(p)}>
                  Edit
                </button>
                <button
                  className="panel-delete-btn"
                  onClick={() => handleDelete(p.id)}
                >
                  Remove
                </button>
              </div>
            </li>
          ),
        )}
      </ul>

      {editing === "new" ? (
        formFields
      ) : editing === null ? (
        <button className="panel-add-btn" onClick={openAdd}>
          + Add Panel
        </button>
      ) : null}

      {error && <p className="panel-error">{error}</p>}
    </section>
  );
}
