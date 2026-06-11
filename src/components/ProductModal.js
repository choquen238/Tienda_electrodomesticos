import React, { useState, useEffect } from 'react';
import ImageUploader from './ImageUploader';
import supabase from '../lib/supabaseClient';

/**
 * Modal para Ver / Crear / Editar productos.
 * Props:
 *   - visible: boolean
 *   - modo: 'ver' | 'crear' | 'editar'
 *   - producto: objeto con datos (null si modo=crear)
 *   - categorias: array de categorías
 *   - onCerrar(): función para cerrar
 *   - onGuardado(): callback tras guardar exitosamente
 */
function ProductModal({ visible, modo, producto, categorias, onCerrar, onGuardado }) {
  const esLectura = modo === 'ver';

  const estadoInicial = {
    nombre: '',
    descripcion: '',
    precio_base: '',
    precio_sugerido: '',
    stock: 0,
    imagen_url: '',
    categoria_id: '',
  };

  const [form, setForm] = useState(estadoInicial);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [msgError, setMsgError] = useState('');

  // Toggle de visibilidad solo para precio base en modo Ver
  const [verBase, setVerBase] = useState(false);

  const PRECIO_OCULTO = '••••••';

  // Cargar datos cuando cambia el producto o modo
  useEffect(() => {
    if (producto && (modo === 'ver' || modo === 'editar')) {
      setForm({
        nombre: producto.nombre || '',
        descripcion: producto.descripcion || '',
        precio_base: producto.precio_base || '',
        precio_sugerido: producto.precio_sugerido || '',
        stock: producto.stock ?? 0,
        imagen_url: producto.imagen_url || '',
        categoria_id: producto.categoria_id || '',
      });
    } else if (modo === 'crear') {
      setForm(estadoInicial);
    }
    setErrores({});
    setMsgError('');
    // Resetear precio base oculto al abrir
    setVerBase(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producto, modo, visible]);

  // Lock scroll
  useEffect(() => {
    if (visible) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [visible]);

  if (!visible) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errores[name]) setErrores(prev => ({ ...prev, [name]: '' }));
  };

  const validar = () => {
    const nuevos = {};
    if (!form.nombre.trim()) nuevos.nombre = 'El nombre es requerido.';
    if (!form.precio_base || isNaN(Number(form.precio_base)) || Number(form.precio_base) < 0)
      nuevos.precio_base = 'Precio base inválido.';
    if (!form.precio_sugerido || isNaN(Number(form.precio_sugerido)) || Number(form.precio_sugerido) < 0)
      nuevos.precio_sugerido = 'Precio sugerido inválido.';
    if (!form.categoria_id) nuevos.categoria_id = 'Selecciona una categoría.';
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!validar()) return;

    setGuardando(true);
    setMsgError('');

    const datos = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      precio_base: Number(form.precio_base),
      precio_sugerido: Number(form.precio_sugerido),
      stock: Number(form.stock) || 0,
      imagen_url: form.imagen_url || null,
      categoria_id: Number(form.categoria_id),
    };

    let error;
    if (modo === 'crear') {
      ({ error } = await supabase.from('productos').insert([datos]));
    } else {
      ({ error } = await supabase.from('productos').update(datos).eq('id', producto.id));
    }

    setGuardando(false);

    if (error) {
      setMsgError('Error al guardar: ' + error.message);
      return;
    }

    onGuardado();
    onCerrar();
  };

  const formatPrecio = (v) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);

  const categoriaNombre = categorias.find(c => c.id === producto?.categoria_id)?.nombre;

  const titulos = { ver: 'Detalle del Producto', crear: 'Nuevo Producto', editar: 'Editar Producto' };

  return (
    <>
      <div className="modal-backdrop fade show" onClick={!guardando ? onCerrar : undefined} style={{ zIndex: 1055 }}></div>
      <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-labelledby="product-modal-title" aria-modal="true" style={{ zIndex: 1056 }}>
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content border-0 shadow-lg">

            {/* Header */}
            <div className="modal-header border-0 pb-2">
              <h5 className="modal-title fw-bold" id="product-modal-title">
                <i className={`bi ${esLectura ? 'bi-info-circle' : modo === 'crear' ? 'bi-plus-circle' : 'bi-pencil-square'} me-2`}></i>
                {titulos[modo]}
              </h5>
              <button type="button" className="btn-close" onClick={onCerrar} disabled={guardando} aria-label="Cerrar"></button>
            </div>

            {/* Body */}
            <div className="modal-body pt-0">
              {esLectura ? (
                /* ─── MODO VER ─── */
                <div className="row g-4">
                  <div className="col-md-5">
                    <img
                      src={form.imagen_url || 'https://placehold.co/400x300/e2e8f0/94a3b8?text=Sin+imagen'}
                      alt={form.nombre}
                      className="img-fluid rounded-3 w-100"
                      style={{ objectFit: 'cover', maxHeight: '280px' }}
                      onError={(e) => { e.target.src = 'https://placehold.co/400x300/e2e8f0/94a3b8?text=Sin+imagen'; }}
                    />
                  </div>
                  <div className="col-md-7">
                    <h2 className="h4 fw-bold mb-1">{form.nombre}</h2>
                    {categoriaNombre && (
                      <span className="badge bg-primary-subtle text-primary-emphasis rounded-pill mb-3">
                        {categoriaNombre}
                      </span>
                    )}
                    <p className="text-muted mb-4">{form.descripcion || 'Sin descripción.'}</p>

                    <div className="row g-3">
                      {/* Precio Sugerido — siempre visible (verde / prominente) */}
                      <div className="col-12 col-sm-6">
                        <div className="price-detail-box price-row-sug">
                          <div className="price-label mb-1">Precio Sugerido</div>
                          <span className="price-sugerido fs-5">{formatPrecio(form.precio_sugerido)}</span>
                        </div>
                      </div>

                      {/* Precio Base — clic en cualquier parte del contenedor */}
                      <div className="col-12 col-sm-6">
                        <div
                          className="price-detail-box price-row-base"
                          onClick={() => setVerBase(v => !v)}
                          style={{ cursor: 'pointer' }}
                          role="button"
                          title={verBase ? 'Ocultar precio base' : 'Ver precio base'}
                        >
                          <div className="price-label mb-1">Precio Base</div>
                          <div className="d-flex align-items-center gap-2">
                            {verBase
                              ? <span className="price-base fs-5">{formatPrecio(form.precio_base)}</span>
                              : <span className="price-hidden fs-5">{PRECIO_OCULTO}</span>
                            }
                            <i className={`bi ${verBase ? 'bi-eye-slash' : 'bi-eye'} price-toggle-icon`}></i>
                          </div>
                        </div>
                      </div>

                      {/* Stock */}
                      <div className="col-6">
                        <div className="price-detail-box">
                          <div className="price-label small text-muted mb-1">Stock</div>
                          <div className="fw-semibold">{form.stock} unidades</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* ─── MODO CREAR / EDITAR ─── */
                <form id="form-producto" onSubmit={handleGuardar} noValidate>
                  <div className="row g-3">
                    {/* Nombre */}
                    <div className="col-12">
                      <label htmlFor="prod-nombre" className="form-label fw-semibold">Nombre *</label>
                      <input
                        id="prod-nombre"
                        name="nombre"
                        type="text"
                        className={`form-control ${errores.nombre ? 'is-invalid' : ''}`}
                        value={form.nombre}
                        onChange={handleChange}
                        placeholder="Ej: Refrigerador Samsung 350L"
                        maxLength={100}
                      />
                      {errores.nombre && <div className="invalid-feedback">{errores.nombre}</div>}
                    </div>

                    {/* Descripción */}
                    <div className="col-12">
                      <label htmlFor="prod-desc" className="form-label fw-semibold">Descripción</label>
                      <textarea
                        id="prod-desc"
                        name="descripcion"
                        className="form-control"
                        rows={3}
                        value={form.descripcion}
                        onChange={handleChange}
                        placeholder="Describe el producto..."
                      ></textarea>
                    </div>

                    {/* Precio base */}
                    <div className="col-6">
                      <label htmlFor="prod-precio-base" className="form-label fw-semibold">Precio Base (COP) *</label>
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input
                          id="prod-precio-base"
                          name="precio_base"
                          type="number"
                          min="0"
                          step="0.01"
                          className={`form-control ${errores.precio_base ? 'is-invalid' : ''}`}
                          value={form.precio_base}
                          onChange={handleChange}
                        />
                        {errores.precio_base && <div className="invalid-feedback">{errores.precio_base}</div>}
                      </div>
                    </div>

                    {/* Precio sugerido */}
                    <div className="col-6">
                      <label htmlFor="prod-precio-sug" className="form-label fw-semibold">Precio Sugerido (COP) *</label>
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input
                          id="prod-precio-sug"
                          name="precio_sugerido"
                          type="number"
                          min="0"
                          step="0.01"
                          className={`form-control ${errores.precio_sugerido ? 'is-invalid' : ''}`}
                          value={form.precio_sugerido}
                          onChange={handleChange}
                        />
                        {errores.precio_sugerido && <div className="invalid-feedback">{errores.precio_sugerido}</div>}
                      </div>
                    </div>

                    {/* Stock */}
                    <div className="col-6">
                      <label htmlFor="prod-stock" className="form-label fw-semibold">Stock</label>
                      <input
                        id="prod-stock"
                        name="stock"
                        type="number"
                        min="0"
                        className="form-control"
                        value={form.stock}
                        onChange={handleChange}
                      />
                    </div>

                    {/* Categoría */}
                    <div className="col-6">
                      <label htmlFor="prod-categoria" className="form-label fw-semibold">Categoría *</label>
                      <select
                        id="prod-categoria"
                        name="categoria_id"
                        className={`form-select ${errores.categoria_id ? 'is-invalid' : ''}`}
                        value={form.categoria_id}
                        onChange={handleChange}
                      >
                        <option value="">-- Seleccionar --</option>
                        {categorias.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                        ))}
                      </select>
                      {errores.categoria_id && <div className="invalid-feedback">{errores.categoria_id}</div>}
                    </div>

                    {/* Imagen */}
                    <div className="col-12">
                      <label className="form-label fw-semibold">Imagen del Producto</label>
                      <ImageUploader
                        urlActual={form.imagen_url}
                        onUpload={(url) => setForm(prev => ({ ...prev, imagen_url: url }))}
                      />
                    </div>
                  </div>

                  {msgError && (
                    <div className="alert alert-danger mt-3 py-2 small" role="alert">
                      <i className="bi bi-exclamation-triangle me-1"></i>
                      {msgError}
                    </div>
                  )}
                </form>
              )}
            </div>

            {/* Footer */}
            {!esLectura && (
              <div className="modal-footer border-0">
                <button
                  id="btn-modal-cancelar"
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={onCerrar}
                  disabled={guardando}
                >
                  Cancelar
                </button>
                <button
                  id="btn-modal-guardar"
                  type="submit"
                  form="form-producto"
                  className="btn btn-primary fw-semibold"
                  disabled={guardando}
                >
                  {guardando ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check2-circle me-1"></i>
                      {modo === 'crear' ? 'Crear Producto' : 'Guardar Cambios'}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default ProductModal;
