import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const IMAGEN_FALLBACK = 'https://placehold.co/400x300/e2e8f0/94a3b8?text=Sin+imagen';

const RATIO_MIN     = 68;
const RATIO_MAX     = 125;
const RATIO_DEFAULT = 75;

const PRECIO_OCULTO = '••••••';

/**
 * Card individual de producto.
 * Botones posicionados individualmente sobre la imagen:
 *   - Ver    → esquina superior derecha
 *   - Editar → esquina superior izquierda
 *   - Eliminar → debajo de Editar (izquierda)
 */
function ProductCard({ producto, onVer, onEditar, onEliminar }) {
  const { esAdmin } = useAuth();

  const [paddingTop, setPaddingTop] = useState(`${RATIO_DEFAULT}%`);
  const [verBase, setVerBase]       = useState(false);

  const formatPrecio = (valor) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor);

  const handleImgLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.target;
    if (!naturalWidth || !naturalHeight) return;
    const ratio = (naturalHeight / naturalWidth) * 100;
    setPaddingTop(`${Math.min(Math.max(ratio, RATIO_MIN), RATIO_MAX).toFixed(1)}%`);
  };

  const handleImgError = (e) => {
    e.target.src = IMAGEN_FALLBACK;
    setPaddingTop(`${RATIO_DEFAULT}%`);
  };

  return (
    <div className="product-card card h-100 border-0 shadow-sm">

      {/* ── Imagen con botones posicionados ── */}
      <div className="product-card-img-wrapper" style={{ paddingTop }}>
        <img
          src={producto.imagen_url || IMAGEN_FALLBACK}
          alt={producto.nombre}
          className="product-card-img"
          onLoad={handleImgLoad}
          onError={handleImgError}
          loading="lazy"
        />

        {/* Badges de stock */}
        {producto.stock <= 5 && producto.stock > 0 && (
          <span className="badge bg-warning text-dark position-absolute top-0 start-0 m-2 small"
                style={{ left: esAdmin ? '52px' : '8px', top: '8px', margin: 0 }}>
            ¡{producto.stock} restantes!
          </span>
        )}
        {producto.stock === 0 && (
          <span className="badge bg-danger position-absolute small"
                style={{ left: esAdmin ? '52px' : '8px', top: '8px', margin: 0 }}>
            Sin stock
          </span>
        )}

        {/* ── Botón VER — esquina superior derecha ── */}
        <button
          id={`btn-ver-${producto.id}`}
          className="card-action-btn card-btn-ver"
          onClick={() => onVer(producto)}
          title="Ver detalles"
          aria-label="Ver detalles del producto"
        >
          <i className="bi bi-eye"></i>
        </button>

        {/* ── Botones admin — columna superior izquierda ── */}
        {esAdmin && (
          <div className="card-admin-col">
            <button
              id={`btn-editar-${producto.id}`}
              className="card-action-btn card-btn-admin"
              onClick={() => onEditar(producto)}
              title="Editar producto"
              aria-label="Editar producto"
            >
              <i className="bi bi-pencil"></i>
            </button>
            <button
              id={`btn-eliminar-${producto.id}`}
              className="card-action-btn card-btn-admin card-action-btn--danger"
              onClick={() => onEliminar(producto)}
              title="Eliminar producto"
              aria-label="Eliminar producto"
            >
              <i className="bi bi-trash3"></i>
            </button>
          </div>
        )}
      </div>

      {/* ── Cuerpo ── */}
      <div className="card-body d-flex flex-column p-2 pt-2">
        <h2 className="product-card-name h6 fw-bold mb-2 lh-sm">
          {producto.nombre}
        </h2>

        <div className="product-prices mt-auto">
          {/* Precio Sugerido — siempre visible (verde / prominente) */}
          <div className="price-row price-row-sug">
            <span className="price-label">Sugerido</span>
            <span className="price-sugerido">{formatPrecio(producto.precio_sugerido)}</span>
          </div>

          {/* Precio Base — clic en cualquier parte del contenedor revela el precio */}
          <div
            className="price-row price-row-base"
            onClick={() => setVerBase(v => !v)}
            style={{ cursor: 'pointer' }}
            title={verBase ? 'Ocultar precio base' : 'Ver precio base'}
            role="button"
            aria-label="Ver precio base"
          >
            <span className="price-label">Base</span>
            <span className="d-flex align-items-center gap-1">
              {verBase
                ? <span className="price-base">{formatPrecio(producto.precio_base)}</span>
                : <span className="price-hidden">{PRECIO_OCULTO}</span>
              }
              <i className={`bi ${verBase ? 'bi-eye-slash' : 'bi-eye'} price-toggle-icon`}></i>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductCard;
