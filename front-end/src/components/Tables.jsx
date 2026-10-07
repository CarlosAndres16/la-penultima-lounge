import { useState, useEffect } from 'react';
import './Tables.css';
import { t, TABLE_STATUS_LABEL } from '../i18n';

const API = 'http://localhost:3000/api/v1';

export default function Tables({ userRol, selectedSede }) {
  const [mesas, setMesas] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageError, setPageError] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [numeroMesa, setNumeroMesa] = useState('');
  const [modalError, setModalError] = useState('');
  const [saving, setSaving] = useState(false);

  const isAdmin = userRol === 'Administrador';
  const hasBranch = selectedSede && selectedSede !== 'ALL';
  const authHeaders = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });

  useEffect(() => {
    fetchSedes();
  }, []);

  useEffect(() => {
    setSearchTerm('');
    setPageError('');
    if (hasBranch) {
      fetchMesas();
    } else {
      setMesas([]);
    }
  }, [selectedSede]);

  const fetchSedes = async () => {
    try {
      const res = await fetch(`${API}/sedes`, { headers: authHeaders() });
      if (!res.ok) return;
      setSedes(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMesas = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/sedes/${selectedSede}/mesas`, { headers: authHeaders() });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to load tables');
      }
      setMesas(await res.json());
      setPageError('');
    } catch (err) {
      setPageError(err.message);
      setMesas([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = () => {
    setNumeroMesa('');
    setModalError('');
    setShowModal(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setModalError('');
    setSaving(true);

    try {
      const res = await fetch(`${API}/sedes/${selectedSede}/mesas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ numero_mesa: numeroMesa })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create table');
      }

      setShowModal(false);
      setNumeroMesa('');
      fetchMesas();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (mesa) => {
    if (!window.confirm(`Are you sure you want to delete table ${mesa.numero_mesa}?`)) {
      return;
    }

    setPageError('');
    try {
      const res = await fetch(`${API}/sedes/${selectedSede}/mesas/${mesa.id_mesa}`, {
        method: 'DELETE',
        headers: authHeaders()
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to delete table');
      }

      fetchMesas();
    } catch (err) {
      setPageError(err.message);
    }
  };

  const sedeActual = sedes.find(s => String(s.id_sede) === String(selectedSede));
  const filtered = mesas.filter(m =>
    m.numero_mesa.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  return (
    <div className="tables-container">
      <div className="tables-header">
        <div>
          <h2>Table Management</h2>
          <p className="tables-subtitle">
            {hasBranch
              ? `Table configuration${sedeActual ? ` — ${sedeActual.nombre_sede}` : ''}`
              : 'Table configuration by branch'}
          </p>
        </div>
        {isAdmin && hasBranch && (
          <button className="tables-btn-primary" onClick={handleOpenModal}>+ New Table</button>
        )}
      </div>

      {!hasBranch ? (
        <div className="tables-empty">
          Select a specific branch in the top bar to manage its tables.
        </div>
      ) : (
        <>
          <div className="tables-filters">
            <input
              type="text"
              placeholder="Search table..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="tables-search"
            />
          </div>

          {pageError && <div className="tables-error">{pageError}</div>}

          {loading ? (
            <p>Loading tables...</p>
          ) : filtered.length === 0 ? (
            <div className="tables-empty">
              {mesas.length === 0 ? 'No tables registered for this branch yet' : 'No tables found'}
            </div>
          ) : (
            <div className="tables-grid">
              {filtered.map(m => (
                <div key={m.id_mesa} className={`table-card table-${m.estado_actual.toLowerCase()}`}>
                  {isAdmin && (
                    <button
                      className="table-delete"
                      onClick={() => handleDelete(m)}
                      title="Delete table"
                    >
                      ✕
                    </button>
                  )}
                  <span className="table-number">{m.numero_mesa}</span>
                  <span className="table-status">{t(TABLE_STATUS_LABEL, m.estado_actual)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showModal && (
        <div className="tables-overlay">
          <div className="tables-modal">
            <h3>New Table</h3>
            {modalError && <div className="tables-error">{modalError}</div>}

            <form onSubmit={handleCreate}>
              <div className="tables-form-group">
                <label>Table number or code</label>
                <input
                  type="text"
                  placeholder="e.g. 11"
                  value={numeroMesa}
                  onChange={(e) => setNumeroMesa(e.target.value)}
                  maxLength={20}
                  required
                  autoFocus
                />
              </div>

              <div className="tables-form-group">
                <label>Initial status</label>
                <input type="text" value={t(TABLE_STATUS_LABEL, 'Libre')} readOnly disabled />
              </div>

              <div className="tables-modal-actions">
                <button type="button" className="tables-btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="tables-btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}