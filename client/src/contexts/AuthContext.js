import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🔄 AuthProvider montándose...');
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    console.log('📦 Token en localStorage:', token);
    console.log('📦 UserData en localStorage:', userData);
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        console.log('✅ Usuario cargado desde localStorage:', parsedUser);
        setUser(parsedUser);
      } catch (error) {
        console.error('❌ Error parseando userData:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    } else {
      console.log('❌ No hay usuario en localStorage');
    }
    setLoading(false);
  }, []);

  const login = (token, userData) => {
    console.log('🔑 Ejecutando login con:', userData);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    console.log('✅ Login completado, user establecido:', userData);
  };

  const logout = () => {
    console.log('🚪 Ejecutando logout');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const value = {
    user,
    login,
    logout,
    isAuthenticated: !!user
  };

  console.log('🎯 AuthProvider render - user:', user, 'isAuthenticated:', !!user, 'loading:', loading);

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};