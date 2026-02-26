import React, { useEffect, useState } from 'react';
import { fetchApi } from '../api';
import { Plus, UserPlus, Tag } from 'lucide-react';

export default function Admin() {
  const [users, setUsers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'requester' });
  const [newCategory, setNewCategory] = useState('');
  const [newSubCategory, setNewSubCategory] = useState({ name: '', category_id: '' });

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersData, categoriesData] = await Promise.all([
        fetchApi('/api/auth/users'),
        fetchApi('/api/categories')
      ]);
      setUsers(usersData);
      setCategories(categoriesData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(newUser)
      });
      setNewUser({ email: '', password: '', role: 'requester' });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/api/categories', {
        method: 'POST',
        body: JSON.stringify({ name: newCategory })
      });
      setNewCategory('');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateSubCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/api/categories/sub', {
        method: 'POST',
        body: JSON.stringify(newSubCategory)
      });
      setNewSubCategory({ name: '', category_id: '' });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-gray-900">Administration</h2>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* User Management */}
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <UserPlus className="mr-2 h-5 w-5 text-blue-500" />
              Créer un utilisateur
            </h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Mot de passe</label>
                <input
                  type="password"
                  required
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Rôle</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                >
                  <option value="requester">Demandeur</option>
                  <option value="admin">Administrateur (Super)</option>
                  <option value="admin_level_1">Administrateur Niveau 1</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 font-medium"
              >
                Créer l'utilisateur
              </button>
            </form>
          </div>

          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Utilisateurs existants</h3>
            </div>
            <ul className="divide-y divide-gray-200">
              {users.map((u) => (
                <li key={u.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{u.email}</p>
                      <p className="text-xs text-gray-500 capitalize">{u.role}</p>
                    </div>
                    <span className="text-xs text-gray-400">
                      Inscrit le {new Date(u.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Category & Sub-category Management */}
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Tag className="mr-2 h-5 w-5 text-green-500" />
              Gestion des Familles
            </h3>
            
            <form onSubmit={handleCreateCategory} className="space-y-4 mb-8 pb-8 border-b">
              <p className="text-sm font-semibold text-gray-600">Nouvelle Famille</p>
              <div>
                <input
                  type="text"
                  required
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  placeholder="ex: Marketing, IT, Voyage..."
                />
              </div>
              <button
                type="submit"
                className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 font-medium"
              >
                Ajouter la famille
              </button>
            </form>

            <form onSubmit={handleCreateSubCategory} className="space-y-4">
              <p className="text-sm font-semibold text-gray-600">Nouvelle Sous-Famille</p>
              <div>
                <label className="block text-sm font-medium text-gray-700">Famille parente</label>
                <select
                  required
                  value={newSubCategory.category_id}
                  onChange={(e) => setNewSubCategory({ ...newSubCategory, category_id: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                >
                  <option value="">Sélectionner</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Nom de la sous-famille</label>
                <input
                  type="text"
                  required
                  value={newSubCategory.name}
                  onChange={(e) => setNewSubCategory({ ...newSubCategory, name: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  placeholder="ex: Publicité, Logiciels, Train..."
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 font-medium"
              >
                Ajouter la sous-famille
              </button>
            </form>
          </div>

          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Structure des familles</h3>
            </div>
            <div className="p-6 space-y-4">
              {categories.map((cat) => (
                <div key={cat.id} className="border rounded-lg p-3">
                  <div className="font-bold text-gray-900 flex items-center">
                    <Tag className="h-4 w-4 mr-2 text-green-500" />
                    {cat.name}
                  </div>
                  {cat.subCategories && cat.subCategories.length > 0 && (
                    <div className="mt-2 ml-6 flex flex-wrap gap-2">
                      {cat.subCategories.map((sub: any) => (
                        <span key={sub.id} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md border border-blue-100">
                          {sub.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
