import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchApi } from '../api';
import { User, Save, ArrowLeft, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const { user, setUser } = useAuth(); // On récupère setUser pour mettre à jour l'affichage global
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      const updatedUser = await fetchApi('/api/auth/update-profile', {
        method: 'PATCH',
        body: JSON.stringify(formData),
      });

      // Crucial : on met à jour le contexte Auth pour que le nom change dans la Sidebar immédiatement
      if (setUser) setUser(updatedUser);
      
      setSuccess(true);
      // Retour automatique au tableau de bord après 2 secondes
      setTimeout(() => navigate('/'), 2000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button 
        onClick={() => navigate(-1)} 
        className="flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft size={16} className="mr-2" /> Retour
      </button>

      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="bg-blue-600 p-8 text-white">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-md">
              <User size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Mon Profil Personnel</h2>
              <p className="text-blue-100 text-sm">Gérez les informations qui s'affichent sur votre compte</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {success && (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-100 text-green-700 rounded-xl animate-in zoom-in duration-300">
              <CheckCircle size={20} />
              <p className="text-sm font-bold">Profil mis à jour ! Redirection...</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Prénom</label>
              <input
                type="text"
                required
                className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-gray-50 focus:bg-white"
                placeholder="Ex: Jean"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Nom de famille</label>
              <input
                type="text"
                required
                className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-gray-50 focus:bg-white"
                placeholder="Ex: Dupont"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
            <div className="text-xs text-gray-400">
              <p>Identifiant : <span className="font-medium text-gray-600">{user?.email}</span></p>
              <p>Rôle : <span className="font-medium text-gray-600 uppercase">{user?.role}</span></p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200 disabled:opacity-50 transition-all active:scale-95"
            >
              <Save size={18} />
              {loading ? 'Enregistrement...' : 'Sauvegarder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}