# 🏪 TiendaElectro — Sistema de Gestión de Electrodomésticos

Aplicación web para la visualización y administración del catálogo de productos de una tienda de electrodomésticos. Desarrollada con **React**, respaldada por **Supabase** como base de datos y almacenamiento, y desplegada en **Vercel**.

---

## 📌 Tabla de Contenidos

1. [Descripción General](#descripción-general)
2. [Tecnologías Utilizadas](#tecnologías-utilizadas)
3. [Estructura del Proyecto](#estructura-del-proyecto)
4. [Base de Datos (Supabase)](#base-de-datos-supabase)
5. [Autenticación y Roles](#autenticación-y-roles)
6. [Funcionalidades por Rol](#funcionalidades-por-rol)
7. [Componentes React](#componentes-react)
8. [Sistema de Precios](#sistema-de-precios)
9. [Imágenes de Productos](#imágenes-de-productos)
10. [Editor de Recorte de Imágenes](#editor-de-recorte-de-imágenes)
11. [Botón Volver al Inicio](#botón-volver-al-inicio)
12. [Despliegue en Vercel](#despliegue-en-vercel)
13. [Variables de Entorno](#variables-de-entorno)
14. [Configuración Inicial](#configuración-inicial)

---

## Descripción General

**TiendaElectro** es una SPA (Single Page Application) que permite a una tienda de electrodomésticos gestionar su catálogo de productos de forma visual y organizada. El sistema diferencia entre dos tipos de usuario:

- **Administrador**: acceso completo para crear, editar y eliminar productos y categorías.
- **Visitante**: acceso de solo lectura para consultar el catálogo.

Ambos roles pueden navegar el catálogo, filtrar productos y consultar precios (con lógica de revelación progresiva para el precio base).

---

## Tecnologías Utilizadas

| Tecnología               | Versión                    | Propósito                                      |
| ------------------------ | -------------------------- | ---------------------------------------------- |
| **React**                | 19.x                       | Framework principal de la UI                   |
| **Create React App**     | 5.x                        | Bundler y configuración de desarrollo          |
| **Supabase**             | `@supabase/supabase-js ^2` | Base de datos PostgreSQL + Storage de imágenes |
| **bcryptjs**             | `^3.0`                     | Hash y verificación de contraseñas             |
| **Bootstrap 5**          | CDN                        | Sistema de grilla y componentes UI             |
| **Bootstrap Icons**      | CDN                        | Iconografía (incluyendo íconos de categorías)  |
| **Google Fonts (Inter)** | CDN                        | Tipografía principal                           |
| **Vercel**               | —                          | Hosting y despliegue continuo                  |

---

## Estructura del Proyecto

```
tienda_v1.0/
├── public/
│   └── index.html              # HTML base con CDNs de Bootstrap e Inter
├── src/
│   ├── App.js                  # Componente raíz: routing entre Login y Dashboard
│   ├── App.css                 # Estilos personalizados (variables, cards, precios, etc.)
│   ├── index.js                # Punto de entrada de React
│   ├── index.css               # Reset global mínimo
│   ├── context/
│   │   └── AuthContext.js      # Contexto global de autenticación
│   ├── lib/
│   │   └── supabaseClient.js   # Cliente de Supabase configurado con variables de entorno
│   └── components/
│       ├── Login.js            # Formulario de inicio de sesión
│       ├── Navbar.js           # Barra de navegación superior
│       ├── ProductList.js      # Vista principal: acordeón de categorías + buscador
│       ├── ProductCard.js      # Tarjeta individual de producto
│       ├── ProductModal.js     # Modal para ver / crear / editar producto
│       ├── CategoryModal.js    # Modal para crear / editar categoría
│       ├── ConfirmModal.js     # Modal de confirmación genérico (eliminar)
│       ├── ImageUploader.js    # Orquesta la selección de archivo y apertura del editor
│       └── ImageCropEditor.js  # Editor de recorte/rotación de imagen (Canvas API)
├── .env                        # Variables de entorno locales (no versionado)
├── .env.example                # Plantilla de variables de entorno
├── vercel.json                 # Configuración de Vercel (SPA routing)
└── package.json                # Dependencias y scripts del proyecto
```

---

## Base de Datos (Supabase)

El proyecto usa **PostgreSQL** gestionado por Supabase. Las tablas son:

### Tabla `usuarios`

Almacena los usuarios del sistema con autenticación propia (no usa Supabase Auth).

```sql
CREATE TABLE usuarios (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,       -- bcrypt hash (o texto plano migrado automáticamente)
  rol           VARCHAR(20) DEFAULT 'visitante', -- 'admin' | 'visitante'
  estado        BOOLEAN DEFAULT TRUE,            -- false = cuenta desactivada
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

> **Nota sobre contraseñas:** el sistema soporta contraseñas en texto plano y hashes bcrypt. La primera vez que un usuario con contraseña en texto plano inicia sesión, el sistema la migra automáticamente a hash bcrypt sin intervención manual.

### Tabla `categorias`

```sql
CREATE TABLE categorias (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(50) UNIQUE NOT NULL,
  descripcion TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

Categorías de ejemplo incluidas: `Refrigeración`, `Lavandería`, `Cocina`, `Climatización`, `Pequeños Electro`.

### Tabla `productos`

```sql
CREATE TABLE productos (
  id               SERIAL PRIMARY KEY,
  nombre           VARCHAR(100) NOT NULL,
  descripcion      TEXT,
  precio_base      NUMERIC(12,2) NOT NULL,    -- precio de costo/mayorista
  precio_sugerido  NUMERIC(12,2) NOT NULL,    -- precio de venta al público
  stock            INTEGER DEFAULT 0,
  imagen_url       TEXT,                      -- URL pública en Supabase Storage
  categoria_id     INTEGER REFERENCES categorias(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
```

> El `ON DELETE CASCADE` en `categoria_id` significa que **al eliminar una categoría, todos sus productos también se eliminan**.

### Storage

- **Bucket:** `productos-imagenes` (público)
- **Ruta de archivos:** `productos/{timestamp}-{random}.{ext}`
- Las políticas RLS deben permitir INSERT/SELECT/UPDATE/DELETE al rol `anon` (ver sección de configuración).

---

## Autenticación y Roles

El sistema **no usa Supabase Auth**. Implementa autenticación propia mediante:

1. El usuario ingresa `username` y `password` en el formulario de login.
2. Se consulta la tabla `usuarios` buscando el username.
3. Se verifica la contraseña:
    - Si el campo `password_hash` es un hash bcrypt válido (empieza con `$2a$`, `$2b$` o `$2y$`) → se usa `bcrypt.compare()`.
    - Si es texto plano → se compara directamente y se migra a bcrypt automáticamente.
4. La sesión se guarda en `localStorage` como un objeto JSON `{ id, username, rol }`.
5. Al recargar la página, la sesión se recupera desde `localStorage` sin necesidad de re-autenticarse.

### Roles disponibles

| Rol         | Descripción                                   |
| ----------- | --------------------------------------------- |
| `admin`     | Control total: CRUD de productos y categorías |
| `visitante` | Solo lectura: ver catálogo y precios          |

---

## Funcionalidades por Rol

### 🔐 Comunes (admin + visitante)

- **Login** con username y contraseña.
- **Ver catálogo** organizado en acordeón por categorías.
- **Buscar productos** por nombre con filtro en tiempo real.
- **Expandir / Colapsar** todas las categorías a la vez.
- **Ver detalle** de cualquier producto (modal con imagen, descripción, stock y precios).
- **Precio sugerido** siempre visible en las tarjetas.
- **Precio base** oculto por defecto — se revela haciendo clic en el contenedor ámbar.
- **Logout** desde la barra de navegación.

### 🛠️ Solo Admin

- **Crear producto**: formulario completo con nombre, descripción, precios, stock, categoría e imagen.
- **Editar producto**: mismos campos, pre-cargados con datos existentes.
- **Eliminar producto**: con modal de confirmación.
- **Crear categoría**: nombre y descripción opcional.
- **Editar categoría**: modificar nombre o descripción.
- **Eliminar categoría**: con advertencia de que se eliminarán todos los productos asociados.
- **Subir imágenes**: se abre el editor de recorte antes de subir a Supabase Storage.
- **Recortar imagen**: selección libre del área de recorte con handles arrastrables (mouse y touch).
- **Rotar imagen**: botones de rotación 90° izquierda / 90° derecha para corregir fotos giradas.

---

## Componentes React

### `AuthContext.js`

Contexto global que provee `{ usuario, esAdmin, cargando, login, logout }` a toda la app. Gestiona la sesión en `localStorage` y la lógica de verificación de contraseñas (bcrypt + texto plano).

### `Login.js`

Formulario de autenticación con campos de usuario y contraseña, toggle de visibilidad de contraseña y mensajes de error en línea.

### `Navbar.js`

Barra superior fija que muestra:

- Logo / nombre de la tienda.
- Badge de rol del usuario (Admin / Visitante).
- Botón **"Nuevo Producto"** (solo admin).
- Botón de logout.

### `ProductList.js`

Componente principal del dashboard. Incluye:

- Input de búsqueda con limpieza instantánea.
- Botones de expandir/colapsar todas las categorías.
- Botón **"Nueva Categoría"** (solo admin) en la barra de controles.
- Acordeón de categorías con **icono automático por nombre** (refrigeración, cocina, lavandería, etc.).
- Botones de Editar/Eliminar categoría en el header de cada acordeón (solo admin).
- Grid de tarjetas de productos dentro de cada categoría.
- Categorías vacías visibles para admin (con mensaje orientativo).

### `ProductCard.js`

Tarjeta individual de producto con:

- Imagen con detección automática de orientación (vertical/horizontal) — ajusta el alto del contenedor al ratio real de la imagen usando `onLoad`.
- Botón **Ver** en esquina superior derecha (azul sólido, siempre visible).
- Columna de botones admin (Editar + Eliminar) en esquina superior izquierda — visibles al hover en desktop, siempre visibles en móvil.
- Precio sugerido siempre visible (verde).
- Precio base oculto por defecto, revelable al hacer clic en el contenedor ámbar.

### `ProductModal.js`

Modal polivalente con tres modos:

- **Ver**: imagen grande, descripción, precios (sugerido siempre visible, base revelable), stock.
- **Crear**: formulario completo con validación.
- **Editar**: formulario pre-cargado con datos del producto.

### `CategoryModal.js`

Modal para crear o editar una categoría. Valida nombre único (maneja el error `23505` de Supabase), muestra contador de caracteres y bloquea scroll mientras está abierto.

### `ConfirmModal.js`

Modal reutilizable de confirmación. Se usa para eliminar productos (mensaje simple) y categorías (mensaje con advertencia de borrado en cascada).

### `ImageUploader.js`

Orquesta la selección de imagen y apertura del editor de recorte:

- Acepta todos los formatos comunes: JPG, JPEG, PNG, WebP, GIF, BMP, TIFF, SVG, AVIF, HEIC/HEIF.
- Usa `accept="image/*"` en el input + validación real por MIME type en JavaScript.
- Infiere el tipo por extensión cuando el navegador no reporta MIME type (ej: HEIC en Windows).
- **Al seleccionar un archivo, abre el `ImageCropEditor` en lugar de subir directamente.**
- Tras confirmar el recorte, sube el Blob WebP resultante a Supabase Storage.
- Sube bajo `productos/{timestamp}-{random}.webp`.
- Muestra preview inmediato del resultado recortado.
- Permite quitar la imagen actual.
- Límite de tamaño: **15 MB** (aumentado para fotos de cámara sin comprimir).

### `ImageCropEditor.js`

Editor de recorte e imagen client-side, **sin dependencias externas**. Usa la Canvas API del navegador.

**Funcionalidades:**

- **Recorte libre**: un rectángulo de selección con 8 handles (4 esquinas + 4 lados) que el usuario puede arrastrar para definir exactamente qué parte de la imagen conservar.
- **Mover el área**: arrastrando el interior del rectángulo se desplaza sin cambiar el tamaño.
- **Rotación**: botones de 90° izquierda / 90° derecha, aplicables múltiples veces. Útil para fotos de cámara que salen giradas.
- **Guías de composición**: líneas de tercios superpuestas dentro del área de recorte.
- **Overlay oscuro**: la zona fuera del recorte se oscurece para visualizar claramente el área seleccionada.
- **Touch/móvil**: todos los gestos de arrastre funcionan con eventos táctiles (`touchstart`, `touchmove`, `touchend`).
- **Exportación WebP**: `canvas.toBlob('image/webp', 0.92)` → imagen optimizada lista para subir.

---

## Sistema de Precios

El diseño deliberado de precios en el catálogo es el siguiente:

| Precio       | Color                | Visibilidad         | Acción                             |
| ------------ | -------------------- | ------------------- | ---------------------------------- |
| **Sugerido** | 🟢 Verde (`#059669`) | **Siempre visible** | —                                  |
| **Base**     | 🟡 Ámbar (`#d97706`) | Oculto (`••••••`)   | Clic en el contenedor para revelar |

**Razón del diseño:** el precio sugerido (precio de venta al público) puede ser visto por cualquier visitante. El precio base (precio de costo/mayorista) es más sensible y se oculta para evitar que sea visible a simple vista, aunque cualquier usuario puede revelarlo con un clic.

Al abrir el modal "Ver" de un producto, el precio base se vuelve a ocultar (el estado se resetea).

---

## Imágenes de Productos

### Adaptación automática de orientación

Las tarjetas de producto adaptan su altura automáticamente según las dimensiones reales de cada imagen:

```
ratio = (alto natural / ancho natural) × 100  →  padding-top del contenedor

Rango permitido: 68% (panorámica) — 125% (retrato)
Valor por defecto: 75% (mientras carga)
```

Esto evita que imágenes verticales (ej: nevera de frente) aparezcan recortadas o empequeñecidas dentro de un contenedor horizontal fijo.

Las imágenes usan `object-fit: contain` con `padding: 4px` para mostrar la imagen completa sin recortes, con un fondo gris suave (`#f1f5f9`) en los espacios vacíos.

---

## Editor de Recorte de Imágenes

Cuando el admin selecciona una imagen para un producto, **se abre automáticamente el editor de recorte** antes de subir al servidor.

### ¿Por qué?

Al fotografiar productos con el celular, habitualmente:

- Aparecen fondos o elementos no deseados en la foto.
- La foto queda rotada (portrait vs. landscape) dependiendo de la orientación del dispositivo.

El editor permite corregir ambas cosas directamente desde la app, sin herramientas externas.

### Flujo de uso

```
1. Admin hace clic en el campo de imagen en el formulario.
2. Selecciona la foto desde el dispositivo (galería o cámara).
3. Se abre el editor con la imagen centrada y un área de recorte inicial.
4. [Opcional] Toca ↺ o ↻ para rotar la imagen de a 90°.
5. Arrastra los puntos ámbar para ajustar el área de recorte.
6. Arrastra el interior del rectángulo para mover el recorte.
7. Toca "Usar imagen recortada".
8. La imagen recortada se sube automáticamente como WebP a Supabase Storage.
```

### Tecnología

| Aspecto              | Detalle                                                             |
| -------------------- | ------------------------------------------------------------------- |
| Implementación       | Canvas API (`CanvasRenderingContext2D`)                             |
| Dependencias npm     | **Ninguna** — solo APIs nativas del navegador                       |
| Formato de salida    | WebP (calidad 0.92) — menor peso que JPEG con igual o mejor calidad |
| Compatibilidad input | Mouse (desktop) + Touch (móvil/tablet)                              |
| Handles de recorte   | 8 puntos: 4 esquinas + 4 lados                                      |
| Rotación             | 90° izquierda / 90° derecha, múltiples veces                        |
| Guías                | Líneas de tercios superpuestas                                      |

---

## Botón Volver al Inicio

Cuando el usuario hace scroll hacia abajo (más de 300 px), aparece un **botón flotante circular** en la esquina inferior derecha con una flecha hacia arriba.

- **Color ámbar/naranja** — diferente al azul primario de la app para distinguirlo fácilmente.
- Al hacer clic, ejecuta `window.scrollTo({ top: 0, behavior: 'smooth' })` para un retorno suave.
- Se oculta automáticamente cuando se está en la parte superior.
- Funciona en desktop y móvil.
- Implementado en `App.js` con `useState` + `useEffect` que escucha el evento `scroll`.

---

## Iconos de Categorías

Las categorías muestran automáticamente un ícono de Bootstrap Icons basado en palabras clave en su nombre:

| Palabras clave                               | Ícono                    |
| -------------------------------------------- | ------------------------ |
| refriger, nevera, congel, frío               | ❄ `bi-thermometer-snow`  |
| lavar, lavand, secar, lavadora               | 💧 `bi-droplet-half`     |
| cocin, horno, microon, estufa                | 🔥 `bi-fire`             |
| climat, aire, ventil, calef                  | 🌬 `bi-wind`             |
| pequeñ, tostador, cafetera, plancha, electro | 🔌 `bi-plug-fill`        |
| tv, telev, entret, audio, sonido             | 📺 `bi-tv`               |
| comput, laptop, tecnol, inform               | 💻 `bi-laptop`           |
| iluminac, luz, lámpara, foco                 | 💡 `bi-lightbulb`        |
| aspira, limpiez                              | 🤖 `bi-robot`            |
| segur, cámara, alarm                         | 🛡 `bi-shield-check`     |
| Cualquier otra                               | ▦ `bi-grid-3x3-gap-fill` |

---

## Despliegue en Vercel

El archivo `vercel.json` configura el enrutamiento para que funcione correctamente como SPA:

```json
{
    "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Pasos para desplegar

1. Hacer push del código a GitHub (el `.env` está en `.gitignore` y **no se sube**).
2. Ir a [vercel.com](https://vercel.com) → **Add New Project** → importar el repositorio.
3. En la pantalla de configuración, agregar las **variables de entorno** (ver siguiente sección).
4. Hacer clic en **Deploy**.

Cada nuevo `git push` redespliega automáticamente.

---

## Variables de Entorno

El proyecto requiere dos variables de entorno de Supabase. Deben configurarse tanto en el archivo `.env` local como en el panel de Vercel:

```env
REACT_APP_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGci...
```

> ⚠️ **NUNCA** subir el archivo `.env` a GitHub. Está excluido por `.gitignore`.

El archivo `.env.example` sirve como plantilla:

```env
REACT_APP_SUPABASE_URL=
REACT_APP_SUPABASE_ANON_KEY=
```

---

## Configuración Inicial

Para que el sistema funcione desde cero en un nuevo proyecto de Supabase:

### 1. Ejecutar el script SQL

En **Supabase → SQL Editor**, ejecutar el script de base de datos que crea las tablas `usuarios`, `categorias` y `productos` con sus índices, RLS habilitado y datos de ejemplo.

### 2. Crear el bucket de Storage

En **Supabase → Storage**, crear un bucket llamado exactamente `productos-imagenes` y marcarlo como **público**.

### 3. Configurar políticas de Storage

Ejecutar en SQL Editor (necesario porque el sistema usa autenticación propia, no Supabase Auth):

```sql
-- Lectura pública
CREATE POLICY "storage_select_public" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'productos-imagenes');

-- Subida (admin de la app usa el rol anon)
CREATE POLICY "storage_insert_anon" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'productos-imagenes');

-- Actualización
CREATE POLICY "storage_update_anon" ON storage.objects
  FOR UPDATE TO anon
  USING (bucket_id = 'productos-imagenes');

-- Eliminación
CREATE POLICY "storage_delete_anon" ON storage.objects
  FOR DELETE TO anon
  USING (bucket_id = 'productos-imagenes');
```

### 4. Crear el primer usuario admin

```sql
INSERT INTO usuarios (username, password_hash, rol)
VALUES ('admin', 'tu_contraseña_aqui', 'admin');
```

> La contraseña puede ser texto plano. En el primer login, el sistema la migrará automáticamente a hash bcrypt.

### 5. Instalar dependencias y arrancar

```bash
npm install
npm start
```

---

## Comandos útiles

```bash
npm start        # Servidor de desarrollo en http://localhost:3000
npm run build    # Build de producción (para Vercel lo hace automáticamente)
npm test         # Ejecutar pruebas
```

---

_Proyecto desarrollado con React 19 + Supabase. Versión 1.0._| Con otros cambios
