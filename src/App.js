import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Navbar from './components/Navbar';
import ProductList from './components/ProductList';
import './App.css';

function AppContent() {
  const { usuario, cargando } = useAuth();
  const [modalCrear, setModalCrear] = useState(false);

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
