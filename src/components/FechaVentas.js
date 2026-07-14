import React, { useState, useEffect, useCallback } from 'react';
import supabase from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { getEstadoInfo, formatFecha } from './VentasView';
import VentaModal from './VentaModal';
import ConfirmModal from './ConfirmModal';

/**
 * Calcula la ganancia o puntos de una venta individual.
 * Retorna { ganancia, esPuntos, puntos }
 */
export function calcularVenta(venta) {
  const ganancia = parseFloat(venta.precio_vendido) - parseFloat(venta.precio_base);
  if (ganancia <= 0) {
    const puntos = venta.observacion === 'grande' ? 10 : 5;
    return { ganancia: 0, esPuntos: true, puntos };
  }
  return { ganancia, esPuntos: false, puntos: 0 };
}

/**
 * Vista de ventas dentro de una fecha trabajada.
 * Props:
 *  - grupo: objeto grupo
 *  - fecha: objeto fecha_trabajada
 *  - onVolver()
 */
function FechaVentas({ grupo, fecha, onVolver }) {
  const { esAdmin } = useAuth();
  const [ventas, setVentas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  // Modal venta
  const [modalVenta, setModalVenta] = useState(null); // null | 'crear' | objeto venta (editar)

  // Confirmar eliminar
  const [confirmarVenta, setConfirmarVenta] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  const cargarVentas = useCallback(async () => {
    setCargando(true);
    setError('');
    const { data, error: err } = await supabase
      .from('ventas')
      .select('*')
      .eq('fecha_id', fecha.id)
      .order('created_at', { ascending: true });
    if (err) setError('No se pudieron cargar las ventas.');
    else setVentas(data || []);
    setCargando(false);
  }, [fecha.id]);

  useEffect(() => { cargarVentas(); }, [cargarVentas]);

  const handleEliminar = async () => {
    if (!confirmarVenta) return;
    setEliminando(true);
    await supabase.from('ventas').delete().eq('id', confirmarVenta.id);
    setEliminando(false);
    setConfirmarVenta(null);
    cargarVentas();
  };

  const { clase, icono, texto } = getEstadoInfo(grupo.estado);

  const diaSemana = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return dias[new Date(y, m - 1, d).getDay()];
  };

  // Totales rápidos de esta fecha
  const totalesFecha = ventas.reduce((acc, v) => {
    const { ganancia, esPuntos, puntos } = calcularVenta(v);
    acc.gananciaBruta += ganancia;
    acc.puntos += puntos;
    acc.total += esPuntos ? 0 : ganancia;
    return acc;
  }, { gananciaBruta: 0, puntos: 0, total: 0 });

  return (
    <div className="ventas-container container-fluid py-3 px-3 px-md-4">

      {/* ── Breadcrumb / Header ── */}
      <div className="d-flex flex-wrap align-items-center gap-3 mb-4">
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
            <i className="bi bi-chevron-right text-muted small mx-1"></i>
            <span className="text-muted small">Tienda {fecha.tienda}</span>
          </nav>
          <h1 className="ventas-titulo mb-0 d-flex align-items-center gap-2 flex-wrap">
            <span>
              <i className="bi bi-calendar3 me-1"></i>
              {diaSemana(fecha.fecha)} {formatFecha(fecha.fecha)}
            </span>
            <span className="badge bg-secondary fs-6">Tienda {fecha.tienda}</span>
            <span className={`estado-badge ${clase}`} style={{ fontSize: '0.72rem', verticalAlign: 'middle' }}>
              <i className={`bi ${icono} me-1`}></i>{texto}
            </span>
          </h1>
        </div>

        {esAdmin && (
          <button
            id="btn-agregar-venta"
            className="btn btn-success d-flex align-items-center gap-2 fw-semibold"
            onClick={() => setModalVenta('crear')}
          >
            <i className="bi bi-cart-plus-fill"></i>
            Agregar venta
          </button>
        )}
      </div>

      {/* ── Resumen rápido ── */}
      {ventas.length > 0 && (
        <div className="fecha-resumen-rapido mb-4">
          <div className="fecha-resumen-item">
            <span className="fecha-resumen-label">Ventas</span>
            <span className="fecha-resumen-valor">{ventas.length}</span>
          </div>
          <div className="fecha-resumen-item">
            <span className="fecha-resumen-label">Ganancia bruta</span>
            <span className="fecha-resumen-valor text-success">{totalesFecha.gananciaBruta.toFixed(2)} Bs</span>
          </div>
          <div className="fecha-resumen-item">
            <span className="fecha-resumen-label">Puntos</span>
            <span className="fecha-resumen-valor text-warning">{totalesFecha.puntos} Bs</span>
          </div>
        </div>
      )}

      {/* ── Error / Cargando ── */}
      {error && <div className="alert alert-danger">{error}</div>}
      {cargando && (
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-success" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      )}

      {/* ── Sin ventas ── */}
      {!cargando && !error && ventas.length === 0 && (
        <div className="text-center py-5">
          <i className="bi bi-cart-x text-muted" style={{ fontSize: '3rem' }}></i>
          <p className="text-muted mt-3 mb-2">No hay ventas registradas en esta fecha.</p>
          <p className="text-muted small">La fecha igualmente cuenta para el salario por día trabajado.</p>
          {esAdmin && (
            <button className="btn btn-success mt-2" onClick={() => setModalVenta('crear')}>
              <i className="bi bi-cart-plus me-1"></i>Registrar primera venta
            </button>
          )}
        </div>
      )}

      {/* ── Lista de ventas ── */}
      {!cargando && ventas.length > 0 && (
        <div className="ventas-lista">
          {ventas.map((v, idx) => {
            const { ganancia, esPuntos, puntos } = calcularVenta(v);
            return (
              <div key={v.id} className="venta-fila">
                {/* Número */}
                <div className="venta-num">#{idx + 1}</div>

                {/* Imagen del producto */}
                <div className="venta-img-wrapper">
                  {v.imagen_url ? (
                    <img src={v.imagen_url} alt={v.nombre_producto} className="venta-img" />
                  ) : (
                    <div className="venta-img-placeholder">
                      <i className="bi bi-box-seam"></i>
                    </div>
                  )}
                </div>

                {/* Info producto */}
                <div className="venta-info flex-grow-1">
                  <div className="venta-nombre">{v.nombre_producto}</div>
                  <div className="d-flex gap-2 flex-wrap mt-1">
                    <span className={`badge ${v.observacion === 'grande' ? 'badge-producto-grande' : 'badge-producto-pequeno'}`}>
                      {v.observacion === 'grande' ? '📦 Grande' : '📦 Pequeño'}
                    </span>
                  </div>
                </div>

                {/* Precios */}
                <div className="venta-precios">
                  <div className="venta-precio-row">
                    <span className="venta-precio-label">Base</span>
                    <span className="venta-precio-base">{parseFloat(v.precio_base).toFixed(2)} Bs</span>
                  </div>
                  <div className="venta-precio-row">
                    <span className="venta-precio-label">Vendido</span>
                    <span className="venta-precio-vendido">{parseFloat(v.precio_vendido).toFixed(2)} Bs</span>
                  </div>
                </div>

                {/* Ganancia / Puntos */}
                <div className="venta-ganancia-col">
                  {esPuntos ? (
                    <span className="venta-puntos-badge">
                      <i className="bi bi-star-fill me-1"></i>
                      {puntos} Bs
                    </span>
                  ) : (
                    <span className="venta-ganancia-badge">
                      +{ganancia.toFixed(2)} Bs
                    </span>
                  )}
                </div>

                {/* Acciones */}
                <div className="venta-acciones">
                  {esAdmin && (
                    <>
                      <button
                        id={`btn-editar-venta-${v.id}`}
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => setModalVenta(v)}
                        title="Editar"
                      >
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button
                        id={`btn-eliminar-venta-${v.id}`}
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => setConfirmarVenta(v)}
                        title="Eliminar"
                      >
                        <i className="bi bi-trash3"></i>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal crear/editar venta ── */}
      {modalVenta !== null && (
        <VentaModal
          visible={true}
          venta={modalVenta === 'crear' ? null : modalVenta}
          fechaId={fecha.id}
          onCerrar={() => setModalVenta(null)}
          onGuardado={() => { setModalVenta(null); cargarVentas(); }}
        />
      )}

      {/* ── Confirmar eliminar venta ── */}
      <ConfirmModal
        visible={!!confirmarVenta}
        titulo="¿Eliminar venta?"
        mensaje={`¿Eliminás la venta de "${confirmarVenta?.nombre_producto}"? Esta acción no se puede deshacer.`}
        onConfirmar={handleEliminar}
        onCancelar={() => setConfirmarVenta(null)}
        cargando={eliminando}
      />
    </div>
  );
}

export default FechaVentas;
