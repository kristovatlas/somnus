import { useCallback, useEffect, useState } from 'react'
import { listPanels, createPanel } from '../../api/redLightPanels'
import type { RedLightPanelOut, RedLightPanelCreate } from '../../api/redLightPanels'
import { fetchVoid } from '../../api/client'
import './PanelSection.css'

export function PanelSection() {
  const [panels, setPanels] = useState<RedLightPanelOut[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [wavelength, setWavelength] = useState('')
  const [irradiance, setIrradiance] = useState('')
  const [error, setError] = useState<string | null>(null)

  const loadPanels = useCallback(() => {
    listPanels().then(setPanels).catch(() => setError('Failed to load panels'))
  }, [])

  useEffect(() => {
    loadPanels()
  }, [loadPanels])

  async function handleAdd() {
    if (!name.trim()) return
    setError(null)
    const data: RedLightPanelCreate = { name: name.trim() }
    if (wavelength) data.wavelength_nm = Number(wavelength)
    if (irradiance) data.irradiance_mw_cm2 = Number(irradiance)
    try {
      await createPanel(data)
      setName('')
      setWavelength('')
      setIrradiance('')
      setShowAdd(false)
      loadPanels()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create panel')
    }
  }

  async function handleDelete(id: number) {
    try {
      await fetchVoid(`/api/red-light-panels/${id}`, { method: 'DELETE' })
      loadPanels()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete panel')
    }
  }

  return (
    <section className="settings-section">
      <h2 className="settings-section-title">Red Light Panels</h2>

      {panels.length === 0 && !showAdd && (
        <p className="panel-empty">No panels configured yet.</p>
      )}

      <ul className="panel-list">
        {panels.map((p) => (
          <li key={p.id} className="panel-item">
            <div className="panel-info">
              <span className="panel-name">{p.name}</span>
              {p.wavelength_nm && <span className="panel-detail">{p.wavelength_nm}nm</span>}
              {p.irradiance_mw_cm2 != null && (
                <span className="panel-detail">{p.irradiance_mw_cm2} mW/cm²</span>
              )}
            </div>
            <button className="panel-delete-btn" onClick={() => handleDelete(p.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>

      {showAdd ? (
        <div className="panel-add-form">
          <input
            placeholder="Panel name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="number"
            placeholder="Wavelength (nm)"
            value={wavelength}
            onChange={(e) => setWavelength(e.target.value)}
            min={600}
            max={900}
          />
          <input
            type="number"
            placeholder="Irradiance (mW/cm²)"
            value={irradiance}
            onChange={(e) => setIrradiance(e.target.value)}
            min={0}
            step={0.1}
          />
          <div className="panel-add-actions">
            <button onClick={handleAdd} disabled={!name.trim()}>Add</button>
            <button className="panel-cancel-btn" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="panel-add-btn" onClick={() => setShowAdd(true)}>
          + Add Panel
        </button>
      )}

      {error && <p className="panel-error">{error}</p>}
    </section>
  )
}
