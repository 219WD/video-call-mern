import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  
  console.log('🛡️ ProtectedRoute - isAuthenticated:', isAuthenticated, 'user:', user);
  
  if (!isAuthenticated) {
    console.log('🔒 Acceso DENEGADO, redirigiendo a /login');
    return <Navigate to="/login" replace />;
  }
  
  console.log('✅ Acceso PERMITIDO');
  return children;
};

export default ProtectedRoute;