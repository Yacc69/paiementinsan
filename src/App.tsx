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

  if (loading) return <div className="flex justify-center items-center h-screen">Chargement...</div>;
  if (!user) return <Navigate to="/login" />;
  
  if (superAdminOnly && user.role !== 'admin') return <Navigate to="/" />;
  if (adminOnly && user.role !== 'admin' && user.role !== 'admin_level_1') return <Navigate to="/" />;

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
