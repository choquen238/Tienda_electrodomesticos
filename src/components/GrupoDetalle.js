import React, { useState, useEffect, useCallback } from 'react';
import supabase from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { getEstadoInfo, formatFecha } from './VentasView';
import FechaVentas from './FechaVentas';
import ConfirmModal from './ConfirmModal';

/**
 * Detalle de un grupo: muestra Tienda 1 y Tienda 2 con sus fechas trabajadas.
 * Al agregar una fecha, se crea en AMBAS tiendas automáticamente.
 * Props:
 *  - grupo: objeto grupo
 *  - onVolver()
 */
function GrupoDetalle({ grupo, onVolver }) {
  const { esAdmin } = useAuth();
  const [fechas, setFechas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  // Agregar fecha (un solo formulario para ambas tiendas)
  const [mostrarFormFecha, setMostrarFormFecha] = useState(false);
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [guardandoFecha, setGuardandoFecha] = useState(false);
  const [errorFecha, setErrorFecha] = useState('');
  const [exitoFecha, setExitoFecha] = useState('');

  // Eliminar fecha
  const [confirmarFecha, setConfirmarFecha] = useState(null);
  const [eliminandoFecha, setEliminandoFecha] = useState(false);

  // Navegar a FechaVentas
  const [fechaActiva, setFechaActiva] = useState(null);

  const cargarFechas = useCallback(async () => {
    setCargando(true);
    setError('');
    const { data, error: err } = await supabase
      .from('fechas_trabajadas')
      .select('*')
      .eq('grupo_id', grupo.id)
      .order('fecha', { ascending: true });
    if (err) setError('No se pudieron cargar las fechas.');
    else setFechas(data || []);
    setCargando(false);
  }, [grupo.id]);

  useEffect(() => { cargarFechas(); }, [cargarFechas]);

  // ── Navegar a una fecha ──
  if (fechaActiva) {
    return (
      <FechaVentas
        grupo={grupo}
        fecha={fechaActiva}
        onVolver={() => { setFechaActiva(null); cargarFechas(); }}
      />
    );
  }

  // ── Agregar fecha en AMBAS tiendas ──
  const handleAgregarFecha = async () => {
    if (!nuevaFecha) { setErrorFecha('Seleccioná una fecha.'); return; }

    // Verificar si ya existe en alguna tienda
    const yaExiste = fechas.some(f => f.fecha === nuevaFecha);
    if (yaExiste) {
      setErrorFecha('Esa fecha ya existe en este grupo.');
      return;
    }

    setGuardandoFecha(true);
    setErrorFecha('');
    setExitoFecha('');

    // Insertar para Tienda 1 y Tienda 2 simultáneamente
    const { error: err } = await supabase
      .from('fechas_trabajadas')
      .insert([
        { grupo_id: grupo.id, tienda: 1, fecha: nuevaFecha },
        { grupo_id: grupo.id, tienda: 2, fecha: nuevaFecha },
      ]);

    setGuardandoFecha(false);

    if (err) {
      if (err.code === '23505') setErrorFecha('Esa fecha ya existe en este grupo.');
      else setErrorFecha('Error al guardar: ' + err.message);
    } else {
      const [y, m, d] = nuevaFecha.split('-').map(Number);
      const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const dia = dias[new Date(y, m - 1, d).getDay()];
      setExitoFecha(`✓ ${dia} ${formatFecha(nuevaFecha)} agregada a Tienda 1 y Tienda 2`);
      setNuevaFecha('');
      cargarFechas();
      // Ocultar mensaje de éxito después de 3 segundos
      setTimeout(() => setExitoFecha(''), 3000);
    }
  };

  // ── Eliminar fecha (en UNA sola tienda) ──
  const handleEliminarFecha = async () => {
    if (!confirmarFecha) return;
    setEliminandoFecha(true);
    await supabase.from('fechas_trabajadas').delete().eq('id', confirmarFecha.id);
    setEliminandoFecha(false);
    setConfirmarFecha(null);
    cargarFechas();
  };

  const { clase, icono, texto } = getEstadoInfo(grupo.estado);

  const fechasTienda = (tienda) => fechas.filter(f => f.tienda === tienda);

  const diaSemana = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return dias[new Date(y, m - 1, d).getDay()];
  };

  const esFindeSemana = (iso) => {
    if (!iso) return false;
    const [y, m, d] = iso.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    return dow === 0 || dow === 6;
  };

  // ── Render panel de tienda (solo muestra fechas, no tiene formulario) ──
  const renderTienda = (tienda) => {
    const lista = fechasTienda(tienda);

    return (
      <div className="tienda-panel">
        <div className="tienda-panel-header">
          <div className="d-flex align-items-center gap-2">
            <div className={`tienda-icono tienda-icono--${tienda}`}>
              <i className="bi bi-shop"></i>
            </div>
            <div>
              <h3 className="tienda-titulo mb-0">Tienda {tienda}</h3>
              <span className="text-muted small">{lista.length} fecha{lista.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        {/* Lista de fechas */}
        <div className="tienda-fechas-lista">
          {lista.length === 0 ? (
            <div className="text-center py-4 text-muted small">
              <i className="bi bi-calendar-x d-block mb-1" style={{ fontSize: '1.6rem' }}></i>
              Sin fechas registradas
              {esAdmin && (
                <div className="mt-2">
                  <button
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => { setMostrarFormFecha(true); setErrorFecha(''); setExitoFecha(''); }}
                  >
                    <i className="bi bi-plus-lg me-1"></i>Agregar fecha
                  </button>
                </div>
              )}
            </div>
          ) : (
            lista.map(f => (
              <div key={f.id} className={`fecha-item ${esFindeSemana(f.fecha) ? 'fecha-item--finde' : ''}`}>
                <div className="fecha-item-left">
                  <span className="fecha-dia-semana">{diaSemana(f.fecha)}</span>
                  <span className="fecha-valor">{formatFecha(f.fecha)}</span>
                  {esFindeSemana(f.fecha) && (
                    <span className="badge-finde">+50 Bs</span>
                  )}
                </div>
                <div className="fecha-item-acciones">
                  <button
                    id={`btn-ver-fecha-${f.id}`}
                    className="btn btn-primary btn-sm d-flex align-items-center gap-1"
                    onClick={() => setFechaActiva(f)}
                    title="Ver ventas de esta fecha"
                  >
                    <i className="bi bi-cart3"></i>
                    <span className="d-none d-sm-inline">Ver ventas</span>
                  </button>
                  {esAdmin && (
                    <button
                      id={`btn-eliminar-fecha-${f.id}`}
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => setConfirmarFecha(f)}
                      title="Eliminar esta fecha de esta tienda"
                    >
                      <i className="bi bi-trash3"></i>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="ventas-container container-fluid py-3 px-3 px-md-4">

      {/* ── Breadcrumb / Header ── */}
      <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
        <button
          className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
          onClick={onVolver}
        >
          <i className="bi bi-arrow-left"></i>
          <span>Volver</span>
        </button>
        <div className="flex-grow-1">
          <nav className="ventas-breadcrumb" aria-label="breadcrumb">
            <span className="text-muted small">Ventas</span>
            <i className="bi bi-chevron-right text-muted small mx-1"></i>
            <span className="text-muted small">Grupo #{grupo.id}</span>
          </nav>
          <h1 className="ventas-titulo mb-0">
            Grupo #{grupo.id}
            <span className={`estado-badge ms-3 ${clase}`} style={{ fontSize: '0.75rem', verticalAlign: 'middle' }}>
              <i className={`bi ${icono} me-1`}></i>{texto}
            </span>
          </h1>
          <div className="text-muted small mt-1">
            <i className="bi bi-calendar3 me-1"></i>
            {formatFecha(grupo.fecha_inicio)}
            {grupo.fecha_fin && <> → {formatFecha(grupo.fecha_fin)}</>}
            {grupo.observacion && <span className="fst-italic ms-2">— {grupo.observacion}</span>}
          </div>
        </div>

        {/* Botón agregar fecha — un solo botón para ambas tiendas */}
        {esAdmin && (
          <button
            id="btn-agregar-fecha-grupo"
            className="btn btn-success d-flex align-items-center gap-2 fw-semibold"
            onClick={() => {
              setMostrarFormFecha(v => !v);
              setErrorFecha('');
              setExitoFecha('');
              setNuevaFecha('');
            }}
          >
            <i className={`bi ${mostrarFormFecha ? 'bi-x-lg' : 'bi-calendar-plus'}`}></i>
            {mostrarFormFecha ? 'Cancelar' : 'Agregar fecha'}
          </button>
        )}
      </div>

      {/* ── Formulario de agregar fecha (una sola vez para ambas tiendas) ── */}
      {mostrarFormFecha && (
        <div className="grupo-add-fecha-panel mb-4">
          <div className="grupo-add-fecha-titulo">
            <i className="bi bi-calendar-plus me-2 text-success"></i>
            Agregar fecha trabajada
            <span className="ms-2 badge bg-success bg-opacity-10 text-success border border-success border-opacity-25" style={{ fontSize: '0.72rem' }}>
              Se agrega en Tienda 1 y Tienda 2
            </span>
          </div>
          <div className="grupo-add-fecha-body">
            {errorFecha && (
              <div className="alert alert-warning py-2 small d-flex align-items-center gap-2 mb-3">
                <i className="bi bi-exclamation-triangle-fill"></i>{errorFecha}
              </div>
            )}
            {exitoFecha && (
              <div className="alert alert-success py-2 small d-flex align-items-center gap-2 mb-3">
                <i className="bi bi-check-circle-fill"></i>{exitoFecha}
              </div>
            )}
            <div className="d-flex gap-3 align-items-end flex-wrap">
              <div>
                <label htmlFor="input-nueva-fecha" className="form-label fw-semibold small mb-1">
                  Fecha trabajada
                </label>
                <input
                  id="input-nueva-fecha"
                  type="date"
                  className="form-control"
                  style={{ maxWidth: 200 }}
                  value={nuevaFecha}
                  onChange={e => { setNuevaFecha(e.target.value); setErrorFecha(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleAgregarFecha(); }}
                />
              </div>
              <button
                id="btn-guardar-fecha"
                className="btn btn-success d-flex align-items-center gap-2 fw-semibold"
                onClick={handleAgregarFecha}
                disabled={guardandoFecha || !nuevaFecha}
              >
                {guardandoFecha
                  ? <><span className="spinner-border spinner-border-sm"></span> Guardando...</>
                  : <><i className="bi bi-check-lg"></i>Guardar en ambas tiendas</>
                }
              </button>
            </div>
            <div className="form-text mt-2">
              <i className="bi bi-info-circle me-1"></i>
              Incluso sin ventas, registrá la fecha para que cuente el salario (sábados y domingos = 50 Bs).
            </div>
          </div>
        </div>
      )}

      {/* ── Error / Cargando ── */}
      {error && <div className="alert alert-danger">{error}</div>}
      {cargando && (
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      )}

      {/* ── Dos tiendas ── */}
      {!cargando && !error && (
        <div className="tiendas-grid">
          {renderTienda(1)}
          {renderTienda(2)}
        </div>
      )}

      {/* ── Modal confirmar eliminar fecha ── */}
      <ConfirmModal
        visible={!!confirmarFecha}
        titulo="¿Eliminar fecha de esta tienda?"
        mensaje={`¿Eliminás la fecha ${formatFecha(confirmarFecha?.fecha)} de Tienda ${confirmarFecha?.tienda}?\n\nSe eliminarán todas las ventas de esa fecha en esta tienda.\n\nNota: si existe la misma fecha en la otra tienda, permanecerá.`}
        onConfirmar={handleEliminarFecha}
        onCancelar={() => setConfirmarFecha(null)}
        cargando={eliminandoFecha}
      />
    </div>
  );
}

export default GrupoDetalle;
