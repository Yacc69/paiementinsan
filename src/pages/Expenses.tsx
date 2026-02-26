import React, { useEffect, useState } from 'react';
import { fetchApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { Plus, Check, X, Filter, Trash2 } from 'lucide-react';

const getMonthOptions = () => {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return options;
};

export default function Expenses() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const { user } = useAuth();

  // Form state
  const [formData, setFormData] = useState({
    category_id: '',
    sub_category_id: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    attachment: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [expensesData, categoriesData] = await Promise.all([
        fetchApi('/api/expenses'),
        fetchApi('/api/categories')
      ]);
      setExpenses(expensesData);
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

  const filteredExpenses = expenses.filter(e => {
    const matchesCategory = !filterCategory || e.category_id.toString() === filterCategory;
    const matchesMonth = !filterMonth || (e.date && e.date.substring(0, 7) === filterMonth);
    return matchesCategory && matchesMonth;
  });

  const totalFiltered = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const statusCounts = {
    pending: filteredExpenses.filter(e => e.status === 'pending').length,
    approved: filteredExpenses.filter(e => e.status === 'approved').length,
    rejected: filteredExpenses.filter(e => e.status === 'rejected').length,
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        alert('Le fichier est trop volumineux (max 10Mo)');
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, attachment: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount)
        })
      });
      setShowForm(false);
      setFormData({ category_id: '', sub_category_id: '', amount: '', description: '', date: new Date().toISOString().split('T')[0], attachment: '' });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStatusUpdate = async (id: number, status: 'approved' | 'rejected') => {
    try {
      await fetchApi(`/api/expenses/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette dépense ?')) return;
    try {
      await fetchApi(`/api/expenses/${id}`, {
        method: 'DELETE'
      });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // --- CORRECTION ICI : Trouver la catégorie sélectionnée ---
  const selectedCategory = categories.find(c => c.id.toString() === formData.category_id);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Gestion des Dépenses</h2>
        <div className="flex space-x-3">
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="block border-gray-300 rounded-md shadow-sm p-2 text-sm border bg-white outline-none"
          >
            <option value="">Tous les mois</option>
            {getMonthOptions().map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="block pl-3 pr-10 py-2 text-base border-gray-300 sm:text-sm rounded-md border outline-none"
          >
            <option value="">Toutes les familles</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Nouvelle demande
          </button>
        </div>
      </div>

      {/* Résumé des statuts */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
          <p className="text-xs text-blue-500 font-bold uppercase tracking-wider">Total Sélection</p>
          <p className="text-xl font-bold text-blue-700">{totalFiltered.toLocaleString()} €</p>
        </div>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
          <p className="text-xs text-yellow-600 font-bold uppercase tracking-wider">En cours</p>
          <p className="text-xl font-bold text-yellow-700">{statusCounts.pending}</p>
        </div>
        <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-lg">
          <p className="text-xs text-green-600 font-bold uppercase tracking-wider">Acceptées</p>
          <p className="text-xl font-bold text-green-700">{statusCounts.approved}</p>
        </div>
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-lg">
          <p className="text-xs text-red-600 font-bold uppercase tracking-wider">Refusées</p>
          <p className="text-xl font-bold text-red-700">{statusCounts.rejected}</p>
        </div>
      </div>

      {showForm && (
        <div className="bg-white shadow-xl rounded-2xl p-6 border border-gray-100 animate-in fade-in zoom-in duration-200">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Demande de paiement</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <label className="block text-sm font-bold text-gray-700">Famille</label>
              <select
                required
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value, sub_category_id: '' })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sélectionner</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-bold text-gray-700">Sous-Famille</label>
              <select
                value={formData.sub_category_id}
                onChange={(e) => setFormData({ ...formData, sub_category_id: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                disabled={!formData.category_id}
              >
                <option value="">Sélectionner (Optionnel)</option>
                {/* --- CORRECTION ICI : On utilise sub_categories (underscore) --- */}
                {selectedCategory?.sub_categories?.map((sub: any) => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-1">
              <label className="block text-sm font-bold text-gray-700">Montant (€)</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-1">
              <label className="block text-sm font-bold text-gray-700">Date</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="block text-sm font-bold text-gray-700">Description</label>
              <textarea
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-bold text-gray-700">Pièce jointe (Facture)</label>
              <input
                type="file"
                onChange={handleFileChange}
                className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            <div className="sm:col-span-6 flex justify-end space-x-3 border-t pt-4">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="bg-blue-600 py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-bold text-white hover:bg-blue-700 transition-colors"
              >
                Envoyer la demande
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tableau des dépenses */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Date</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Détails</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Famille</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Montant</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Statut</th>
              <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredExpenses.map((expense) => (
              <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(expense.date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="font-bold">{expense.description || '-'}</div>
                  <div className="text-xs text-gray-400">
                    {(user?.role === 'admin' || user?.role === 'admin_level_1') && <span>Demandeur: {expense.user_email} • </span>}
                    {expense.attachment && (
                      <button 
                        onClick={() => setPreviewImage(expense.attachment)}
                        className="text-blue-600 font-bold hover:underline"
                      >
                        Voir la facture
                      </button>
                    )}
                  </div>
                  {expense.approved_by_email && (
                    <div className="text-xs text-green-600 font-bold italic mt-1 flex items-center gap-1">
                      <Check size={12}/> Approuvé par: {expense.approved_by_email}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="font-bold text-gray-700">{expense.category_name}</div>
                  {expense.sub_category_name && (
                    <div className="text-xs text-gray-400">{expense.sub_category_name}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-gray-900">
                  {expense.amount.toLocaleString()} €
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${
                    expense.status === 'approved' ? 'bg-green-100 text-green-800' :
                    expense.status === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {expense.status === 'approved' ? 'Approuvé' :
                     expense.status === 'rejected' ? 'Rejeté' : 'En attente'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end space-x-3">
                    {/* Validation pour Admin et Manager */}
                    {(user?.role === 'admin' || user?.role === 'admin_level_1') && expense.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleStatusUpdate(expense.id, 'approved')}
                          className="text-green-600 hover:text-green-900 bg-green-50 p-1.5 rounded-lg transition-colors"
                          title="Approuver"
                        >
                          <Check className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(expense.id, 'rejected')}
                          className="text-red-600 hover:text-red-900 bg-red-50 p-1.5 rounded-lg transition-colors"
                          title="Rejeter"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </>
                    )}
                    {(user?.role === 'admin' || user?.role === 'admin_level_1' || (expense.user_id === user?.id && expense.status === 'pending')) && (
                      <button
                        onClick={() => handleDelete(expense.id)}
                        className="text-gray-400 hover:text-red-600 p-1.5 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredExpenses.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm font-bold text-gray-500 bg-gray-50">
                  Aucune dépense trouvée pour les filtres sélectionnés
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-80 p-4 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl w-full max-h-full flex flex-col items-center animate-in zoom-in duration-200">
            <button 
              className="absolute -top-12 right-0 text-white hover:text-gray-300 bg-gray-800 p-2 rounded-full"
              onClick={() => setPreviewImage(null)}
            >
              <X className="h-6 w-6" />
            </button>
            <img 
              src={previewImage} 
              alt="Preview" 
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border-4 border-white"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}