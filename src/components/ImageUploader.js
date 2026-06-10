import React, { useRef, useState } from 'react';
import supabase from '../lib/supabaseClient';

const BUCKET = 'productos-imagenes';
const MAX_SIZE_MB = 10;

/**
 * Tipos MIME aceptados con sus extensiones correspondientes.
 * Se usa `image/*` en el atributo accept del input para máxima compatibilidad,
 * y la validación se hace por MIME type en handleFile.
 */
const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/svg+xml',
  'image/avif',
  'image/heic',
  'image/heif',
]);

/**
 * Mapeo de extensiones a MIME types para archivos cuyo tipo
 * el navegador no detecta correctamente (ej: HEIC en Windows).
 */
const EXT_TO_MIME = {
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  webp: 'image/webp',
  gif:  'image/gif',
  bmp:  'image/bmp',
  tiff: 'image/tiff',
  tif:  'image/tiff',
  svg:  'image/svg+xml',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
};

const FORMATOS_LEGIBLES = 'JPG, JPEG, PNG, WebP, GIF, BMP, TIFF, SVG, AVIF, HEIC';

/**
 * Determina el MIME type real del archivo.
 * Usa `archivo.type` si está disponible; si no, infiere por extensión.
 */
function getMimeType(archivo) {
  if (archivo.type && archivo.type !== 'application/octet-stream') {
    return archivo.type;
  }
  const ext = archivo.name.split('.').pop().toLowerCase();
  return EXT_TO_MIME[ext] || archivo.type;
}

/**
 * Componente para subir imágenes a Supabase Storage.
 * Props:
 *   - onUpload(url): función llamada con la URL pública tras subir
 *   - urlActual: URL actual de la imagen (para preview)
 *   - disabled: deshabilita el input
 */
function ImageUploader({ onUpload, urlActual, disabled }) {
  const [subiendo, setSubiendo]     = useState(false);
  const [error, setError]           = useState('');
  const [previewUrl, setPreviewUrl] = useState(urlActual || '');
  const inputRef = useRef(null);

  const handleFile = async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;

    setError('');

    // Determinar tipo real (algunos navegadores/SO reportan tipo vacío)
    const mimeType = getMimeType(archivo);

    // Validar tipo
    if (!ACCEPTED_TYPES.has(mimeType)) {
      setError(`Formato no soportado (${archivo.name}). Usa: ${FORMATOS_LEGIBLES}.`);
      return;
    }

    // Validar tamaño
    if (archivo.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`El archivo supera el límite de ${MAX_SIZE_MB} MB.`);
      return;
    }

    // Preview local inmediato (SVG y tipos especiales también funcionan con FileReader)
    const reader = new FileReader();
    reader.onload = (ev) => setPreviewUrl(ev.target.result);
    reader.readAsDataURL(archivo);

    // Subida a Supabase Storage
    setSubiendo(true);
    const ext      = archivo.name.split('.').pop().toLowerCase() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const filePath = `productos/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, archivo, {
        cacheControl: '3600',
        upsert: false,
        contentType: mimeType,  // forzar el Content-Type correcto en Storage
      });

    if (uploadError) {
      setError('Error al subir la imagen: ' + uploadError.message);
      setSubiendo(false);
      return;
    }

    // Obtener URL pública
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
    setSubiendo(false);
    onUpload(data.publicUrl);
  };

  const handleLimpiar = () => {
    setPreviewUrl('');
    onUpload('');
    if (inputRef.current) inputRef.current.value = '';
    setError('');
  };

  return (
    <div className="image-uploader">
      {/* Preview */}
      {previewUrl && (
        <div className="uploader-preview mb-2 position-relative">
          <img
            src={previewUrl}
            alt="Preview del producto"
            className="img-fluid rounded"
            style={{ maxHeight: '160px', objectFit: 'cover', width: '100%' }}
            onError={(e) => {
              // Si el preview falla (ej: SVG con restricciones), mostrar ícono genérico
              e.target.style.display = 'none';
            }}
          />
          {!disabled && (
            <button
              type="button"
              className="btn btn-sm btn-danger position-absolute top-0 end-0 m-1"
              onClick={handleLimpiar}
              title="Quitar imagen"
            >
              <i className="bi bi-x-lg"></i>
            </button>
          )}
        </div>
      )}

      {/* Input de archivo */}
      {!disabled && (
        <div className="input-group input-group-sm">
          <input
            ref={inputRef}
            id="input-imagen-producto"
            type="file"
            className="form-control"
            accept="image/*"          /* acepta cualquier imagen; validación real en handleFile */
            onChange={handleFile}
            disabled={subiendo}
          />
          {subiendo && (
            <span className="input-group-text">
              <span className="spinner-border spinner-border-sm" role="status"></span>
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="text-danger small mt-1">
          <i className="bi bi-exclamation-circle me-1"></i>{error}
        </div>
      )}

      <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '4px' }}>
        {FORMATOS_LEGIBLES} · Máx. {MAX_SIZE_MB} MB
      </div>
    </div>
  );
}

export default ImageUploader;
