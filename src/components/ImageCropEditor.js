import React, { useRef, useEffect, useCallback, useState } from 'react';

/**
 * Editor de recorte de imagen client-side.
 * Usa Canvas API pura — sin dependencias externas.
 *
 * Props:
 *   file        — File objeto original del input
 *   onConfirmar(blob, ext) — llamada con el Blob recortado listo para subir
 *   onCancelar()           — llamada si el usuario cancela
 */

const HANDLE_RADIUS = 10;   // radio de los puntos de agarre (px en canvas display)
const MIN_CROP_PX   = 30;   // mínimo lado del área de recorte (px en imagen real)

/** Posiciones de los 8 handles alrededor del rect de recorte (en coordenadas display) */
function getHandles(cx, cy, cw, ch) {
  return [
    { id: 'nw', x: cx,        y: cy        },
    { id: 'n',  x: cx + cw/2, y: cy        },
    { id: 'ne', x: cx + cw,   y: cy        },
    { id: 'e',  x: cx + cw,   y: cy + ch/2 },
    { id: 'se', x: cx + cw,   y: cy + ch   },
    { id: 's',  x: cx + cw/2, y: cy + ch   },
    { id: 'sw', x: cx,        y: cy + ch   },
    { id: 'w',  x: cx,        y: cy + ch/2 },
  ];
}

/** Cursores CSS según qué handle se está arrastrando */
const CURSOR_MAP = {
  nw: 'nwse-resize', se: 'nwse-resize',
  ne: 'nesw-resize', sw: 'nesw-resize',
  n:  'ns-resize',   s:  'ns-resize',
  e:  'ew-resize',   w:  'ew-resize',
  move: 'move',
};

