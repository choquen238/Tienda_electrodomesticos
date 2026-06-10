import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

function Login() {
  const { login } = useAuth();
  const [username, setUsername]     = useState('');
  const [password, setPassword]     = useState('');
  const [error, setError]           = useState('');
  const [cargando, setCargando]     = useState(false);
  const [mostrarPass, setMostrarPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    const resultado = await login(username, password);
    setCargando(false);
    if (!resultado.ok) {
      setError(resultado.error);
    }
    // Si ok, AuthContext actualiza `usuario` y App.js renderiza el dashboard
  };

  return (
    <div className="login-wrapper d-flex align-items-center justify-content-center min-vh-100">
      <div className="login-card card shadow-lg p-4 p-md-5">
        {/* Logo / cabecera */}
        <div className="text-center mb-4">
          <div className="login-icon mb-3">
            <i className="bi bi-plug-fill"></i>
          </div>
          <h1 className="h3 fw-bold text-primary mb-1">TiendaElectro</h1>
          <p className="text-muted small">Inicia sesión para continuar</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} noValidate id="form-login">
          <div className="mb-3">
            <label htmlFor="input-username" className="form-label fw-semibold">
              Usuario
            </label>
            <div className="input-group">
              <span className="input-group-text bg-light border-end-0">
                <i className="bi bi-person"></i>
              </span>
              <input
                id="input-username"
                type="text"
                className="form-control border-start-0 ps-0"
                placeholder="Tu nombre de usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                disabled={cargando}
              />
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="input-password" className="form-label fw-semibold">
              Contraseña
            </label>
            <div className="input-group">
              <span className="input-group-text bg-light border-end-0">
                <i className="bi bi-lock"></i>
              </span>
              <input
                id="input-password"
                type={mostrarPass ? 'text' : 'password'}
                className="form-control border-start-0 border-end-0 ps-0"
                placeholder="Tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                disabled={cargando}
              />
              <button
                type="button"
                className="input-group-text bg-light border-start-0 btn-toggle-pass"
                onClick={() => setMostrarPass(!mostrarPass)}
                tabIndex="-1"
                aria-label="Mostrar/ocultar contraseña"
              >
                <i className={`bi ${mostrarPass ? 'bi-eye-slash' : 'bi-eye'}`}></i>
              </button>
            </div>
          </div>

          {error && (
            <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2" role="alert">
              <i className="bi bi-exclamation-triangle-fill"></i>
              {error}
            </div>
          )}

          <button
            id="btn-login-submit"
            type="submit"
            className="btn btn-primary w-100 py-2 fw-semibold mt-1"
            disabled={cargando}
          >
            {cargando ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Ingresando...
              </>
            ) : (
              <>
                <i className="bi bi-box-arrow-in-right me-2"></i>
                Ingresar
              </>
            )}
          </button>
        </form>

        <p className="text-center text-muted small mt-4 mb-0">
          <i className="bi bi-shield-lock me-1"></i>
          Acceso restringido. Solo personal autorizado.
        </p>
      </div>
    </div>
  );
}

export default Login;
