import React, { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Payroll from './pages/Payroll';
import Admin from './pages/Admin';
import Settings from './pages/Settings';

const PrivateRoute = ({ children, adminOnly = false, superAdminOnly = false }: { children: ReactNode, adminOnly?: boolean, superAdminOnly?: boolean }) => {
  const { user, loading } = useAuth();

  // 1. On attend que l'AuthContext ait fini de récupérer le profil Supabase
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-600"></div>
          <p className="text-sm text-gray-500 animate-pulse">Vérification des droits...</p>
        </div>
      </div>
    );
  }

  // 2. Si non connecté -> Login
  if (!user) return <Navigate to="/login" replace />;
  
  // 3. LOGIQUE DE RESTRICTION (Stricte comme tu le souhaites)
  
  // Si la page demande Super Admin et qu'on ne l'est pas
  if (superAdminOnly && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // Si la page demande Admin (Level 1 ou Super) et qu'on n'est ni l'un ni l'autre
  const isAnyAdmin = user.role === 'admin' || user.role === 'admin_level_1';
  if (adminOnly && !isAnyAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="payroll" element={<PrivateRoute superAdminOnly><Payroll /></PrivateRoute>} />
            <Route path="admin" element={<PrivateRoute adminOnly><Admin /></PrivateRoute>} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
