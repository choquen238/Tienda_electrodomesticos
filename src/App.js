import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Navbar from './components/Navbar';
import ProductList from './components/ProductList';
import './App.css';

function AppContent() {
  const { usuario, cargando } = useAuth();
  const [modalCrear, setModalCrear] = useState(false);

  // Lógica del botón scroll-to-top (hooks SIEMPRE antes de cualquier return)
  const [mostrarScrollTop, setMostrarScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setMostrarScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const volverAlInicio = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Pantalla de carga inicial (recuperando sesión de localStorage)
  if (cargando) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100">
        <div className="text-center">
          <div className="spinner-border text-primary" style={{ width: '3rem', height: '3rem' }} role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
          <p className="mt-3 text-muted">Iniciando TiendaElectro...</p>
        </div>
      </div>
    );
  }

  // Sin sesión → Login
  if (!usuario) {
    return <Login />;
  }

  // Con sesión → Dashboard
  return (
    <>
      <Navbar onNuevoProducto={() => setModalCrear(true)} />
      <main id="main-content">
        <ProductList
          modalCrear={modalCrear}
          onCerrarCrear={() => setModalCrear(false)}
        />
      </main>

      {/* Botón flotante Volver al Inicio */}
      <button
        id="btn-scroll-top"
        className={`btn-scroll-top${mostrarScrollTop ? ' btn-scroll-top--visible' : ''}`}
        onClick={volverAlInicio}
        aria-label="Volver al inicio de la página"
        title="Volver al inicio"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
