import React, { useState, useEffect } from 'react';
import supabase from '../lib/supabaseClient';

const ESTADOS = ['Pendiente', 'Pagado', 'Adelanto'];

/**
 * Modal para crear o editar un grupo de ventas.
 * Props:
 *  - visible: boolean
 *  - grupo: objeto grupo (editar) | null (crear)
 *  - onCerrar()
 *  - onGuardado()
 */
function GrupoModal({ visible, grupo, onCerrar, onGuardado }) {
  const modoEditar = !!grupo;

  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin]       = useState('');
  const [estado, setEstado]           = useState('Pendiente');
  const [observacion, setObservacion] = useState('');
  const [guardando, setGuardando]     = useState(false);
  const [error, setError]             = useState('');

  // Cargar datos al editar
  useEffect(() => {
    if (grupo) {
      setFechaInicio(grupo.fecha_inicio || '');
      setFechaFin(grupo.fecha_fin || '');
      setEstado(grupo.estado || 'Pendiente');
      setObservacion(grupo.observacion || '');
    } else {
      setFechaInicio('');
      setFechaFin('');
      setEstado('Pendiente');
      setObservacion('');
    }
    setError('');
  }, [grupo, visible]);

  if (!visible) return null;

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!fechaInicio) { setError('La fecha de inicio es obligatoria.'); return; }
    if (fechaFin && fechaFin < fechaInicio) { setError('La fecha fin no puede ser anterior a la fecha inicio.'); return; }

    setGuardando(true);
    setError('');

    const payload = {
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin || null,
      estado,
      observacion: observacion.trim() || null,
    };

    let err;
    if (modoEditar) {
      ({ error: err } = await supabase
        .from('grupos_ventas')
        .update(payload)
        .eq('id', grupo.id));
    } else {
      ({ error: err } = await supabase
        .from('grupos_ventas')
        .insert([payload]));
    }

    setGuardando(false);
    if (err) {
      setError('Error al guardar: ' + err.message);
    } else {
      onGuardado();
    }
  };

  const estadoColores = {
    Pagado:    { bg: '#d1fae5', border: '#059669', color: '#065f46' },
    Pendiente: { bg: '#fee2e2', border: '#dc2626', color: '#7f1d1d' },
    Adelanto:  { bg: '#fef3c7', border: '#d97706', color: '#78350f' },
  };

  const colorActual = estadoColores[estado] || estadoColores['Pendiente'];

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="grupo-modal-titulo"
      onClick={(e) => { if (e.target === e.currentTarget && !guardando) onCerrar(); }}
    >
      <div className="modal-panel modal-panel--md">
        {/* Header */}
        <div className="modal-panel-header">
          <h2 id="grupo-modal-titulo" className="modal-panel-title">
            <i className={`bi ${modoEditar ? 'bi-pencil-square' : 'bi-plus-circle'} me-2`}></i>
            {modoEditar ? `Editar Grupo #${grupo.id}` : 'Crear grupo de ventas'}
          </h2>
          <button
            className="modal-panel-close"
            onClick={onCerrar}
            disabled={guardando}
            aria-label="Cerrar"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleGuardar} className="modal-panel-body">
          {error && (
            <div className="alert alert-danger py-2 small d-flex align-items-center gap-2">
              <i className="bi bi-exclamation-circle-fill"></i>{error}
            </div>
          )}

          {/* Fecha inicio */}
          <div className="mb-3">
            <label htmlFor="gm-fecha-inicio" className="form-label fw-semibold">
              <i className="bi bi-calendar-event me-1 text-primary"></i>
              Fecha inicio <span className="text-danger">*</span>
            </label>
            <input
              id="gm-fecha-inicio"
              type="date"
              className="form-control"
              value={fechaInicio}
              onChange={e => setFechaInicio(e.target.value)}
              required
            />
          </div>

          {/* Fecha fin */}
          <div className="mb-3">
            <label htmlFor="gm-fecha-fin" className="form-label fw-semibold">
              <i className="bi bi-calendar-check me-1 text-secondary"></i>
              Fecha fin / tentativo
            </label>
            <input
              id="gm-fecha-fin"
              type="date"
              className="form-control"
              value={fechaFin}
              onChange={e => setFechaFin(e.target.value)}
            />
            <div className="form-text">Opcional. Puede ser una fecha tentativa.</div>
          </div>

          {/* Estado */}
          <div className="mb-3">
            <label className="form-label fw-semibold">
              <i className="bi bi-flag me-1" style={{ color: colorActual.border }}></i>
              Estado del grupo
            </label>
            <div className="d-flex gap-2 flex-wrap">
              {ESTADOS.map(est => {
                const col = estadoColores[est];
                return (
                  <button
                    key={est}
                    type="button"
                    className="gm-estado-btn"
                    style={estado === est
                      ? { background: col.bg, borderColor: col.border, color: col.color, fontWeight: 700 }
                      : {}}
                    onClick={() => setEstado(est)}
                  >
                    {est === 'Pagado' && <i className="bi bi-check-circle-fill me-1"></i>}
                    {est === 'Pendiente' && <i className="bi bi-clock-fill me-1"></i>}
                    {est === 'Adelanto' && <i className="bi bi-exclamation-circle-fill me-1"></i>}
                    {est}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Observación (siempre visible, más relevante en edición) */}
          <div className="mb-4">
            <label htmlFor="gm-observacion" className="form-label fw-semibold">
              <i className="bi bi-chat-left-text me-1 text-secondary"></i>
              Observación del jefe
              <span
                className="ms-2 badge rounded-pill"
                style={{ background: colorActual.bg, color: colorActual.color, border: `1px solid ${colorActual.border}`, fontSize: '0.7rem' }}
              >
                Ej: Pagado ✓ / Pendiente / Adelanto de 500 Bs
              </span>
            </label>
            <textarea
              id="gm-observacion"
              className="form-control"
              rows={2}
              placeholder="Ej: Adelanto de 300 Bs, falta el resto..."
              value={observacion}
              onChange={e => setObservacion(e.target.value)}
              style={{ borderColor: observacion ? colorActual.border : '', resize: 'vertical' }}
            />
          </div>

          {/* Footer */}
          <div className="d-flex justify-content-end gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onCerrar}
              disabled={guardando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              id="btn-guardar-grupo"
              className="btn btn-success d-flex align-items-center gap-2"
              disabled={guardando}
            >
              {guardando
                ? <><span className="spinner-border spinner-border-sm"></span> Guardando...</>
                : <><i className="bi bi-check-lg"></i>{modoEditar ? 'Guardar cambios' : 'Crear grupo'}</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default GrupoModal;
