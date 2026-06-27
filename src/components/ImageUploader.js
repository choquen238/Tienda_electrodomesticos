import React, { useRef, useState, useCallback } from 'react';
import supabase from '../lib/supabaseClient';
import ImageCropEditor from './ImageCropEditor';

const BUCKET = 'productos-imagenes';
const MAX_SIZE_MB = 15; // un poco más generoso para fotos de cámara sin editar

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
 * Componente de carga de imágenes con editor de recorte integrado.
 *
 * Flujo:
 *   1. Usuario selecciona un archivo de imagen.
 *   2. Se abre el editor de recorte (ImageCropEditor):
 *        – Arrastra los handles para definir el área de recorte.
 *        – Rota 90° izq/der si la foto salió girada.
 *   3. Al confirmar, se sube el Blob WebP resultante a Supabase Storage.
 *
 * Props:
 *   - onUpload(url): función llamada con la URL pública tras subir
 *   - urlActual: URL actual de la imagen (para preview)
 *   - disabled: deshabilita el input
 */
function ImageUploader({ onUpload, urlActual, disabled }) {
  const [subiendo, setSubiendo]                 = useState(false);
  const [error, setError]                       = useState('');
  const [previewUrl, setPreviewUrl]             = useState(urlActual || '');
  const [archivoParaEditar, setArchivoParaEditar] = useState(null);
  const [mostrarEditor, setMostrarEditor]       = useState(false);

  const inputRef      = useRef(null);
  const blobUrlRef    = useRef(null); // para revocar al desmontar

  /* ─────────────────────────────────────────
     PASO 1: Validar archivo y abrir editor
  ───────────────────────────────────────── */
  const handleFile = (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;

    setError('');

    const mimeType = getMimeType(archivo);

    if (!ACCEPTED_TYPES.has(mimeType)) {
      setError(`Formato no soportado (${archivo.name}). Usa: ${FORMATOS_LEGIBLES}.`);
      return;
    }

    if (archivo.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`El archivo supera el límite de ${MAX_SIZE_MB} MB.`);
      return;
    }

    // Abrir editor en lugar de subir directamente
    setArchivoParaEditar(archivo);
    setMostrarEditor(true);
  };

  /* ─────────────────────────────────────────
     PASO 2a: Confirmar recorte → subir Blob
  ───────────────────────────────────────── */
  const handleSubirBlob = useCallback(async (blob, ext) => {
    setMostrarEditor(false);
    setArchivoParaEditar(null);

    // Preview local inmediato con el Blob recortado
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    const localUrl = URL.createObjectURL(blob);
    blobUrlRef.current = localUrl;
    setPreviewUrl(localUrl);

    // Subida a Supabase Storage
    setSubiendo(true);
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const filePath = `productos/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, blob, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'image/webp',
      });

    if (uploadError) {
      setError('Error al subir la imagen: ' + uploadError.message);
      setSubiendo(false);
      return;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
    setSubiendo(false);
    onUpload(data.publicUrl);
  }, [onUpload]);

  /* ─────────────────────────────────────────
     PASO 2b: Cancelar editor
  ───────────────────────────────────────── */
  const handleCancelarEditor = useCallback(() => {
    setMostrarEditor(false);
    setArchivoParaEditar(null);
    // Limpiar el input para que el usuario pueda seleccionar el mismo archivo si quiere
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  /* ─────────────────────────────────────────
     Quitar imagen actual
  ───────────────────────────────────────── */
  const handleLimpiar = () => {
    setPreviewUrl('');
    onUpload('');
    if (inputRef.current) inputRef.current.value = '';
    setError('');
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  };

  /* ─────────────────────────────────────────
     RENDER
  ───────────────────────────────────────── */
  return (
    <>
      {/* Editor de recorte (se muestra encima del modal del producto) */}
      {mostrarEditor && archivoParaEditar && (
        <ImageCropEditor
          file={archivoParaEditar}
          onConfirmar={handleSubirBlob}
          onCancelar={handleCancelarEditor}
        />
      )}

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
              accept="image/*"   /* validación real en handleFile */
              onChange={handleFile}
              disabled={subiendo || mostrarEditor}
            />
            {subiendo && (
              <span className="input-group-text">
                <span className="spinner-border spinner-border-sm" role="status"></span>
                <span className="ms-2 small">Subiendo...</span>
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
          <span className="ms-2 text-primary">
            <i className="bi bi-scissors me-1"></i>Se abrirá el editor de recorte
          </span>
        </div>
      </div>
    </>
  );
}

export default ImageUploader;
