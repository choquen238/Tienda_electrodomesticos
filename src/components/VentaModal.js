import React, { useState, useEffect, useCallback } from 'react';
import supabase from '../lib/supabaseClient';

/**
 * Modal para crear o editar una venta.
 * Props:
 *  - visible: boolean
 *  - venta: objeto venta (editar) | null (crear)
 *  - fechaId: id de la fecha_trabajada
 *  - onCerrar()
 *  - onGuardado()
 */
function VentaModal({ visible, venta, fechaId, onCerrar, onGuardado }) {
  const modoEditar = !!venta;

  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [mostrarDropdown, setMostrarDropdown] = useState(false);

  const [nombreProducto, setNombreProducto] = useState('');
  const [imagenUrl, setImagenUrl] = useState('');
  const [precioBase, setPrecioBase] = useState('');
  const [precioVendido, setPrecioVendido] = useState('');
  const [observacion, setObservacion] = useState('pequeño');

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  // Carga de productos disponibles
  const cargarProductos = useCallback(async () => {
    const { data } = await supabase
      .from('productos')
      .select('id, nombre, imagen_url, precio_base')
      .order('nombre');
    setProductos(data || []);
  }, []);

  useEffect(() => {
    if (visible) cargarProductos();
  }, [visible, cargarProductos]);

  // Inicializar campos al abrir
  useEffect(() => {
    if (venta) {
      setNombreProducto(venta.nombre_producto || '');
      setImagenUrl(venta.imagen_url || '');
      setPrecioBase(String(venta.precio_base || ''));
      setPrecioVendido(String(venta.precio_vendido || ''));
      setObservacion(venta.observacion || 'pequeño');
      setBusqueda(venta.nombre_producto || '');
      setProductoSeleccionado(null);
    } else {
      setNombreProducto('');
      setImagenUrl('');
      setPrecioBase('');
      setPrecioVendido('');
      setObservacion('pequeño');
      setBusqueda('');
      setProductoSeleccionado(null);
    }
    setError('');
    setMostrarDropdown(false);
  }, [venta, visible]);

  if (!visible) return null;

  // Filtrar productos según búsqueda
  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase().trim())
  ).slice(0, 10);

  const seleccionarProducto = (prod) => {
    setProductoSeleccionado(prod);
    setNombreProducto(prod.nombre);
    setImagenUrl(prod.imagen_url || '');
    setBusqueda(prod.nombre);
    // Autocompletar precio base del producto
    if (!precioBase) setPrecioBase(String(prod.precio_base || ''));
    setMostrarDropdown(false);
  };

  const gananciaPreview = () => {
    const base = parseFloat(precioBase);
    const vendido = parseFloat(precioVendido);
    if (isNaN(base) || isNaN(vendido)) return null;
    return vendido - base;
  };

  const gp = gananciaPreview();

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!nombreProducto.trim()) { setError('El nombre del producto es obligatorio.'); return; }
    if (!precioBase || isNaN(parseFloat(precioBase))) { setError('Ingresá un precio base válido.'); return; }
    if (!precioVendido || isNaN(parseFloat(precioVendido))) { setError('Ingresá un precio de venta válido.'); return; }

    setGuardando(true);
    setError('');

    const payload = {
      fecha_id: fechaId,
      producto_id: productoSeleccionado?.id || (venta?.producto_id) || null,
      nombre_producto: nombreProducto.trim(),
      imagen_url: imagenUrl || null,
      precio_base: parseFloat(precioBase),
      precio_vendido: parseFloat(precioVendido),
      observacion,
    };

    let err;
    if (modoEditar) {
      ({ error: err } = await supabase.from('ventas').update(payload).eq('id', venta.id));
    } else {
      ({ error: err } = await supabase.from('ventas').insert([payload]));
    }

    setGuardando(false);
    if (err) {
      setError('Error al guardar: ' + err.message);
    } else {
      onGuardado();
    }
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="venta-modal-titulo"
      onClick={(e) => { if (e.target === e.currentTarget && !guardando) onCerrar(); }}
    >
      <div className="modal-panel modal-panel--md">
        {/* Header */}
        <div className="modal-panel-header">
          <h2 id="venta-modal-titulo" className="modal-panel-title">
            <i className={`bi ${modoEditar ? 'bi-pencil-square' : 'bi-cart-plus-fill'} me-2 text-success`}></i>
            {modoEditar ? 'Editar venta' : 'Registrar venta'}
          </h2>
          <button className="modal-panel-close" onClick={onCerrar} disabled={guardando} aria-label="Cerrar">
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

          {/* Selector de producto */}
          <div className="mb-3 position-relative">
            <label htmlFor="vm-busqueda-producto" className="form-label fw-semibold">
              <i className="bi bi-box-seam me-1 text-primary"></i>
              Producto <span className="text-danger">*</span>
            </label>

            {/* Preview de imagen si hay producto seleccionado */}
            {imagenUrl && (
              <div className="vm-producto-preview mb-2">
                <img src={imagenUrl} alt={nombreProducto} className="vm-producto-img" />
                <span className="text-muted small">{nombreProducto}</span>
              </div>
            )}

            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-search"></i></span>
              <input
                id="vm-busqueda-producto"
                type="text"
                className="form-control"
                placeholder="Buscar producto de la base de datos..."
                value={busqueda}
                onChange={e => {
                  setBusqueda(e.target.value);
                  setNombreProducto(e.target.value);
                  setImagenUrl('');
                  setProductoSeleccionado(null);
                  setMostrarDropdown(e.target.value.length > 0);
                }}
                onFocus={() => setMostrarDropdown(busqueda.length > 0)}
                autoComplete="off"
              />
              {busqueda && (
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => { setBusqueda(''); setNombreProducto(''); setImagenUrl(''); setProductoSeleccionado(null); setMostrarDropdown(false); }}
                >
                  <i className="bi bi-x"></i>
                </button>
              )}
            </div>

            {/* Dropdown de productos */}
            {mostrarDropdown && productosFiltrados.length > 0 && (
              <div className="vm-dropdown">
                {productosFiltrados.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className="vm-dropdown-item"
                    onMouseDown={() => seleccionarProducto(p)}
                  >
                    {p.imagen_url && (
                      <img src={p.imagen_url} alt={p.nombre} className="vm-dropdown-img" />
                    )}
                    <div>
                      <div className="vm-dropdown-nombre">{p.nombre}</div>
                      <div className="vm-dropdown-precio text-muted small">
                        Precio base: {parseFloat(p.precio_base).toFixed(2)} Bs
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="form-text">Buscá un producto de la BD o escribí el nombre manualmente.</div>
          </div>

          {/* Precios en fila */}
          <div className="row g-3 mb-3">
            <div className="col-6">
              <label htmlFor="vm-precio-base" className="form-label fw-semibold">
                <i className="bi bi-tag me-1 text-warning"></i>
                Precio base (Bs) <span className="text-danger">*</span>
              </label>
              <input
                id="vm-precio-base"
                type="number"
                min="0"
                step="0.01"
                className="form-control"
                placeholder="0.00"
                value={precioBase}
                onChange={e => setPrecioBase(e.target.value)}
              />
            </div>
            <div className="col-6">
              <label htmlFor="vm-precio-vendido" className="form-label fw-semibold">
                <i className="bi bi-cash-coin me-1 text-success"></i>
                Precio vendido (Bs) <span className="text-danger">*</span>
              </label>
              <input
                id="vm-precio-vendido"
                type="number"
                min="0"
                step="0.01"
                className="form-control"
                placeholder="0.00"
                value={precioVendido}
                onChange={e => setPrecioVendido(e.target.value)}
              />
            </div>
          </div>

          {/* Preview de ganancia */}
          {gp !== null && (
            <div className={`vm-ganancia-preview mb-3 ${gp <= 0 ? 'vm-ganancia-puntos' : 'vm-ganancia-positiva'}`}>
              {gp <= 0 ? (
                <>
                  <i className="bi bi-star-fill me-1"></i>
                  Sin ganancia — se asignan <strong>{observacion === 'grande' ? 10 : 5} Bs</strong> en puntos
                  <span className="text-muted small ms-2">({observacion})</span>
                </>
              ) : (
                <>
                  <i className="bi bi-arrow-up-circle-fill me-1"></i>
                  Ganancia: <strong>+{gp.toFixed(2)} Bs</strong>
                  <span className="text-muted small ms-2">(÷2 = {(gp / 2).toFixed(2)} Bs neto)</span>
                </>
              )}
            </div>
          )}

          {/* Observación: grande o pequeño */}
          <div className="mb-4">
            <label className="form-label fw-semibold">
              <i className="bi bi-rulers me-1 text-secondary"></i>
              Tamaño del producto
            </label>
            <div className="d-flex gap-3">
              {['pequeño', 'grande'].map(op => (
                <label key={op} className={`vm-obs-btn ${observacion === op ? 'vm-obs-btn--activo' : ''}`}>
                  <input
                    type="radio"
                    name="vm-observacion"
                    value={op}
                    checked={observacion === op}
                    onChange={() => setObservacion(op)}
                    className="d-none"
                  />
                  {op === 'pequeño'
                    ? <><i className="bi bi-box me-1"></i>Pequeño <span className="text-muted small">(5 Bs pts)</span></>
                    : <><i className="bi bi-box-fill me-1"></i>Grande <span className="text-muted small">(10 Bs pts)</span></>
                  }
                </label>
              ))}
            </div>
            <div className="form-text">Define los puntos si la ganancia es ≤ 0.</div>
          </div>

          {/* Footer */}
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={onCerrar} disabled={guardando}>
              Cancelar
            </button>
            <button
              type="submit"
              id="btn-guardar-venta"
              className="btn btn-success d-flex align-items-center gap-2"
              disabled={guardando}
            >
              {guardando
                ? <><span className="spinner-border spinner-border-sm"></span> Guardando...</>
                : <><i className="bi bi-check-lg"></i>{modoEditar ? 'Guardar cambios' : 'Registrar venta'}</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default VentaModal;