function ImageCropEditor({ file, onConfirmar, onCancelar }) {
  const canvasRef = useRef(null);

  /**
   * Todo el estado mutable de dibujo vive en un ref para evitar re-renders
   * en cada frame de arrastre.
   */
  const st = useRef({
    img: null,           // HTMLImageElement cargado
    rotatedCanvas: null, // canvas offscreen con la imagen rotada
    rotation: 0,         // 0 | 90 | 180 | 270
    crop: null,          // { x, y, w, h } en píxeles de la imagen rotada
    scale: 1,            // factor de escala imagen → canvas display
    ox: 0,               // offset X del canvas display
    oy: 0,               // offset Y del canvas display
    drag: null,          // { type, startPx, startPy, origCrop }
  });

  // Estado React solo para re-renderizar los botones de rotación
  const [uiRotation, setUiRotation] = useState(0);
  const [listo, setListo] = useState(false);

  /* ─────────────────────────────────────────
     CONSTRUCCIÓN DEL CANVAS ROTADO (offscreen)
  ───────────────────────────────────────── */
  const buildRotatedCanvas = useCallback((img, deg) => {
    const rad = (deg * Math.PI) / 180;
    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    const newW = Math.round(W * cos + H * sin);
    const newH = Math.round(W * sin + H * cos);

    const c = document.createElement('canvas');
    c.width  = newW;
    c.height = newH;
    const ctx = c.getContext('2d');
    ctx.translate(newW / 2, newH / 2);
    ctx.rotate(rad);
    ctx.drawImage(img, -W / 2, -H / 2);
    return c;
  }, []);

  /* ─────────────────────────────────────────
     CROP INICIAL: margen del 5% en cada lado
  ───────────────────────────────────────── */
  const initCrop = useCallback((rc) => {
    const m = Math.min(rc.width, rc.height) * 0.05;
    st.current.crop = {
      x: m,
      y: m,
      w: rc.width  - m * 2,
      h: rc.height - m * 2,
    };
  }, []);

  /* ─────────────────────────────────────────
     CÁLCULO DE ESCALA Y OFFSET
  ───────────────────────────────────────── */
  const computeLayout = useCallback(() => {
    const canvas = canvasRef.current;
    const rc     = st.current.rotatedCanvas;
    if (!canvas || !rc) return;
    const s = Math.min(canvas.width / rc.width, canvas.height / rc.height) * 0.94;
    st.current.scale = s;
    st.current.ox    = (canvas.width  - rc.width  * s) / 2;
    st.current.oy    = (canvas.height - rc.height * s) / 2;
  }, []);

  /* ─────────────────────────────────────────
     DIBUJO IMPERATIVO EN CANVAS
  ───────────────────────────────────────── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const { rotatedCanvas: rc, scale: s, ox, oy, crop } = st.current;
    if (!canvas || !rc) return;

    const ctx  = canvas.getContext('2d');
    const cW   = canvas.width;
    const cH   = canvas.height;
    const iW   = rc.width  * s;
    const iH   = rc.height * s;

    // Fondo
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, cW, cH);

    // Imagen rotada
    ctx.drawImage(rc, ox, oy, iW, iH);

    if (!crop) return;

    // Coordenadas del recorte en el display canvas
    const cx = ox + crop.x * s;
    const cy = oy + crop.y * s;
    const cw = crop.w * s;
    const ch = crop.h * s;

    // Oscurecer zona fuera del recorte (4 rectángulos alrededor)
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(ox,      oy,      iW,      cy - oy);             // arriba
    ctx.fillRect(ox,      cy + ch, iW,      oy + iH - cy - ch);   // abajo
    ctx.fillRect(ox,      cy,      cx - ox, ch);                   // izquierda
    ctx.fillRect(cx + cw, cy,      ox + iW - cx - cw, ch);        // derecha

    // Borde del área de recorte (ámbar)
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth   = 2;
    ctx.strokeRect(cx, cy, cw, ch);

    // Líneas de tercios (guía de composición)
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth   = 0.8;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    for (let i = 1; i <= 2; i++) {
      ctx.moveTo(cx + cw * i / 3, cy); ctx.lineTo(cx + cw * i / 3, cy + ch);
      ctx.moveTo(cx, cy + ch * i / 3); ctx.lineTo(cx + cw, cy + ch * i / 3);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Handles de arrastre
    getHandles(cx, cy, cw, ch).forEach(h => {
      ctx.beginPath();
      ctx.arc(h.x, h.y, HANDLE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle   = '#f59e0b';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth   = 2;
      ctx.stroke();
    });
  }, []);

  /* ─────────────────────────────────────────
     CARGA DE LA IMAGEN AL MONTAR
  ───────────────────────────────────────── */
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      st.current.img      = img;
      st.current.rotation = 0;
      const rc = buildRotatedCanvas(img, 0);
      st.current.rotatedCanvas = rc;
      initCrop(rc);
      computeLayout();
      draw();
      setListo(true);
    };
    img.onerror = () => {
      console.error('No se pudo cargar la imagen para el editor.');
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, buildRotatedCanvas, initCrop, computeLayout, draw]);

  /* ─────────────────────────────────────────
     RESIZE OBSERVER — adaptar canvas al contenedor
  ───────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width  = parent.clientWidth;
      canvas.height = parent.clientHeight;
      computeLayout();
      draw();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);
    resize();
    return () => ro.disconnect();
  }, [computeLayout, draw]);

  /* ─────────────────────────────────────────
     ROTACIÓN
  ───────────────────────────────────────── */
  const rotate = useCallback((dir) => {
    const s = st.current;
    if (!s.img) return;
    const newRot = ((s.rotation + dir * 90) + 360) % 360;
    s.rotation = newRot;
    const rc = buildRotatedCanvas(s.img, newRot);
    s.rotatedCanvas = rc;
    initCrop(rc);
    setUiRotation(newRot);
    computeLayout();
    draw();
  }, [buildRotatedCanvas, initCrop, computeLayout, draw]);

  /* ─────────────────────────────────────────
     UTILIDAD: posición del puntero/toque en coords canvas
  ───────────────────────────────────────── */
  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    const scX    = canvas.width  / rect.width;
    const scY    = canvas.height / rect.height;
    const src    = e.touches?.[0] ?? e;
    return {
      x: (src.clientX - rect.left) * scX,
      y: (src.clientY - rect.top)  * scY,
    };
  };

  /* ─────────────────────────────────────────
     EVENTOS DE ARRASTRE (mouse + touch)
  ───────────────────────────────────────── */
  const onDown = useCallback((e) => {
    e.preventDefault();
    const s = st.current;
    if (!s.crop) return;
    const { x: px, y: py } = getPos(e);
    const { scale: sc, ox, oy, crop } = s;
    const cx = ox + crop.x * sc;
    const cy = oy + crop.y * sc;
    const cw = crop.w * sc;
    const ch = crop.h * sc;

    // Verificar handles primero
    let hitId = null;
    for (const h of getHandles(cx, cy, cw, ch)) {
      if (Math.hypot(px - h.x, py - h.y) <= HANDLE_RADIUS + 6) {
        hitId = h.id;
        break;
      }
    }

    if (hitId) {
      s.drag = { type: hitId, startPx: px, startPy: py, origCrop: { ...crop } };
    } else if (px >= cx && px <= cx + cw && py >= cy && py <= cy + ch) {
      s.drag = { type: 'move', startPx: px, startPy: py, origCrop: { ...crop } };
    }
  }, []);

  const onMove = useCallback((e) => {
    e.preventDefault();
    const s = st.current;
    if (!s.drag || !s.rotatedCanvas) return;

    const { x: px, y: py } = getPos(e);
    const { scale: sc, drag: d, rotatedCanvas: rc } = s;
    const imgW = rc.width;
    const imgH = rc.height;
    const dx   = (px - d.startPx) / sc;
    const dy   = (py - d.startPy) / sc;

    // Actualizar cursor
    if (canvasRef.current) {
      canvasRef.current.style.cursor = CURSOR_MAP[d.type] || 'move';
    }

    let { x, y, w, h } = d.origCrop;

    if (d.type === 'move') {
      x = Math.max(0, Math.min(imgW - w, x + dx));
      y = Math.max(0, Math.min(imgH - h, y + dy));
    } else {
      if (d.type.includes('n')) {
        const ny = Math.max(0, Math.min(y + h - MIN_CROP_PX, y + dy));
        h = y + h - ny;
        y = ny;
      }
      if (d.type.includes('s')) {
        h = Math.max(MIN_CROP_PX, Math.min(imgH - y, h + dy));
      }
      if (d.type.includes('w')) {
        const nx = Math.max(0, Math.min(x + w - MIN_CROP_PX, x + dx));
        w = x + w - nx;
        x = nx;
      }
      if (d.type.includes('e')) {
        w = Math.max(MIN_CROP_PX, Math.min(imgW - x, w + dx));
      }
    }

    s.crop = { x, y, w, h };
    draw();
  }, [draw]);

  const onUp = useCallback(() => {
    st.current.drag = null;
    if (canvasRef.current) canvasRef.current.style.cursor = 'crosshair';
  }, []);

  /** Actualiza el cursor al pasar el mouse (sin arrastrar) */
  const onHover = useCallback((e) => {
    const s = st.current;
    if (s.drag || !s.crop) return;
    const { x: px, y: py } = getPos(e);
    const { scale: sc, ox, oy, crop } = s;
    const cx = ox + crop.x * sc;
    const cy = oy + crop.y * sc;
    const cw = crop.w * sc;
    const ch = crop.h * sc;

    let cursor = 'crosshair';
    for (const h of getHandles(cx, cy, cw, ch)) {
      if (Math.hypot(px - h.x, py - h.y) <= HANDLE_RADIUS + 6) {
        cursor = CURSOR_MAP[h.id] || 'pointer';
        break;
      }
    }
    if (cursor === 'crosshair' && px >= cx && px <= cx + cw && py >= cy && py <= cy + ch) {
      cursor = 'move';
    }
    if (canvasRef.current) canvasRef.current.style.cursor = cursor;
  }, []);

  const onMouseMove = useCallback((e) => {
    if (st.current.drag) onMove(e);
    else onHover(e);
  }, [onMove, onHover]);

  /* ─────────────────────────────────────────
     CONFIRMAR: extraer recorte → Blob WebP
  ───────────────────────────────────────── */
  const handleConfirmar = useCallback(() => {
    const s = st.current;
    if (!s.rotatedCanvas || !s.crop) return;
    const { rotatedCanvas: rc, crop } = s;

    const out = document.createElement('canvas');
    out.width  = Math.round(crop.w);
    out.height = Math.round(crop.h);
    out.getContext('2d').drawImage(
      rc,
      Math.round(crop.x), Math.round(crop.y),
      Math.round(crop.w), Math.round(crop.h),
      0, 0,
      Math.round(crop.w), Math.round(crop.h),
    );

    out.toBlob(
      (blob) => { if (blob) onConfirmar(blob, 'webp'); },
      'image/webp',
      0.92,
    );
  }, [onConfirmar]);

  /* ─────────────────────────────────────────
     RENDER
  ───────────────────────────────────────── */
  return (
    <div className="crop-editor-overlay" role="dialog" aria-modal="true" aria-label="Editor de recorte de imagen">
      <div className="crop-editor-panel">

        {/* ── Header ── */}
        <div className="crop-editor-header">
          <div className="crop-editor-title">
            <i className="bi bi-scissors me-2"></i>
            <span className="fw-semibold">Recortar imagen</span>
            <span className="crop-editor-hint">· Arrastra los puntos ámbar para ajustar</span>
          </div>
          <div className="crop-rotate-btns">
            <button
              type="button"
              className="crop-rotate-btn"
              onClick={() => rotate(-1)}
              title="Rotar 90° a la izquierda"
              aria-label="Rotar 90 grados a la izquierda"
            >
              <i className="bi bi-arrow-counterclockwise"></i>
              <span>90° Izq</span>
            </button>
            <button
              type="button"
              className="crop-rotate-btn"
              onClick={() => rotate(1)}
              title="Rotar 90° a la derecha"
              aria-label="Rotar 90 grados a la derecha"
            >
              <i className="bi bi-arrow-clockwise"></i>
              <span>90° Der</span>
            </button>
          </div>
        </div>

        {/* ── Canvas ── */}
        <div className="crop-canvas-wrapper">
          {!listo && (
            <div className="crop-loading">
              <div className="spinner-border text-warning" role="status">
                <span className="visually-hidden">Cargando imagen...</span>
              </div>
            </div>
          )}
          <canvas
            ref={canvasRef}
            id="canvas-crop-editor"
            onMouseDown={onDown}
            onMouseMove={onMouseMove}
            onMouseUp={onUp}
            onMouseLeave={onUp}
            onTouchStart={onDown}
            onTouchMove={onMove}
            onTouchEnd={onUp}
            style={{ cursor: 'crosshair', touchAction: 'none', display: 'block' }}
            aria-label="Área de recorte interactiva"
          />
        </div>

        {/* ── Footer ── */}
        <div className="crop-editor-footer">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={onCancelar}
            id="btn-crop-cancelar"
          >
            <i className="bi bi-x-circle me-1"></i>Cancelar
          </button>

          <p className="crop-editor-tip mb-0">
            <i className="bi bi-lightbulb me-1 text-warning"></i>
            Si la foto sale girada, usa los botones de rotación
          </p>

          <button
            type="button"
            className="btn btn-warning fw-semibold text-white btn-sm"
            onClick={handleConfirmar}
            id="btn-crop-confirmar"
          >
            <i className="bi bi-check2-circle me-1"></i>Usar imagen recortada
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImageCropEditor;
