import React, { useState, useEffect, useCallback, useMemo } from "react";
import supabase from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import ProductCard from "./ProductCard";
import ProductModal from "./ProductModal";
import CategoryModal from "./CategoryModal";
import ConfirmModal from "./ConfirmModal";

/**
 * Devuelve el nombre de clase del BootstrapIcon que mejor representa
 * una categoría basada en palabras clave en su nombre.
 */
function getCategoryIcon(nombre = "") {
    const n = nombre.toLowerCase();
    if (
        n.includes("refrig") ||
        n.includes("nevera") ||
        n.includes("congel") ||
        n.includes("frío")
    )
        return "bi-thermometer-snow";
    if (
        n.includes("lavar") ||
        n.includes("lavand") ||
        n.includes("secar") ||
        n.includes("lavadora")
    )
        return "bi-droplet-half";
    if (
        n.includes("cocin") ||
        n.includes("horno") ||
        n.includes("microon") ||
        n.includes("estufa") ||
        n.includes("lica")
    )
        return "bi-fire";
    if (
        n.includes("climat") ||
        n.includes("aire") ||
        n.includes("ventil") ||
        n.includes("calef")
    )
        return "bi-wind";
    if (
        n.includes("pequeñ") ||
        n.includes("tostador") ||
        n.includes("cafetera") ||
        n.includes("plancha") ||
        n.includes("electro")
    )
        return "bi-plug-fill";
    if (
        n.includes("tv") ||
        n.includes("telev") ||
        n.includes("entret") ||
        n.includes("audio") ||
        n.includes("sonido")
    )
        return "bi-tv";
    if (
        n.includes("comput") ||
        n.includes("laptop") ||
        n.includes("tecnol") ||
        n.includes("inform")
    )
        return "bi-laptop";
    if (
        n.includes("iluminac") ||
        n.includes("luz") ||
        n.includes("lámpara") ||
        n.includes("foco")
    )
        return "bi-lightbulb";
    if (n.includes("aspiir") || n.includes("aspira") || n.includes("limpiez"))
        return "bi-robot";
    if (n.includes("segur") || n.includes("cámara") || n.includes("alarm"))
        return "bi-shield-check";
    if (n.includes("batidor") || n.includes("mezcl") || n.includes("amasar"))
        return "bi-cup-hot";
    return "bi-grid-3x3-gap-fill"; // default
}

/**
 * Componente principal de listado de productos.
 * Incluye: búsqueda, acordeón por categoría, CRUD de productos y categorías.
 * Props:
 *   - modalCrear: boolean — controla si el modal de creación de producto está abierto
 *   - onCerrarCrear(): función para cerrar el modal de creación desde afuera
 */
