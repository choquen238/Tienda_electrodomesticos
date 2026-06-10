import React, { useState, useEffect } from 'react';
import supabase from '../lib/supabaseClient';

/**
 * Modal para Crear / Editar una categoría.
 * Props:
 *   - visible: boolean
 *   - modo: 'crear' | 'editar'
 *   - categoria: objeto con datos (null si modo=crear)
 *   - onCerrar(): función para cerrar
 *   - onGuardado(): callback tras guardar exitosamente
 */
function CategoryModal({ visible, modo, categoria, onCerrar, onGuardado }) {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [errNombre, setErrNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [msgError, setMsgError] = useState('');

  // Cargar datos al abrir
  useEffect(() => {
    if (visible) {
      if (modo === 'editar' && categoria) {
        setNombre(categoria.nombre || '');
        setDescripcion(categoria.descripcion || '');
      } else {
        setNombre('');
        setDescripcion('');
      }
      setErrNombre('');
      setMsgError('');
    }
  }, [visible, modo, categoria]);

  // Lock scroll
  useEffect(() => {
    if (visible) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [visible]);

  if (!visible) return null;

  const handleGuardar = async (e) => {
    e.preventDefault();
    setErrNombre('');
    setMsgError('');

    // Validación
    if (!nombre.trim()) {
      setErrNombre('El nombre de la categoría es requerido.');
      return;
    }

    setGuardando(true);

    const datos = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
    };

    let error;
    if (modo === 'crear') {
      ({ error } = await supabase.from('categorias').insert([datos]));
    } else {
      ({ error } = await supabase.from('categorias').update(datos).eq('id', categoria.id));
    }

    setGuardando(false);

    if (error) {
      if (error.code === '23505') {
        setErrNombre('Ya existe una categoría con ese nombre.');
      } else {
        setMsgError('Error al guardar: ' + error.message);
      }
      return;
    }

    onGuardado();
    onCerrar();
  };

  const titulo = modo === 'crear' ? 'Nueva Categoría' : 'Editar Categoría';

  return (
    <>
      <div
        className="modal-backdrop fade show"
        onClick={!guardando ? onCerrar : undefined}
        style={{ zIndex: 1060 }}
      ></div>
      <div
        className="modal fade show d-block"
        tabIndex="-1"
        role="dialog"
        aria-labelledby="cat-modal-title"
        aria-modal="true"
        style={{ zIndex: 1061 }}
      >
        <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '480px' }}>
          <div className="modal-content border-0 shadow-lg">

            {/* Header */}
            <div className="modal-header border-0 pb-2">
              <h5 className="modal-title fw-bold" id="cat-modal-title">
                <i className={`bi ${modo === 'crear' ? 'bi-folder-plus' : 'bi-folder2-open'} me-2 text-primary`}></i>
                {titulo}
              </h5>
              <button
                type="button"
                className="btn-close"
                onClick={onCerrar}
                disabled={guardando}
                aria-label="Cerrar"
              ></button>
            </div>

            {/* Body */}
            <div className="modal-body pt-1">
              <form id="form-categoria" onSubmit={handleGuardar} noValidate>
                {/* Nombre */}
                <div className="mb-3">
                  <label htmlFor="cat-nombre" className="form-label fw-semibold">
                    Nombre <span className="text-danger">*</span>
                  </label>
                  <input
                    id="cat-nombre"
                    type="text"
                    className={`form-control ${errNombre ? 'is-invalid' : ''}`}
                    placeholder="Ej: Refrigeración"
                    value={nombre}
                    onChange={(e) => {
                      setNombre(e.target.value);
                      if (errNombre) setErrNombre('');
                    }}
                    maxLength={50}
                    disabled={guardando}
                    autoFocus
                  />
                  {errNombre && (
                    <div className="invalid-feedback">{errNombre}</div>
                  )}
                  <div className="form-text">{nombre.length}/50 caracteres</div>
                </div>

                {/* Descripción */}
                <div className="mb-2">
                  <label htmlFor="cat-desc" className="form-label fw-semibold">
                    Descripción <span className="text-muted fw-normal">(opcional)</span>
                  </label>
                  <textarea
                    id="cat-desc"
                    className="form-control"
                    rows={3}
                    placeholder="Describe brevemente esta categoría..."
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    disabled={guardando}
                  ></textarea>
                </div>

                {msgError && (
                  <div className="alert alert-danger py-2 px-3 small mt-3" role="alert">
                    <i className="bi bi-exclamation-triangle me-1"></i>
                    {msgError}
                  </div>
                )}
              </form>
            </div>

            {/* Footer */}
            <div className="modal-footer border-0">
              <button
                id="btn-cat-cancelar"
                type="button"
                className="btn btn-outline-secondary"
                onClick={onCerrar}
                disabled={guardando}
              >
                Cancelar
              </button>
              <button
                id="btn-cat-guardar"
                type="submit"
                form="form-categoria"
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
                    {modo === 'crear' ? 'Crear Categoría' : 'Guardar Cambios'}
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

export default CategoryModal;
