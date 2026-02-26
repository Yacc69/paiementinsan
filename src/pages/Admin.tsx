import React, { useEffect, useState } from 'react';
import { fetchApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { 
  UserPlus, Shield, Trash2, X, Plus, 
  Layers, ChevronRight, User 
} from 'lucide-react';

export default function Admin() {
  const { user } = useAuth();
  
  // RÈGLE : Seul l'Admin suprême voit l'onglet utilisateurs. 
  // Le Manager (admin_level_1) arrive directement sur l'onglet Familles.
  const isAdminSupréme = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState<'users' | 'categories'>(
    isAdminSupréme ? 'users' : 'categories'
  );
  
  const [users, setUsers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showUserModal, setShowUserModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [showSubCatModal, setShowSubCatModal] = useState(false);

  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'requester' });
  const [newCat, setNewCat] = useState({ name: '' });
  const [newSubCat, setNewSubCat] = useState({ name: '', category_id: '' });
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const promises = [fetchApi('/api/categories')];
      
      // On ne charge la liste des utilisateurs QUE pour l'admin suprême
      if (isAdminSupréme) {
        promises.push(fetchApi('/api/auth/users'));
      }
      
      const [catData, userData] = await Promise.all(promises);
      setCategories(Array.isArray(catData) ? catData : []);
      if (userData) setUsers(Array.isArray(userData) ? userData : []);
    } catch (err) { 
      console.error("Erreur de chargement des données Admin:", err); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { loadData(); }, []);

  // --- ACTIONS ---
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/api/auth/register', { method: 'POST', body: JSON.stringify(newUser) });
      setShowUserModal(false);
      setNewUser({ email: '', password: '', role: 'requester' });
      loadData();
    } catch (err: any) { alert(err.message); }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/api/categories', { method: 'POST', body: JSON.stringify(newCat) });
      setShowCatModal(false);
      setNewCat({ name: '' });
      loadData();
    } catch (err: any) { alert(err.message); }
  };

  const handleAddSubCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/api/categories/sub', { method: 'POST', body: JSON.stringify(newSubCat) });
      setShowSubCatModal(false);
      setNewSubCat({ name: '', category_id: '' });
      loadData();
    } catch (err: any) { alert(err.message); }
  };

  if (loading) return <div className="p-10 text-center font-bold">Chargement de l'administration...</div>;

  return (
    <div className="space-y-6 pb-20">
      {/* HEADER & TABS NAVIGATION */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Configuration</h2>
          <p className="text-gray-500 font-medium">Gérez la structure et les membres</p>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
          {isAdminSupréme && (
            <button 
              onClick={() => setActiveTab('users')} 
              className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'users' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
            >
              <User size={18} /> Utilisateurs
            </button>
          )}
          <button 
            onClick={() => setActiveTab('categories')} 
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'categories' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
          >
            <Layers size={18} /> Familles & Sous-familles
          </button>
        </div>
      </div>

      {/* --- ONGLET UTILISATEURS (Visible uniquement Admin Suprême) --- */}
      {activeTab === 'users' && isAdminSupréme && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in duration-300">
          <div className="p-4 flex justify-end bg-gray-50 border-b">
            <button onClick={() => setShowUserModal(true)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg">
              <UserPlus size={18} /> Nouveau Membre
            </button>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-black text-gray-400 uppercase tracking-widest">Email</th>
                <th className="px-6 py-4 text-left text-xs font-black text-gray-400 uppercase tracking-widest">Rôle</th>
                <th className="px-6 py-4 text-right text-xs font-black text-gray-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-gray-900">{u.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-lg text-xs font-bold ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* --- ONGLET FAMILLES (Accessible Admin et Manager) --- */}
      {activeTab === 'categories' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex justify-end gap-3 mb-4">
            <button onClick={() => setShowCatModal(true)} className="bg-white border-2 border-indigo-600 text-indigo-600 px-5 py-2 rounded-xl font-bold hover:bg-indigo-50 transition-all">
              Nouvelle Famille
            </button>
            <button onClick={() => setShowSubCatModal(true)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg transition-all">
              Nouvelle Sous-Famille
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((cat) => (
              <div key={cat.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-4">
                  <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><Layers size={20}/></div>
                  <button className="text-gray-300 hover:text-red-500"><Trash2 size={16}/></button>
                </div>
                <h4 className="text-lg font-black text-gray-800 mb-3">{cat.name}</h4>
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Sous-familles :</p>
                  {/* ON UTILISE BIEN sub_categories ICI */}
                  {cat.sub_categories && cat.sub_categories.length > 0 ? (
                    cat.sub_categories.map((sub: any) => (
                      <div key={sub.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-xs font-bold text-gray-600 group">
                        <span className="flex items-center gap-2">
                          <ChevronRight size={14} className="text-indigo-400" /> {sub.name}
                        </span>
                        <button className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><X size={14}/></button>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs italic text-gray-400">Aucune sous-famille créée</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- MODALS --- */}
      {/* Modal Famille */}
      {showCatModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-2xl font-black mb-6">Nouvelle Famille</h3>
            <form onSubmit={handleAddCategory} className="space-y-4">
              <input type="text" placeholder="Ex: Marketing, Logistique..." required className="w-full border-2 rounded-xl p-3 outline-none focus:border-indigo-500 font-bold" 
                onChange={(e) => setNewCat({ name: e.target.value })} />
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowCatModal(false)} className="flex-1 py-3 font-bold text-gray-500 hover:bg-gray-100 rounded-xl">Annuler</button>
                <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-black shadow-lg">Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Sous-Famille */}
      {showSubCatModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-2xl font-black mb-6">Nouvelle Sous-Famille</h3>
            <form onSubmit={handleAddSubCategory} className="space-y-4">
              <select required className="w-full border-2 rounded-xl p-3 font-bold bg-white outline-none focus:border-indigo-500" 
                onChange={(e) => setNewSubCat({...newSubCat, category_id: e.target.value})}>
                <option value="">Sélectionner la famille parente</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="text" placeholder="Ex: Publicité Facebook, Essence..." required className="w-full border-2 rounded-xl p-3 outline-none focus:border-indigo-500 font-bold" 
                onChange={(e) => setNewSubCat({ ...newSubCat, name: e.target.value })} />
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowSubCatModal(false)} className="flex-1 py-3 font-bold text-gray-500 hover:bg-gray-100 rounded-xl">Annuler</button>
                <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-black shadow-lg">Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Utilisateur (Admin Suprême uniquement) */}
      {showUserModal && isAdminSupréme && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-2xl font-black mb-6">Ajouter un collaborateur</h3>
            <form onSubmit={handleAddUser} className="space-y-4">
              <input type="email" placeholder="Email" required className="w-full border-2 rounded-xl p-3 outline-none focus:border-indigo-500 font-bold" 
                onChange={(e) => setNewUser({...newUser, email: e.target.value})} />
              <input type="password" placeholder="Mot de passe provisoire" required className="w-full border-2 rounded-xl p-3 outline-none focus:border-indigo-500 font-bold"
                onChange={(e) => setNewUser({...newUser, password: e.target.value})} />
              <select className="w-full border-2 rounded-xl p-3 font-bold bg-white outline-none focus:border-indigo-500" 
                onChange={(e) => setNewUser({...newUser, role: e.target.value})}>
                <option value="requester">Collaborateur (Requester)</option>
                <option value="admin">Administrateur (Admin)</option>
                <option value="admin_level_1">Manager (Admin Level 1)</option>
              </select>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowUserModal(false)} className="flex-1 py-3 font-bold text-gray-500">Annuler</button>
                <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-black shadow-lg">Valider</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}