function ProductList({ modalCrear, onCerrarCrear }) {
    const { esAdmin } = useAuth();

    const [productos, setProductos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [busqueda, setBusqueda] = useState("");

    // Acordeón: set de IDs de categorías abiertas (empieza vacío = todas colapsadas)
    const [categoriasAbiertas, setCategoriasAbiertas] = useState(new Set());

    // ── Modales de Productos ──
    const [modalVer, setModalVer] = useState(null);
    const [modalEditar, setModalEditar] = useState(null);
    const [confirmarProd, setConfirmarProd] = useState(null);
    const [eliminandoProd, setEliminandoProd] = useState(false);

    // ── Modales de Categorías ──
    const [catModalModo, setCatModalModo] = useState(null); // 'crear' | 'editar' | null
    const [catSeleccionada, setCatSeleccionada] = useState(null);
    const [confirmarCat, setConfirmarCat] = useState(null);
    const [eliminandoCat, setEliminandoCat] = useState(false);

    /* ── Carga de datos ── */
    const cargarDatos = useCallback(async () => {
        setCargando(true);
        setError("");

        const [{ data: cats, error: eCats }, { data: prods, error: eProds }] =
            await Promise.all([
                supabase.from("categorias").select("*").order("nombre"),
                supabase.from("productos").select("*").order("nombre"),
            ]);

        if (eCats || eProds) {
            setError(
                "No se pudieron cargar los datos. Verifica tu conexión o las variables de entorno.",
            );
        } else {
            setCategorias(cats || []);
            setProductos(prods || []);
            // No abrimos categorías automáticamente: empiezan todas colapsadas
        }

        setCargando(false);
    }, []);

    useEffect(() => {
        cargarDatos();
    }, [cargarDatos]);

    /* ── Filtrado ── */
    const productosFiltrados = useMemo(() => {
        const q = busqueda.toLowerCase().trim();
        if (!q) return productos;
        return productos.filter((p) => p.nombre.toLowerCase().includes(q));
    }, [productos, busqueda]);

    // En búsqueda activa mostramos todas las categorías que tengan resultados
    // Sin búsqueda mostramos todas las categorías (aunque estén vacías) para admin

    /**
     * Orden fijo para las categorías principales.
     * Las demás conservan el orden alfabético de Supabase (.order('nombre')).
     */
    const ORDEN_CATEGORIAS = [
        "refrigerador",
        "lavadora frontal",
        "lavadora superior",
        "freezer",
    ];

    const ordenarCategorias = (cats) => {
        return [...cats].sort((a, b) => {
            const na = (a.nombre || "").trim().toLowerCase();
            const nb = (b.nombre || "").trim().toLowerCase();
            const ia = ORDEN_CATEGORIAS.indexOf(na);
            const ib = ORDEN_CATEGORIAS.indexOf(nb);

            // Ambas en la lista fija → respetar el orden de la lista
            if (ia !== -1 && ib !== -1) return ia - ib;
            // Solo a está en la lista → a va primero
            if (ia !== -1) return -1;
            // Solo b está en la lista → b va primero
            if (ib !== -1) return 1;
            // Ninguna en la lista → mantener el orden alfabético original
            return na.localeCompare(nb, "es");
        });
    };

    /**
     * Extrae el primer número que aparece en el nombre del producto.
     * Ej: "Refrigerador 320 Lt Samsung" → 320
     *     "Lavadora 8 Kg LG" → 8
     *     "Radiador 5 paneles" → 5
     * Retorna -Infinity si no encuentra número (irá al final en orden desc).
     */
    const extraerNumero = (nombre = "") => {
        const match = nombre.match(/(\d+([.,]\d+)?)/);
        if (!match) return -Infinity;
        return parseFloat(match[1].replace(",", "."));
    };

    /**
     * Determina si un producto está sin stock.
     * Considera sin stock cuando stock === 0 o stock === null/undefined.
     */
    const sinStock = (prod) => !prod.stock || prod.stock === 0;

    /**
     * Ordena los productos de una categoría según las reglas definidas:
     * - Los productos sin stock siempre van al final.
     * - Según el nombre de la categoría, se ordena por valor numérico extraído del nombre
     *   del producto de mayor a menor.
     */
    const ordenarProductos = (productos, categoriaNombre) => {
        const cat = (categoriaNombre || "").trim().toLowerCase();

        // Categorías que se ordenan por número extraído del nombre (asc)
        const CATS_POR_NUMERO = [
            "refrigerador",
            "freezer",
            "lavadora frontal",
            "lavadora superior",
            "microondas",
            "ollas a presión",
            "ollas a presion",
            "radiadores",
            "radiador",
        ];

        const usaOrdenNumerico = CATS_POR_NUMERO.includes(cat);

        return [...productos].sort((a, b) => {
            const asinStock = sinStock(a);
            const bsinStock = sinStock(b);

            // Regla 1: sin stock siempre va al final
            if (asinStock && !bsinStock) return 1;
            if (!asinStock && bsinStock) return -1;

            // Regla 2: dentro del mismo grupo (con stock o sin stock),
            // ordenar numéricamente desc si aplica a esta categoría
            if (usaOrdenNumerico) {
                const numA = extraerNumero(a.nombre);
                const numB = extraerNumero(b.nombre);
                if (numA !== numB) return numA - numB; // menor → mayor
            }

            // Regla 3: desempate alfabético
            return (a.nombre || "").localeCompare(b.nombre || "", "es");
        });
    };

    const productosPorCategoria = useMemo(() => {
        const mapped = categorias
            .map((cat) => ({
                ...cat,
                productos: ordenarProductos(
                    productosFiltrados.filter((p) => p.categoria_id === cat.id),
                    cat.nombre,
                ),
            }))
            .filter((cat) => {
                if (busqueda) return cat.productos.length > 0;
                return true; // admin ve categorías vacías también
            });

        return ordenarCategorias(mapped);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [categorias, productosFiltrados, busqueda]);

    /* ── Accordion toggle ── */
    const toggleCategoria = (id) => {
        setCategoriasAbiertas((prev) => {
            const nuevo = new Set(prev);
            if (nuevo.has(id)) nuevo.delete(id);
            else nuevo.add(id);
            return nuevo;
        });
    };

    const expandirTodas = () =>
        setCategoriasAbiertas(new Set(categorias.map((c) => c.id)));
    const colapsarTodas = () => setCategoriasAbiertas(new Set());

    /* ── Eliminar Producto ── */
    const handleEliminarProducto = async () => {
        if (!confirmarProd) return;
        setEliminandoProd(true);
        const { error } = await supabase
            .from("productos")
            .delete()
            .eq("id", confirmarProd.id);
        setEliminandoProd(false);
        if (error) {
            alert("Error al eliminar producto: " + error.message);
            return;
        }
        setConfirmarProd(null);
        cargarDatos();
    };

    /* ── Eliminar Categoría ── */
    const handleEliminarCategoria = async () => {
        if (!confirmarCat) return;
        setEliminandoCat(true);
        const { error } = await supabase
            .from("categorias")
            .delete()
            .eq("id", confirmarCat.id);
        setEliminandoCat(false);
        if (error) {
            alert("Error al eliminar categoría: " + error.message);
            return;
        }
        setConfirmarCat(null);
        cargarDatos();
    };

    const abrirEditarCategoria = (e, cat) => {
        e.stopPropagation(); // no toggle el acordeón
        setCatSeleccionada(cat);
        setCatModalModo("editar");
    };

    const abrirEliminarCategoria = (e, cat) => {
        e.stopPropagation();
        setConfirmarCat(cat);
    };

    /* ── Render ── */
    if (cargando) {
        return (
            <div
                className="d-flex flex-column align-items-center justify-content-center"
                style={{ minHeight: "60vh" }}
            >
                <div
                    className="spinner-border text-primary mb-3"
                    style={{ width: "3rem", height: "3rem" }}
                    role="status"
                >
                    <span className="visually-hidden">Cargando...</span>
                </div>
                <p className="text-muted">Cargando productos...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container-fluid py-4">
                <div
                    className="alert alert-danger d-flex align-items-start gap-3"
                    role="alert"
                >
                    <i className="bi bi-wifi-off fs-4 mt-1"></i>
                    <div>
                        <strong>Error de conexión</strong>
                        <p className="mb-1 mt-1">{error}</p>
                        <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={cargarDatos}
                        >
                            <i className="bi bi-arrow-clockwise me-1"></i>{" "}
                            Reintentar
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="container-fluid py-3 px-3 px-md-4"
            id="seccion-productos"
        >
            {/* ── Barra de búsqueda y controles ── */}
            <div className="row g-2 mb-4 align-items-center">
                <div className="col-12 col-md-6 col-lg-5">
                    <div className="input-group shadow-sm">
                        <span className="input-group-text bg-white border-end-0">
                            <i className="bi bi-search text-muted"></i>
                        </span>
                        <input
                            id="input-busqueda"
                            type="search"
                            className="form-control border-start-0 ps-0"
                            placeholder="Buscar productos por nombre..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            aria-label="Buscar productos"
                        />
                        {busqueda && (
                            <button
                                className="btn btn-outline-secondary border-start-0"
                                type="button"
                                onClick={() => setBusqueda("")}
                                title="Limpiar búsqueda"
                            >
                                <i className="bi bi-x-lg"></i>
                            </button>
                        )}
                    </div>
                </div>

                <div className="col-12 col-md-auto ms-md-auto d-flex gap-2 flex-wrap justify-content-end">
                    {/* Botón Nueva Categoría (solo admin) */}
                    {esAdmin && (
                        <button
                            id="btn-nueva-categoria"
                            className="btn btn-outline-success btn-sm d-flex align-items-center gap-1"
                            onClick={() => {
                                setCatSeleccionada(null);
                                setCatModalModo("crear");
                            }}
                            title="Crear nueva categoría"
                        >
                            <i className="bi bi-folder-plus"></i>
                            <span className="d-none d-sm-inline">
                                Nueva Categoría
                            </span>
                        </button>
                    )}

                    <button
                        id="btn-expandir-todas"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={expandirTodas}
                        title="Expandir todas las categorías"
                    >
                        <i className="bi bi-chevron-double-down me-1"></i>
                        <span className="d-none d-sm-inline">Expandir</span>
                    </button>
                    <button
                        id="btn-colapsar-todas"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={colapsarTodas}
                        title="Colapsar todas las categorías"
                    >
                        <i className="bi bi-chevron-double-up me-1"></i>
                        <span className="d-none d-sm-inline">Colapsar</span>
                    </button>
                    <button
                        id="btn-recargar"
                        className="btn btn-outline-primary btn-sm"
                        onClick={cargarDatos}
                        title="Recargar"
                    >
                        <i className="bi bi-arrow-clockwise"></i>
                    </button>
                </div>
            </div>

            {/* Resultado de búsqueda */}
            {busqueda && (
                <p className="text-muted small mb-3">
                    <i className="bi bi-funnel me-1"></i>
                    {productosFiltrados.length === 0
                        ? `Sin resultados para "${busqueda}"`
                        : `${productosFiltrados.length} resultado(s) para "${busqueda}"`}
                </p>
            )}

            {/* ── Sin datos ── */}
            {productosPorCategoria.length === 0 && (
                <div className="text-center py-5">
                    <i
                        className="bi bi-inbox text-muted"
                        style={{ fontSize: "3rem" }}
                    ></i>
                    <p className="text-muted mt-3">
                        {busqueda
                            ? "No se encontraron productos con ese nombre."
                            : "No hay categorías registradas. Crea una para empezar."}
                    </p>
                    {esAdmin && !busqueda && (
                        <button
                            className="btn btn-success mt-2"
                            onClick={() => {
                                setCatSeleccionada(null);
                                setCatModalModo("crear");
                            }}
                        >
                            <i className="bi bi-folder-plus me-1"></i> Crear
                            primera categoría
                        </button>
                    )}
                </div>
            )}

            {/* ── Acordeón de categorías ── */}
            <div className="accordion-categorias">
                {productosPorCategoria.map((cat) => {
                    const abierto = categoriasAbiertas.has(cat.id);
                    return (
                        <div key={cat.id} className="categoria-seccion mb-4">
                            {/* Header del acordeón */}
                            <div
                                className={`accordion-cat-btn w-100 d-flex align-items-center gap-3 mb-3 ${abierto ? "abierto" : ""}`}
                            >
                                {/* Zona clickeable para toggle */}
                                <button
                                    id={`accordion-btn-${cat.id}`}
                                    className="accordion-cat-inner flex-grow-1 d-flex align-items-center gap-2 bg-transparent border-0 p-0 text-start"
                                    onClick={() => toggleCategoria(cat.id)}
                                    aria-expanded={abierto}
                                    aria-controls={`accordion-panel-${cat.id}`}
                                >
                                    <i
                                        className={`bi ${getCategoryIcon(cat.nombre)} text-primary`}
                                    ></i>
                                    <span className="fw-bold fs-6">
                                        {cat.nombre}
                                    </span>
                                    <span
                                        className="badge bg-primary rounded-pill"
                                        style={{ fontSize: "0.7rem" }}
                                    >
                                        {cat.productos.length}
                                    </span>
                                    <i
                                        className={`bi bi-chevron-${abierto ? "up" : "down"} text-muted ms-1`}
                                    ></i>
                                </button>

                                {/* Botones de edición de categoría (solo admin) */}
                                {esAdmin && (
                                    <div className="cat-admin-btns d-flex gap-1 flex-shrink-0">
                                        <button
                                            id={`btn-editar-cat-${cat.id}`}
                                            className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                                            onClick={(e) =>
                                                abrirEditarCategoria(e, cat)
                                            }
                                            title={`Editar categoría "${cat.nombre}"`}
                                        >
                                            <i className="bi bi-pencil"></i>
                                            <span className="d-none d-md-inline">
                                                Editar
                                            </span>
                                        </button>
                                        <button
                                            id={`btn-eliminar-cat-${cat.id}`}
                                            className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1"
                                            onClick={(e) =>
                                                abrirEliminarCategoria(e, cat)
                                            }
                                            title={`Eliminar categoría "${cat.nombre}"`}
                                        >
                                            <i className="bi bi-trash3"></i>
                                            <span className="d-none d-md-inline">
                                                Eliminar
                                            </span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Panel de productos */}
                            {abierto && (
                                <div
                                    id={`accordion-panel-${cat.id}`}
                                    className="accordion-panel"
                                >
                                    {cat.descripcion && (
                                        <p className="text-muted small mb-3 ps-1">
                                            {cat.descripcion}
                                        </p>
                                    )}
                                    {cat.productos.length === 0 ? (
                                        <div className="text-center py-4 text-muted">
                                            <i className="bi bi-box-seam fs-4 d-block mb-2"></i>
                                            <small>
                                                Esta categoría no tiene
                                                productos aún.
                                            </small>
                                        </div>
                                    ) : (
                                        <div className="row g-3 row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-xl-5">
                                            {cat.productos.map((prod) => (
                                                <div
                                                    key={prod.id}
                                                    className="col"
                                                >
                                                    <ProductCard
                                                        producto={prod}
                                                        categoriaNombre={
                                                            cat.nombre
                                                        }
                                                        onVer={setModalVer}
                                                        onEditar={
                                                            setModalEditar
                                                        }
                                                        onEliminar={
                                                            setConfirmarProd
                                                        }
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ══════════════════════════════════
          MODALES DE PRODUCTOS
          ══════════════════════════════════ */}
            <ProductModal
                visible={!!modalVer}
                modo="ver"
                producto={modalVer}
                categorias={categorias}
                onCerrar={() => setModalVer(null)}
                onGuardado={cargarDatos}
            />

            <ProductModal
                visible={!!modalEditar}
                modo="editar"
                producto={modalEditar}
                categorias={categorias}
                onCerrar={() => setModalEditar(null)}
                onGuardado={cargarDatos}
            />

            <ProductModal
                visible={modalCrear}
                modo="crear"
                producto={null}
                categorias={categorias}
                onCerrar={onCerrarCrear}
                onGuardado={() => {
                    cargarDatos();
                    onCerrarCrear();
                }}
            />

            <ConfirmModal
                visible={!!confirmarProd}
                titulo="¿Eliminar producto?"
                mensaje={`¿Estás seguro de que deseas eliminar "${confirmarProd?.nombre}"? Esta acción no se puede deshacer.`}
                onConfirmar={handleEliminarProducto}
                onCancelar={() => setConfirmarProd(null)}
                cargando={eliminandoProd}
            />

            {/* ══════════════════════════════════
          MODALES DE CATEGORÍAS
          ══════════════════════════════════ */}
            <CategoryModal
                visible={catModalModo === "crear" || catModalModo === "editar"}
                modo={catModalModo || "crear"}
                categoria={catSeleccionada}
                onCerrar={() => {
                    setCatModalModo(null);
                    setCatSeleccionada(null);
                }}
                onGuardado={cargarDatos}
            />

            <ConfirmModal
                visible={!!confirmarCat}
                titulo="¿Eliminar categoría?"
                mensaje={`¿Estás seguro de que deseas eliminar la categoría "${confirmarCat?.nombre}"?\n\n⚠️ ADVERTENCIA: todos los productos dentro de esta categoría también serán eliminados permanentemente.`}
                onConfirmar={handleEliminarCategoria}
                onCancelar={() => setConfirmarCat(null)}
                cargando={eliminandoCat}
            />
        </div>
    );
}

export default ProductList;
