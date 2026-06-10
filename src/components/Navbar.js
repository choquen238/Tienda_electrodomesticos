import React from 'react';
import { useAuth } from '../context/AuthContext';

function Navbar({ onNuevoProducto }) {
  const { usuario, esAdmin, logout } = useAuth();

  return (
    <nav className="navbar navbar-dark sticky-top shadow-sm" id="navbar-principal">
      <div className="container-fluid px-3 px-md-4">
        {/* Marca */}
        <a className="navbar-brand d-flex align-items-center gap-2 fw-bold" href="#inicio">
          <i className="bi bi-plug-fill text-warning fs-5"></i>
          <span>TiendaElectro</span>
        </a>

        {/* Acciones */}
        <div className="d-flex align-items-center gap-2 gap-md-3">
          {/* Badge de rol */}
          <span className={`badge rounded-pill ${esAdmin ? 'badge-admin' : 'badge-visitante'} d-none d-sm-inline-flex align-items-center gap-1`}>
            <i className={`bi ${esAdmin ? 'bi-shield-fill-check' : 'bi-eye-fill'} small`}></i>
            {esAdmin ? 'Admin' : 'Visitante'}
          </span>

          {/* Nombre de usuario */}
          <span className="text-white-50 small d-none d-md-inline">
            <i className="bi bi-person-circle me-1"></i>
            {usuario?.username}
          </span>

          {/* Botón nuevo producto (solo admin) */}
          {esAdmin && (
            <button
              id="btn-nuevo-producto"
              className="btn btn-warning btn-sm fw-semibold d-flex align-items-center gap-1"
              onClick={onNuevoProducto}
            >
              <i className="bi bi-plus-lg"></i>
              <span className="d-none d-sm-inline">Nuevo</span>
            </button>
          )}

          {/* Cerrar sesión */}
          <button
            id="btn-logout"
            className="btn btn-outline-light btn-sm d-flex align-items-center gap-1"
            onClick={logout}
            title="Cerrar sesión"
          >
            <i className="bi bi-box-arrow-right"></i>
            <span className="d-none d-sm-inline">Salir</span>
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
