import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const IMAGEN_FALLBACK = 'https://placehold.co/400x300/e2e8f0/94a3b8?text=Sin+imagen';

const RATIO_MIN = 68;
const RATIO_MAX = 125;
const RATIO_DEFAULT = 75;

const PRECIO_OCULTO = '••••••';

/**
 * Categorías que usan layout horizontal: imagen a la derecha (40%),
 * contenido a la izquierda (60%).
 */
const CATEGORIAS_HORIZONTAL = ['freezer', 'lavadora frontal', 'lavadora superior', 'refrigerador'];

/**
 * Card individual de producto.
 * - Layout estándar (imagen arriba): para la mayoría de categorías.
 * - Layout horizontal (imagen derecha 40%): para Freezer, Lavadora Frontal,
 *   Lavadora Superior y Refrigerador.
 * Botones de acción posicionados sobre la zona de la imagen.
 */
function ProductCard({ producto, categoriaNombre = '', onVer, onEditar, onEliminar }) {
  const { esAdmin } = useAuth();

  const [paddingTop, setPaddingTop] = useState(`${RATIO_DEFAULT}%`);
  const [verBase, setVerBase] = useState(false);

  const esHorizontal = CATEGORIAS_HORIZONTAL.includes(
    (categoriaNombre || '').trim().toLowerCase()
  );

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

  /* ── Sección de precios (reutilizada en ambos layouts) ── */
  const PreciosSection = () => (
    <div className="product-prices mt-auto">
      {/* Precio Sugerido */}
      <div className="price-row price-row-sug">
        <span className="price-label">Sugerido</span>
        <span className="price-sugerido">{formatPrecio(producto.precio_sugerido)}</span>
      </div>
      {/* Precio Base */}
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
  );

  /* ══════════════════════════════════════════
     LAYOUT HORIZONTAL (imagen derecha 40%)
     ══════════════════════════════════════════ */
  if (esHorizontal) {
    return (
      <div className="product-card product-card--horizontal card h-100 border-0 shadow-sm">

        {/* ── Botones: flotando sobre la esquina superior izquierda de la CARD COMPLETA ── */}
        <div className="pc-h-btn-overlay">
          {/* Ver */}
          <button
            id={`btn-ver-${producto.id}`}
            className="card-action-btn card-btn-ver"
            onClick={() => onVer(producto)}
            title="Ver detalles"
            aria-label="Ver detalles del producto"
          >
            <i className="bi bi-eye"></i>
          </button>

          {/* Editar + Eliminar (solo admin) */}
          {esAdmin && (
            <>
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
            </>
          )}
        </div>

        {/* ── Nombre + imagen ── */}
        <div className="pc-h-top">

          {/* Columna izquierda: nombre (con padding-top para no quedar detrás de los botones) */}
          <div className="pc-h-name-col">
            <h2 className="product-card-name pc-h-title fw-bold lh-sm mb-0">
              {producto.nombre}
            </h2>
          </div>

          {/* Imagen (40%) */}
          <div className="pc-h-img-wrapper">
            <img
              src={producto.imagen_url || IMAGEN_FALLBACK}
              alt={producto.nombre}
              className="pc-h-img"
              onError={handleImgError}
              loading="lazy"
            />

            {/* Badges de stock */}
            {producto.stock <= 5 && producto.stock > 0 && (
              <span className="badge bg-warning text-dark position-absolute small"
                style={{ right: '4px', bottom: '4px', top: 'auto' }}>
                ¡{producto.stock}!
              </span>
            )}
            {producto.stock === 0 && (
              <span className="badge bg-danger position-absolute small"
                style={{ right: '4px', bottom: '4px', top: 'auto' }}>
                Sin stock
              </span>
            )}
          </div>
        </div>

        {/* ── Precios ── */}
        <div className="pc-h-prices">
          <PreciosSection />
        </div>

      </div>
    );
  }

  /* ══════════════════════════════════════════
     LAYOUT ESTÁNDAR (imagen arriba)
     ══════════════════════════════════════════ */
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

        {/* Badges de stock — esquina superior derecha */}
        {producto.stock <= 5 && producto.stock > 0 && (
          <span className="badge bg-warning text-dark position-absolute small"
            style={{ right: '8px', top: '8px', margin: 0 }}>
            ¡{producto.stock} restantes!
          </span>
        )}
        {producto.stock === 0 && (
          <span className="badge bg-danger position-absolute small"
            style={{ right: '8px', top: '8px', margin: 0 }}>
            Sin stock
          </span>
        )}

        {/* ── Botón VER — esquina superior izquierda (CSS: top:8px left:8px) ── */}
        <button
          id={`btn-ver-${producto.id}`}
          className="card-action-btn card-btn-ver"
          onClick={() => onVer(producto)}
          title="Ver detalles"
          aria-label="Ver detalles del producto"
        >
          <i className="bi bi-eye"></i>
        </button>

        {/* ── Botones admin — columna izquierda, debajo del Ver (CSS: top:44px left:8px) ── */}
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
        <PreciosSection />
      </div>
    </div>
  );
}

export default ProductCard;
