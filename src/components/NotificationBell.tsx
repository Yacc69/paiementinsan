import React, { useState, useEffect, useRef } from 'react';
import { Bell, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  created_at: string;
}

export const NotificationBell: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Erreur chargement notifications:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const markAsRead = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (error) {
      console.error('Erreur marquage lecture:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/notifications/read-all`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Erreur marquage tout lu:', error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="text-green-500" size={16} />;
      case 'warning': return <AlertTriangle className="text-yellow-500" size={16} />;
      case 'error': return <XCircle className="text-red-500" size={16} />;
      default: return <Info className="text-blue-500" size={16} />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bouton Cloche */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
      >
        <Bell size={22} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white shadow-sm">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Fenêtre des Notifications */}
      {isOpen && (
        <div 
          className="fixed left-[260px] bottom-4 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl z-[9999] animate-in fade-in slide-in-from-left-2 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b bg-gray-50/50 px-4 py-3">
            <h3 className="text-sm font-bold text-gray-800">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 uppercase tracking-tight"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>

          {/* Liste Scrollable */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-gray-400 font-medium">Aucune notification pour le moment</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div 
                  key={notification.id}
                  onClick={() => !notification.is_read && markAsRead(notification.id)}
                  className={`flex cursor-pointer gap-3 border-b border-gray-50 p-4 transition-colors hover:bg-gray-50 ${
                    !notification.is_read ? 'bg-blue-50/30' : ''
                  }`}
                >
                  <div className="mt-0.5 shrink-0">{getIcon(notification.type)}</div>
                  <div className="flex-1">
                    <p className={`text-sm leading-tight ${!notification.is_read ? 'font-bold text-gray-900' : 'font-medium text-gray-600'}`}>
                      {notification.title}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 leading-relaxed line-clamp-3">
                      {notification.message}
                    </p>
                    <p className="mt-2 text-[9px] font-medium text-gray-400 uppercase">
                      {new Date(notification.created_at).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500 shadow-sm"></div>
                  )}
                </div>
              ))
            )}
          </div>
          
          {/* Footer optionnel */}
          <div className="bg-gray-50 px-4 py-2 border-t text-center text-[10px] text-gray-400">
            FinManage Notifications
          </div>
        </div>
      )}
    </div>
  );
};