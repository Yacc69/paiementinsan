import React from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Receipt, Users, LogOut, Settings, UserCog } from 'lucide-react';
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
          <h1 className="text-xl font-bold text-gray-900 italic tracking-tight">FinManage</h1>
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
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all ${
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

          {/* SECTION SESSION UTILISATEUR */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="px-3 mb-3 flex justify-between items-center">
              <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">
                Session Utilisateur
              </p>
              <button 
                onClick={() => navigate('/settings')} 
                className="text-gray-400 hover:text-blue-600 transition-colors"
                title="Modifier mon profil"
              >
                <UserCog size={14} />
              </button>
            </div>
            
            <div className="flex flex-col gap-2 px-3 py-3 bg-gray-50 rounded-xl shadow-sm border border-gray-100">
              <div className="flex-1 min-w-0">
                {/* Affichage Prénom + Nom en priorité */}
                <p className="text-sm font-black text-gray-900 truncate leading-tight uppercase tracking-tighter">
                  {user?.first_name || user?.last_name 
                    ? `${user.first_name || ''} ${user.last_name || ''}`.trim() 
                    : 'COMPTE INCOMPLET'}
                </p>
                {/* Email en petit et italique */}
                <p className="text-[10px] text-gray-500 truncate mb-1 italic font-medium">
                  {user?.email}
                </p>
                {/* Badge de rôle */}
                <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-black rounded-full uppercase tracking-widest">
                  {user?.role?.replace('_', ' ')}
                </span>
              </div>
              
              <div className="flex items-center justify-between border-t border-gray-200 pt-2 mt-1">
                <div className="flex items-center gap-1">
                  <NotificationBell />
                </div>
                
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 px-2 py-1 text-[9px] font-black text-red-500 hover:bg-red-50 rounded-md transition-colors uppercase tracking-widest"
                >
                  <LogOut className="h-3 w-3" />
                  QUITTER
                </button>
              </div>
            </div>
          </div>
        </nav>

        <div className="p-4 text-center">
           <p className="text-[10px] text-gray-300 font-medium">v2.0.4 - 2026</p>
        </div>
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