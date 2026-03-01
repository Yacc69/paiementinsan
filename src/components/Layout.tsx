import React from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Receipt, Users, LogOut, Settings } from 'lucide-react';
import { NotificationBell } from './NotificationBell';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Tableau de bord', path: '/', icon: LayoutDashboard },
    { name: 'Dépenses', path: '/expenses', icon: Receipt },
  ];

  if (user?.role === 'admin') {
    navItems.push({ name: 'Masse Salariale', path: '/payroll', icon: Users });
  }

  if (user?.role === 'admin' || user?.role === 'admin_level_1') {
    navItems.push({ name: 'Administration', path: '/admin', icon: Settings });
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold text-gray-900">FinManage</h1>
        </div>

        {/* Menu de navigation */}
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className={`mr-3 h-5 w-5 ${isActive ? 'text-blue-700' : 'text-gray-400'}`} />
                {item.name}
              </Link>
            );
          })}

          {/* --- NOUVELLE POSITION : JUSTE SOUS LE DERNIER ITEM --- */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="px-3 mb-2">
              <p className="text-[10px] font-uppercase font-bold text-gray-400 tracking-wider uppercase">
                Session Utilisateur
              </p>
            </div>
            
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg shadow-sm border border-gray-100">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-900 truncate">{user?.email}</p>
                <p className="text-[10px] text-gray-500 truncate capitalize">{user?.role}</p>
              </div>
              
              <div className="flex items-center gap-1">
                {/* La cloche de notification */}
                <NotificationBell />
                
                {/* Le bouton déconnexion */}
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Déconnexion"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* Espace vide en bas */}
        <div className="p-4" />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="py-6 px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}