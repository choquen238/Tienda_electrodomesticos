import React, { useState, useEffect, useCallback } from 'react';
import supabase from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import GrupoModal from './GrupoModal';
import GrupoDetalle from './GrupoDetalle';
import GrupoReporte from './GrupoReporte';

/** Devuelve clase CSS y texto según el estado del grupo. */
export function getEstadoInfo(estado) {
  switch (estado) {
    case 'Pagado':    return { clase: 'estado-pagado',    icono: 'bi-check-circle-fill',       texto: 'Pagado' };
    case 'Pendiente': return { clase: 'estado-pendiente', icono: 'bi-clock-fill',              texto: 'Pendiente' };
    case 'Adelanto':  return { clase: 'estado-adelanto',  icono: 'bi-exclamation-circle-fill', texto: 'Adelanto' };
    default:          return { clase: 'estado-pendiente', icono: 'bi-clock-fill',              texto: estado };
  }
}

/** Formatea una fecha ISO (YYYY-MM-DD) a DD/MM/YYYY. */
export function formatFecha(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Sábado o domingo */
function esFindeSemana(iso) {
  if (!iso) return false;
  const [y, m, d] = iso.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 || dow === 6;
}

/** Extrae el primer número del texto de observación. */
function parsearMonto(texto) {
  if (!texto) return null;
  const match = texto.match(/[\d]+(?:[.,][\d]+)*/);
  if (!match) return null;
  const normalizado = match[0].replace(/\.(\d{3})/g, '$1').replace(',', '.');
  const valor = parseFloat(normalizado);
  return isNaN(valor) ? null : valor;
}

/** Calcula la ganancia neta de una venta individual. */
function calcularVentaLocal(venta) {
  const ganancia = parseFloat(venta.precio_vendido) - parseFloat(venta.precio_base);
  if (ganancia <= 0) {
    return { ganancia: 0, esPuntos: true, puntos: venta.observacion === 'grande' ? 10 : 5 };
  }
  return { ganancia, esPuntos: false, puntos: 0 };
}

/** Calcula el saldo pendiente de un grupo dado sus fechas y ventas. */
function calcularSaldoGrupo(grupo, fechasDelGrupo, ventasDelGrupo) {
  if (grupo.estado === 'Pagado') return 0;

  let sumaPos = 0, totalPuntos = 0;
  ventasDelGrupo.forEach(v => {
    const { ganancia, esPuntos, puntos } = calcularVentaLocal(v);
    if (esPuntos) totalPuntos += puntos;
    else sumaPos += ganancia;
  });
  const gananciaNeta = (sumaPos / 2) + totalPuntos;

  const fechasUnicas = new Set(fechasDelGrupo.map(f => f.fecha));
  let salario = 0;
  fechasUnicas.forEach(iso => { if (esFindeSemana(iso)) salario += 50; });
  const gananciaReal = gananciaNeta + salario;

  if (grupo.estado === 'Adelanto') {
    const montoAdelanto = parsearMonto(grupo.observacion);
    if (montoAdelanto === null) return gananciaReal;
    return gananciaReal - montoAdelanto;
  }
  return gananciaReal;
}

/** Vista principal del módulo de ventas. */
function VentasView({ onVolver }) {
  const { esAdmin } = useAuth();
  const [grupos, setGrupos]           = useState([]);
  const [cargando, setCargando]       = useState(true);
  const [error, setError]             = useState('');

  const [vistaInterna, setVistaInterna]           = useState('lista');
  const [grupoSeleccionado, setGrupoSeleccionado] = useState(null);
  const [modalGrupo, setModalGrupo]               = useState(null);

  // Panel de total pendiente
  const [mostrarPendiente, setMostrarPendiente]   = useState(false);
  const [pendienteData, setPendienteData]         = useState(null);
  const [cargandoPendiente, setCargandoPendiente] = useState(false);

  const cargarGrupos = useCallback(async () => {
    setCargando(true);
    setError('');
    setPendienteData(null);
    const { data, error: err } = await supabase
      .from('grupos_ventas')
      .select('*')
      .order('fecha_inicio', { ascending: false });
    if (err) setError('No se pudieron cargar los grupos de ventas.');
    else setGrupos(data || []);
    setCargando(false);
  }, []);

  useEffect(() => { cargarGrupos(); }, [cargarGrupos]);

  // ── Calcular total pendiente (2 queries globales) ──
  const calcularPendiente = useCallback(async () => {
    if (grupos.length === 0) return;
    setCargandoPendiente(true);

    const gruposIds = grupos.map(g => g.id);
    const { data: todasFechas } = await supabase
      .from('fechas_trabajadas').select('*').in('grupo_id', gruposIds);

    const fechaIds = (todasFechas || []).map(f => f.id);
    let todasVentas = [];
    if (fechaIds.length > 0) {
      const { data: vs } = await supabase.from('ventas').select('*').in('fecha_id', fechaIds);
      todasVentas = vs || [];
    }

    const fechasPorGrupo = {};
    (todasFechas || []).forEach(f => {
      if (!fechasPorGrupo[f.grupo_id]) fechasPorGrupo[f.grupo_id] = [];
      fechasPorGrupo[f.grupo_id].push(f);
    });

    const ventasPorFecha = {};
    todasVentas.forEach(v => {
      if (!ventasPorFecha[v.fecha_id]) ventasPorFecha[v.fecha_id] = [];
      ventasPorFecha[v.fecha_id].push(v);
    });

    const ventasPorGrupo = {};
    (todasFechas || []).forEach(f => {
      if (!ventasPorGrupo[f.grupo_id]) ventasPorGrupo[f.grupo_id] = [];
      (ventasPorFecha[f.id] || []).forEach(v => ventasPorGrupo[f.grupo_id].push(v));
    });

    const porGrupo = grupos
      .filter(g => g.estado !== 'Pagado')
      .map(g => ({
        grupo: g,
        saldo: calcularSaldoGrupo(g, fechasPorGrupo[g.id] || [], ventasPorGrupo[g.id] || []),
      }))
      .filter(item => item.saldo > 0);

    const total = porGrupo.reduce((acc, item) => acc + item.saldo, 0);
    setPendienteData({ total, porGrupo });
    setCargandoPendiente(false);
  }, [grupos]);

  const togglePendiente = () => {
    const nuevoEstado = !mostrarPendiente;
    setMostrarPendiente(nuevoEstado);
    if (nuevoEstado && pendienteData === null) calcularPendiente();
  };

  const entrarGrupo  = (g) => { setGrupoSeleccionado(g); setVistaInterna('detalle'); };
  const verReporte   = (g) => { setGrupoSeleccionado(g); setVistaInterna('reporte'); };
  const volverALista = ()  => { setVistaInterna('lista'); setGrupoSeleccionado(null); cargarGrupos(); };

  if (vistaInterna === 'detalle' && grupoSeleccionado)
    return <GrupoDetalle grupo={grupoSeleccionado} onVolver={volverALista} />;
  if (vistaInterna === 'reporte' && grupoSeleccionado)
    return <GrupoReporte grupo={grupoSeleccionado} onVolver={volverALista} />;

  return (
    <div className="ventas-container container-fluid py-3 px-3 px-md-4">

      {/* ── Header ── */}
      <div className="ventas-header d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div className="d-flex align-items-center gap-3">
          <button
            id="btn-volver-productos"
            className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
            onClick={onVolver}
          >
            <i className="bi bi-arrow-left"></i>
            <span>Volver a productos</span>
          </button>
          <div>
            <h1 className="ventas-titulo mb-0">
              <i className="bi bi-graph-up-arrow me-2 text-success"></i>Ventas
            </h1>
            <p className="text-muted small mb-0">Gestión de grupos de ventas y comisiones</p>
          </div>
        </div>

        <div className="d-flex gap-2 flex-wrap align-items-center">
          {!cargando && grupos.length > 0 && (
            <button
              id="btn-toggle-pendiente"
              className={`btn btn-sm fw-semibold d-flex align-items-center gap-2 ${mostrarPendiente ? 'btn-pendiente-activo' : 'btn-pendiente-inactivo'}`}
              onClick={togglePendiente}
              title={mostrarPendiente ? 'Ocultar total pendiente' : 'Ver total pendiente a cobrar'}
            >
              {cargandoPendiente
                ? <span className="spinner-border spinner-border-sm"></span>
                : <i className={`bi ${mostrarPendiente ? 'bi-eye-slash-fill' : 'bi-currency-dollar'}`}></i>
              }
              <span>{mostrarPendiente ? 'Ocultar pendiente' : 'Total pendiente'}</span>
            </button>
          )}
          {esAdmin && (
            <button
              id="btn-crear-grupo"
              className="btn btn-success d-flex align-items-center gap-2 fw-semibold"
              onClick={() => setModalGrupo('crear')}
            >
              <i className="bi bi-plus-circle-fill"></i>
              Crear grupo de ventas
            </button>
          )}
        </div>
      </div>

      {/* ── Panel de total pendiente ── */}
      {mostrarPendiente && (
        <div className="panel-pendiente mb-4">
          {cargandoPendiente ? (
            <div className="d-flex align-items-center gap-2 p-3 text-warning">
              <span className="spinner-border spinner-border-sm"></span>
              <span className="small">Calculando saldos...</span>
            </div>
          ) : pendienteData && (
            <>
              <div className="panel-pendiente-header">
                <div className="panel-pendiente-icono">
                  <i className="bi bi-exclamation-circle-fill"></i>
                </div>
                <div className="panel-pendiente-info">
                  <div className="panel-pendiente-label">Total pendiente a cobrar</div>
                  <div className="panel-pendiente-detalle">
                    {pendienteData.porGrupo.length} grupo{pendienteData.porGrupo.length !== 1 ? 's' : ''} con saldo pendiente
                  </div>
                </div>
                <div className="panel-pendiente-total">
                  {pendienteData.total.toFixed(2)} <span>Bs</span>
                </div>
                <button
                  className="btn btn-sm btn-outline-warning ms-2"
                  onClick={calcularPendiente}
                  disabled={cargandoPendiente}
                  title="Recalcular"
                >
                  <i className="bi bi-arrow-clockwise"></i>
                </button>
              </div>

              {pendienteData.porGrupo.length === 0 ? (
                <div className="panel-pendiente-vacio">
                  <i className="bi bi-check-circle-fill text-success me-2"></i>
                  No hay saldos pendientes — todo está al día
                </div>
              ) : (
                <div className="panel-pendiente-desglose">
                  {pendienteData.porGrupo.map(({ grupo, saldo }) => {
                    const { clase, icono } = getEstadoInfo(grupo.estado);
                    return (
                      <div key={grupo.id} className="panel-pendiente-fila">
                        <span className={`estado-badge ${clase}`} style={{ fontSize: '0.7rem' }}>
                          <i className={`bi ${icono} me-1`}></i>{grupo.estado}
                        </span>
                        <span className="panel-pendiente-grupo-id">Grupo #{grupo.id}</span>
                        <span className="text-muted small">
                          {formatFecha(grupo.fecha_inicio)}
                          {grupo.fecha_fin && <> → {formatFecha(grupo.fecha_fin)}</>}
                        </span>
                        {grupo.observacion && (
                          <span className="text-muted small fst-italic d-none d-md-inline">
                            — {grupo.observacion}
                          </span>
                        )}
                        <span className="panel-pendiente-saldo ms-auto">
                          {saldo.toFixed(2)} Bs
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="alert alert-danger d-flex align-items-center gap-2">
          <i className="bi bi-wifi-off"></i>{error}
          <button className="btn btn-sm btn-outline-danger ms-auto" onClick={cargarGrupos}>
            <i className="bi bi-arrow-clockwise me-1"></i>Reintentar
          </button>
        </div>
      )}

      {/* ── Cargando ── */}
      {cargando && (
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-success" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      )}

      {/* ── Sin grupos ── */}
      {!cargando && !error && grupos.length === 0 && (
        <div className="text-center py-5">
          <i className="bi bi-collection text-muted" style={{ fontSize: '3.5rem' }}></i>
          <p className="text-muted mt-3 mb-2">No hay grupos de ventas registrados.</p>
          {esAdmin && (
            <button className="btn btn-success mt-1" onClick={() => setModalGrupo('crear')}>
              <i className="bi bi-plus-circle me-1"></i>Crear primer grupo
            </button>
          )}
        </div>
      )}

      {/* ── Lista de grupos ── */}
      {!cargando && grupos.length > 0 && (
        <div className="grupos-lista">
          {grupos.map(grupo => {
            const { clase, icono, texto } = getEstadoInfo(grupo.estado);
            return (
              <div key={grupo.id} className="grupo-card">
                <div className={`grupo-card-franja ${clase}`}></div>
                <div className="grupo-card-body">
                  <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-2">
                    <div>
                      <span className="grupo-card-id text-muted small">Grupo #{grupo.id}</span>
                      <div className="d-flex align-items-center gap-2 mt-1">
                        <span className={`estado-badge ${clase}`}>
                          <i className={`bi ${icono} me-1`}></i>{texto}
                        </span>
                        {grupo.observacion && (
                          <span className="text-muted small fst-italic">— {grupo.observacion}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="grupo-fechas">
                        <i className="bi bi-calendar3 me-1 text-muted"></i>
                        <span className="fw-semibold">{formatFecha(grupo.fecha_inicio)}</span>
                        {grupo.fecha_fin && (
                          <><span className="text-muted mx-1">→</span>
                          <span className="fw-semibold">{formatFecha(grupo.fecha_fin)}</span></>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="d-flex flex-wrap gap-2 mt-3">
                    <button
                      id={`btn-entrar-grupo-${grupo.id}`}
                      className="btn btn-primary btn-sm d-flex align-items-center gap-1"
                      onClick={() => entrarGrupo(grupo)}
                    >
                      <i className="bi bi-door-open"></i><span>Entrar</span>
                    </button>
                    <button
                      id={`btn-reporte-grupo-${grupo.id}`}
                      className="btn btn-outline-info btn-sm d-flex align-items-center gap-1"
                      onClick={() => verReporte(grupo)}
                    >
                      <i className="bi bi-bar-chart-line"></i><span>Reporte</span>
                    </button>
                    {esAdmin && (
                      <button
                        id={`btn-editar-grupo-${grupo.id}`}
                        className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                        onClick={() => setModalGrupo(grupo)}
                      >
                        <i className="bi bi-pencil"></i><span>Editar</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal crear/editar grupo ── */}
      {modalGrupo !== null && (
        <GrupoModal
          visible={true}
          grupo={modalGrupo === 'crear' ? null : modalGrupo}
          onCerrar={() => setModalGrupo(null)}
          onGuardado={() => { setModalGrupo(null); cargarGrupos(); }}
        />
      )}
    </div>
  );
}

export default VentasView;
