import React, { useState, useEffect, useCallback, useMemo } from 'react';
import supabase from '../lib/supabaseClient';
import { getEstadoInfo, formatFecha } from './VentasView';
import { calcularVenta } from './FechaVentas';

/** Determina si una fecha ISO (YYYY-MM-DD) es sábado o domingo. */
function esFindeSemana(iso) {
  if (!iso) return false;
  const [y, m, d] = iso.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 || dow === 6;
}

/**
 * Extrae el primer número del texto de observación.
 * Ej: "Adelanto de 500 Bs" → 500, "adelanto 1.500" → 1500, "nada" → null
 */
function parsearMontoDesdeoservacion(texto) {
  if (!texto) return null;
  const match = texto.match(/[\d]+(?:[.,][\d]+)*/);
  if (!match) return null;
  const normalizado = match[0].replace(/\.(\d{3})/g, '$1').replace(',', '.');
  const valor = parseFloat(normalizado);
  return isNaN(valor) ? null : valor;
}

/**
 * Reporte completo de un grupo de ventas.
 * Props:
 *  - grupo: objeto grupo
 *  - onVolver()
 */
function GrupoReporte({ grupo, onVolver }) {
  const [fechas, setFechas] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError('');
    const [{ data: fechasData, error: eFechas }, { data: ventasData, error: eVentas }] = await Promise.all([
      supabase.from('fechas_trabajadas').select('*').eq('grupo_id', grupo.id).order('fecha'),
      supabase.from('ventas').select('*').order('created_at'),
    ]);

    if (eFechas || eVentas) {
      setError('No se pudieron cargar los datos del reporte.');
    } else {
      setFechas(fechasData || []);
      const fechaIds = new Set((fechasData || []).map(f => f.id));
      setVentas((ventasData || []).filter(v => fechaIds.has(v.fecha_id)));
    }
    setCargando(false);
  }, [grupo.id]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  // ── Cálculos globales del grupo ──
  const calculos = useMemo(() => {
    const ventasPorFecha = {};
    ventas.forEach(v => {
      if (!ventasPorFecha[v.fecha_id]) ventasPorFecha[v.fecha_id] = [];
      ventasPorFecha[v.fecha_id].push(v);
    });

    let sumaGananciasPositivas = 0;
    let totalPuntos = 0;
    ventas.forEach(v => {
      const { ganancia, esPuntos, puntos } = calcularVenta(v);
      if (esPuntos) totalPuntos += puntos;
      else sumaGananciasPositivas += ganancia;
    });

    const gananciaNeta = (sumaGananciasPositivas / 2) + totalPuntos;

    const fechasUnicas = new Set(fechas.map(f => f.fecha));
    let salario = 0;
    fechasUnicas.forEach(iso => { if (esFindeSemana(iso)) salario += 50; });

    const gananciaReal = gananciaNeta + salario;

    const montoAdelanto = parsearMontoDesdeoservacion(grupo.observacion);
    const saldoPendiente = (grupo.estado === 'Adelanto' && montoAdelanto !== null)
      ? gananciaReal - montoAdelanto
      : null;

    return {
      sumaGananciasPositivas,
      totalPuntos,
      gananciaNeta,
      salario,
      gananciaReal,
      montoAdelanto,
      saldoPendiente,
      ventasPorFecha,
      fechasUnicas: [...fechasUnicas].sort(),
    };
  }, [ventas, fechas, grupo.observacion, grupo.estado]);

  const { clase, icono, texto } = getEstadoInfo(grupo.estado);

  const fechasPorTienda = useMemo(() => ({
    1: fechas.filter(f => f.tienda === 1).sort((a, b) => a.fecha.localeCompare(b.fecha)),
    2: fechas.filter(f => f.tienda === 2).sort((a, b) => a.fecha.localeCompare(b.fecha)),
  }), [fechas]);

  const diaSemana = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return dias[new Date(y, m - 1, d).getDay()];
  };

  // ── Render tabla de ventas por tienda ──
  const renderTablaTienda = (tienda) => {
    const fs = fechasPorTienda[tienda];
    if (fs.length === 0) return (
      <div className="text-center py-3 text-muted small">
        <i className="bi bi-calendar-x d-block mb-1" style={{ fontSize: '1.5rem' }}></i>
        Sin fechas en Tienda {tienda}
      </div>
    );

    return fs.map(f => {
      const vs = (calculos.ventasPorFecha[f.id] || []);
      const finde = esFindeSemana(f.fecha);
      return (
        <div key={f.id} className="reporte-fecha-bloque mb-3">
          <div className={`reporte-fecha-header ${finde ? 'reporte-fecha-header--finde' : ''}`}>
            <span className="fw-bold">{diaSemana(f.fecha)} {formatFecha(f.fecha)}</span>
            {finde && <span className="badge-finde ms-2">+50 Bs salario</span>}
            <span className="text-muted small ms-2">{vs.length} venta{vs.length !== 1 ? 's' : ''}</span>
          </div>

          {vs.length === 0 ? (
            <div className="reporte-sin-ventas">
              <i className="bi bi-cart-x me-1"></i>Sin ventas — fecha cuenta para salario
            </div>
          ) : (
            <div className="table-responsive">
              <table className="reporte-tabla">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="text-end">P. Base</th>
                    <th className="text-end">P. Vendido</th>
                    <th className="text-end">Ganancia / Puntos</th>
                    <th className="text-end">Neto (÷2)</th>
                  </tr>
                </thead>
                <tbody>
                  {vs.map(v => {
                    const { ganancia, esPuntos, puntos } = calcularVenta(v);
                    return (
                      <tr key={v.id}>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            {v.imagen_url && (
                              <img src={v.imagen_url} alt={v.nombre_producto} className="reporte-prod-img" />
                            )}
                            <div>
                              <div className="fw-semibold" style={{ fontSize: '0.88rem' }}>{v.nombre_producto}</div>
                              <span className={`badge ${v.observacion === 'grande' ? 'badge-producto-grande' : 'badge-producto-pequeno'}`}>
                                {v.observacion}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="text-end text-muted" style={{ fontSize: '0.88rem' }}>
                          {parseFloat(v.precio_base).toFixed(2)} Bs
                        </td>
                        <td className="text-end fw-semibold" style={{ fontSize: '0.88rem' }}>
                          {parseFloat(v.precio_vendido).toFixed(2)} Bs
                        </td>
                        <td className="text-end">
                          {esPuntos ? (
                            <span className="reporte-puntos-cell">
                              <i className="bi bi-star-fill me-1"></i>{puntos} Bs
                            </span>
                          ) : (
                            <span className="reporte-ganancia-cell">
                              +{ganancia.toFixed(2)} Bs
                            </span>
                          )}
                        </td>
                        <td className="text-end">
                          {esPuntos ? (
                            <span className="text-muted small">—</span>
                          ) : (
                            <span className="reporte-neto-cell">
                              {(ganancia / 2).toFixed(2)} Bs
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="ventas-container container-fluid py-3 px-3 px-md-4">

      {/* ── Header ── */}
      <div className="d-flex flex-wrap align-items-center gap-3 mb-4">
        <button
          className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
          onClick={onVolver}
        >
          <i className="bi bi-arrow-left"></i>
          <span>Volver</span>
        </button>
        <button
          id="btn-refrescar-reporte"
          className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
          onClick={cargarDatos}
          disabled={cargando}
          title="Actualizar datos del reporte"
        >
          <i className={`bi bi-arrow-clockwise ${cargando ? 'spin' : ''}`}></i>
          <span>Actualizar</span>
        </button>
        <div className="flex-grow-1">
          <nav className="ventas-breadcrumb" aria-label="breadcrumb">
            <span className="text-muted small">Ventas</span>
            <i className="bi bi-chevron-right text-muted small mx-1"></i>
            <span className="text-muted small">Reporte — Grupo #{grupo.id}</span>
          </nav>
          <h1 className="ventas-titulo mb-0 d-flex align-items-center gap-2 flex-wrap">
            <i className="bi bi-bar-chart-line text-info me-1"></i>
            Reporte — Grupo #{grupo.id}
            <span className={`estado-badge ${clase}`} style={{ fontSize: '0.72rem', verticalAlign: 'middle' }}>
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
      </div>

      {/* ── Error / Cargando ── */}
      {error && <div className="alert alert-danger">{error}</div>}
      {cargando && (
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-info" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      )}

      {!cargando && !error && (
        <>
          {/* ── Totales destacados ── */}
          <div className="reporte-totales-top mb-4">
            <div className="reporte-total-card reporte-total-card--ganancia">
              <div className="reporte-total-label">Ganancia neta</div>
              <div className="reporte-total-valor">{calculos.gananciaNeta.toFixed(2)} <span>Bs</span></div>
              <div className="reporte-total-detalle">
                Ganancias÷2 ({(calculos.sumaGananciasPositivas / 2).toFixed(2)}) + Puntos ({calculos.totalPuntos})
              </div>
            </div>
            <div className="reporte-total-card reporte-total-card--puntos">
              <div className="reporte-total-label">Total puntos</div>
              <div className="reporte-total-valor">{calculos.totalPuntos} <span>Bs</span></div>
              <div className="reporte-total-detalle">Por ventas sin ganancia</div>
            </div>
            <div className="reporte-total-card reporte-total-card--salario">
              <div className="reporte-total-label">Salario</div>
              <div className="reporte-total-valor">{calculos.salario} <span>Bs</span></div>
              <div className="reporte-total-detalle">
                {calculos.fechasUnicas.filter(esFindeSemana).length} día{calculos.fechasUnicas.filter(esFindeSemana).length !== 1 ? 's' : ''} de fin de semana × 50 Bs
              </div>
            </div>
            <div className="reporte-total-card reporte-total-card--real">
              <div className="reporte-total-label">
                <i className="bi bi-trophy-fill me-1"></i>Ganancia real
              </div>
              <div className="reporte-total-valor reporte-total-valor--grande">{calculos.gananciaReal.toFixed(2)} <span>Bs</span></div>
              <div className="reporte-total-detalle">Neta + Puntos + Salario</div>
            </div>
          </div>

          {/* ── Saldo pendiente (solo cuando estado = Adelanto y hay monto) ── */}
          {calculos.saldoPendiente !== null && (
            <div className={`reporte-saldo-pendiente mb-4 ${calculos.saldoPendiente <= 0 ? 'reporte-saldo-pendiente--negativo' : ''}`}>
              <div className="reporte-saldo-icono">
                <i className={`bi ${calculos.saldoPendiente <= 0 ? 'bi-check-circle-fill' : 'bi-hourglass-split'}`}></i>
              </div>
              <div className="reporte-saldo-info">
                <div className="reporte-saldo-titulo">
                  {calculos.saldoPendiente > 0 ? 'Saldo pendiente a cobrar' : 'Adelanto cubre todo'}
                </div>
                <div className="reporte-saldo-detalle">
                  Ganancia real ({calculos.gananciaReal.toFixed(2)} Bs)
                  {' − '}
                  Adelanto recibido ({calculos.montoAdelanto.toFixed(2)} Bs)
                </div>
              </div>
              <div className="reporte-saldo-monto">
                {calculos.saldoPendiente > 0 ? '+' : ''}{calculos.saldoPendiente.toFixed(2)} Bs
              </div>
            </div>
          )}

          {/* ── Tabla por tiendas ── */}
          {ventas.length === 0 && fechas.length === 0 ? (
            <div className="text-center py-4 text-muted">
              <i className="bi bi-inbox" style={{ fontSize: '2.5rem' }}></i>
              <p className="mt-2">No hay datos registrados en este grupo aún.</p>
            </div>
          ) : (
            <div className="reporte-tiendas-grid">
              <div className="reporte-tienda-col">
                <div className="reporte-tienda-titulo reporte-tienda-titulo--1">
                  <i className="bi bi-shop me-2"></i>Tienda 1
                  <span className="ms-2 text-muted small">
                    ({fechasPorTienda[1].length} fecha{fechasPorTienda[1].length !== 1 ? 's' : ''})
                  </span>
                </div>
                {renderTablaTienda(1)}
              </div>
              <div className="reporte-tienda-col">
                <div className="reporte-tienda-titulo reporte-tienda-titulo--2">
                  <i className="bi bi-shop me-2"></i>Tienda 2
                  <span className="ms-2 text-muted small">
                    ({fechasPorTienda[2].length} fecha{fechasPorTienda[2].length !== 1 ? 's' : ''})
                  </span>
                </div>
                {renderTablaTienda(2)}
              </div>
            </div>
          )}

          {/* ── Fórmula de cálculo ── */}
          <div className="reporte-formula mt-4">
            <div className="reporte-formula-titulo">
              <i className="bi bi-calculator me-2"></i>Fórmula de cálculo
            </div>
            <div className="reporte-formula-body">
              <div className="reporte-formula-row">
                <span>Suma de ganancias positivas</span>
                <span className="fw-semibold">{calculos.sumaGananciasPositivas.toFixed(2)} Bs</span>
              </div>
              <div className="reporte-formula-row">
                <span>÷ 2</span>
                <span className="fw-semibold">{(calculos.sumaGananciasPositivas / 2).toFixed(2)} Bs</span>
              </div>
              <div className="reporte-formula-row">
                <span>+ Total puntos</span>
                <span className="fw-semibold text-warning">{calculos.totalPuntos} Bs</span>
              </div>
              <div className="reporte-formula-row reporte-formula-row--subtotal">
                <span>= Ganancia neta</span>
                <span className="fw-bold text-success">{calculos.gananciaNeta.toFixed(2)} Bs</span>
              </div>
              <div className="reporte-formula-row">
                <span>+ Salario ({calculos.fechasUnicas.filter(esFindeSemana).length} días fin de semana × 50 Bs)</span>
                <span className="fw-semibold text-info">{calculos.salario} Bs</span>
              </div>
              <div className="reporte-formula-row reporte-formula-row--total">
                <span>= Ganancia real</span>
                <span className="fw-bold">{calculos.gananciaReal.toFixed(2)} Bs</span>
              </div>
              {calculos.saldoPendiente !== null && (
                <>
                  <div className="reporte-formula-row">
                    <span>− Adelanto recibido</span>
                    <span className="fw-semibold" style={{ color: '#d97706' }}>− {calculos.montoAdelanto.toFixed(2)} Bs</span>
                  </div>
                  <div className="reporte-formula-row reporte-formula-row--total" style={{ background: calculos.saldoPendiente <= 0 ? 'linear-gradient(90deg,#d1fae5,#f0fdf4)' : 'linear-gradient(90deg,#fff7ed,#fef3c7)' }}>
                    <span>= Saldo pendiente</span>
                    <span className="fw-bold" style={{ color: calculos.saldoPendiente <= 0 ? '#059669' : '#d97706' }}>
                      {calculos.saldoPendiente.toFixed(2)} Bs
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Días trabajados ── */}
          <div className="reporte-fechas-salario mt-3">
            <div className="reporte-formula-titulo mb-2">
              <i className="bi bi-calendar-week me-2"></i>Días trabajados
            </div>
            <div className="d-flex flex-wrap gap-2">
              {calculos.fechasUnicas.map(iso => (
                <span
                  key={iso}
                  className={`reporte-dia-badge ${esFindeSemana(iso) ? 'reporte-dia-badge--finde' : ''}`}
                >
                  {diaSemana(iso)} {formatFecha(iso)}
                  {esFindeSemana(iso) && <span className="ms-1">+50 Bs</span>}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default GrupoReporte;
