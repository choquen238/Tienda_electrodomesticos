import React, { useEffect } from 'react';

/**
 * Modal de confirmación para acciones destructivas (ej: eliminar).
 * Props:
 *   - visible: boolean
 *   - titulo: string
 *   - mensaje: string
 *   - onConfirmar: función ejecutada al confirmar
 *   - onCancelar: función ejecutada al cancelar
 *   - cargando: boolean (deshabilita botones durante la operación)
 */
function ConfirmModal({ visible, titulo, mensaje, onConfirmar, onCancelar, cargando }) {
  // Prevenir scroll del body cuando el modal está abierto
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [visible]);

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="modal-backdrop fade show"
        onClick={!cargando ? onCancelar : undefined}
        style={{ zIndex: 1055 }}
      ></div>

      {/* Modal */}
      <div
        className="modal fade show d-block"
        tabIndex="-1"
        role="dialog"
        aria-labelledby="confirm-modal-title"
        aria-modal="true"
        style={{ zIndex: 1056 }}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg">
            {/* Header */}
            <div className="modal-header border-0 pb-0">
              <div className="d-flex align-items-center gap-2">
                <div className="confirm-icon-wrapper">
                  <i className="bi bi-exclamation-triangle-fill text-danger fs-4"></i>
                </div>
                <h5 className="modal-title fw-bold mb-0" id="confirm-modal-title">
                  {titulo || 'Confirmar acción'}
                </h5>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={onCancelar}
                disabled={cargando}
                aria-label="Cerrar"
              ></button>
            </div>

            {/* Body */}
            <div className="modal-body pt-3">
              <p className="text-muted mb-0">
                {mensaje || '¿Estás seguro de que deseas realizar esta acción?'}
              </p>
            </div>

            {/* Footer */}
            <div className="modal-footer border-0 pt-0 gap-2">
              <button
                id="btn-confirm-cancel"
                type="button"
                className="btn btn-outline-secondary"
                onClick={onCancelar}
                disabled={cargando}
              >
                Cancelar
              </button>
              <button
                id="btn-confirm-ok"
                type="button"
                className="btn btn-danger fw-semibold"
                onClick={onConfirmar}
                disabled={cargando}
              >
                {cargando ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Eliminando...
                  </>
                ) : (
                  <>
                    <i className="bi bi-trash3-fill me-1"></i>
                    Eliminar
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

export default ConfirmModal;
