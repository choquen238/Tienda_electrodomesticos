import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import bcrypt from 'bcryptjs';
import supabase from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Al montar, recuperar sesión guardada en localStorage
  useEffect(() => {
    const sesionGuardada = localStorage.getItem('tienda_sesion');
    if (sesionGuardada) {
      try {
        const datos = JSON.parse(sesionGuardada);
        setUsuario(datos);
      } catch {
        localStorage.removeItem('tienda_sesion');
      }
    }
    setCargando(false);
  }, []);

  /**
   * Detecta si un string es un hash bcrypt válido.
   * Los hashes bcrypt siempre comienzan con $2a$, $2b$ o $2y$.
   */
  const esBcryptHash = (str) => /^\$2[aby]\$\d{2}\$/.test(str);

  /**
   * Inicia sesión. Soporta contraseñas en texto plano Y hashes bcrypt.
   * Si la contraseña está en texto plano y coincide, la migra automáticamente
   * a bcrypt en la base de datos para mayor seguridad.
   * Retorna { ok: true, usuario } o { ok: false, error: 'mensaje' }
   */
  const login = useCallback(async (username, password) => {
    if (!username || !password) {
      return { ok: false, error: 'Completa todos los campos.' };
    }

    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, username, password_hash, rol, estado')
        .eq('username', username.trim())
        .single();

      if (error || !data) {
        return { ok: false, error: 'Usuario no encontrado.' };
      }

      if (!data.estado) {
        return { ok: false, error: 'Tu cuenta está desactivada.' };
      }

      let coincide = false;
      const storedHash = data.password_hash;

      if (esBcryptHash(storedHash)) {
        // Contraseña ya hasheada con bcrypt → comparación segura
        coincide = await bcrypt.compare(password, storedHash);
      } else {
        // Contraseña en texto plano → comparación directa
        coincide = (password === storedHash);

        if (coincide) {
          // Migrar automáticamente a bcrypt para futuras sesiones
          try {
            const nuevoHash = await bcrypt.hash(password, 10);
            await supabase
              .from('usuarios')
              .update({ password_hash: nuevoHash })
              .eq('id', data.id);
            console.info(`[Auth] Contraseña de "${data.username}" migrada a bcrypt.`);
          } catch (migErr) {
            // La migración falla silenciosamente; el login sigue siendo exitoso
            console.warn('[Auth] No se pudo migrar la contraseña a bcrypt:', migErr.message);
          }
        }
      }

      if (!coincide) {
        return { ok: false, error: 'Contraseña incorrecta.' };
      }

      const sesion = { id: data.id, username: data.username, rol: data.rol };
      setUsuario(sesion);
      localStorage.setItem('tienda_sesion', JSON.stringify(sesion));
      return { ok: true, usuario: sesion };
    } catch (err) {
      console.error('Error en login:', err);
      return { ok: false, error: 'Error de conexión. Intenta de nuevo.' };
    }
  }, []);

  /**
   * Cierra la sesión del usuario.
   */
  const logout = useCallback(() => {
    setUsuario(null);
    localStorage.removeItem('tienda_sesion');
  }, []);

  /**
   * Verifica si el usuario actual es admin.
   */
  const esAdmin = usuario?.rol === 'admin';

  return (
    <AuthContext.Provider value={{ usuario, esAdmin, cargando, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook para consumir el contexto de autenticación.
 * Uso: const { usuario, esAdmin, login, logout } = useAuth();
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}

export default AuthContext;
