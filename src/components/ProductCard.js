import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const IMAGEN_FALLBACK = 'https://placehold.co/400x300/e2e8f0/94a3b8?text=Sin+imagen';

// Rango de padding-top permitido (%) para controlar el alto del contenedor
const RATIO_MIN = 68;   // imágenes muy anchas (panorámicas)
const RATIO_MAX = 125;  // imágenes muy altas (retrato)
const RATIO_DEFAULT = 75; // mientras carga o sin imagen

/**
 * Card individual de producto.
 * Detecta automáticamente si la imagen es vertical u horizontal
 * y ajusta el alto del contenedor para mostrarla lo más completa posible.
 */
function ProductCard({ producto, onVer, onEditar, onEliminar }) {
  const { esAdmin } = useAuth();

  // paddingTop del contenedor de imagen — se recalcula al cargar cada imagen
  const [paddingTop, setPaddingTop] = useState(`${RATIO_DEFAULT}%`);

  const formatPrecio = (valor) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor);

  /**
   * Al cargar la imagen, calcula el ratio real y ajusta el contenedor.
   * El padding-top del truco CSS es: (height / width) * 100 %.
   */
  const handleImgLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.target;
    if (!naturalWidth || !naturalHeight) return;

    const ratio = (naturalHeight / naturalWidth) * 100;
    // Limitar entre RATIO_MIN y RATIO_MAX para no crear cards extremadamente altas o bajas
    const ratioFinal = Math.min(Math.max(ratio, RATIO_MIN), RATIO_MAX);
    setPaddingTop(`${ratioFinal.toFixed(1)}%`);
  };

  const handleImgError = (e) => {
    e.target.src = IMAGEN_FALLBACK;
    setPaddingTop(`${RATIO_DEFAULT}%`);
  };

  return (
    <div className="product-card card h-100 border-0 shadow-sm">

      {/* ── Imagen + overlay de acciones ── */}
      <div className="product-card-img-wrapper" style={{ paddingTop }}>
        <img
          src={producto.imagen_url || IMAGEN_FALLBACK}
          alt={producto.nombre}
          className="product-card-img"
          onLoad={handleImgLoad}
          onError={handleImgError}
          loading="lazy"
        />

        {/* Badge de stock */}
        {producto.stock <= 5 && producto.stock > 0 && (
          <span className="badge bg-warning text-dark position-absolute top-0 start-0 m-2 small">
            ¡{producto.stock} restantes!
          </span>
        )}
        {producto.stock === 0 && (
          <span className="badge bg-danger position-absolute top-0 start-0 m-2 small">
            Sin stock
          </span>
        )}

        {/* Overlay de botones */}
        <div className="product-card-overlay">
          <button
            id={`btn-ver-${producto.id}`}
            className="card-action-btn"
            onClick={() => onVer(producto)}
            title="Ver detalles"
            aria-label="Ver detalles del producto"
          >
            <i className="bi bi-eye"></i>
          </button>

          {esAdmin && (
            <>
              <button
                id={`btn-editar-${producto.id}`}
                className="card-action-btn"
                onClick={() => onEditar(producto)}
                title="Editar producto"
                aria-label="Editar producto"
              >
                <i className="bi bi-pencil"></i>
              </button>
              <button
                id={`btn-eliminar-${producto.id}`}
                className="card-action-btn card-action-btn--danger"
                onClick={() => onEliminar(producto)}
                title="Eliminar producto"
                aria-label="Eliminar producto"
              >
                <i className="bi bi-trash3"></i>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Cuerpo ── */}
      <div className="card-body d-flex flex-column p-2 pt-2">
        <h2 className="product-card-name h6 fw-bold mb-2 lh-sm">
          {producto.nombre}
        </h2>

        <div className="product-prices mt-auto">
          <div className="price-row price-row-base">
            <span className="price-label">Base</span>
            <span className="price-base">{formatPrecio(producto.precio_base)}</span>
          </div>
          <div className="price-row price-row-sug">
            <span className="price-label">Sugerido</span>
            <span className="price-sugerido">{formatPrecio(producto.precio_sugerido)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductCard;
