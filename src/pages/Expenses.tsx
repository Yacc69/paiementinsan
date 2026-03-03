import React, { useEffect, useState } from 'react';
import { fetchApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, Check, X, Filter, Trash2, Edit2, Save, 
  Search, CheckSquare, Square 
} from 'lucide-react';

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
  const [showEditModal, setShowEditModal] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [searchQuery, setSearchQuery] = useState(''); // État pour la recherche
  const [selectedIds, setSelectedIds] = useState<number[]>([]); // État pour la sélection multiple
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    category_id: '',
    sub_category_id: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    attachment: ''
  });

  const [editData, setEditData] = useState({
    id: '',
    amount: '',
    category_id: '',
    sub_category_id: '',
    description: ''
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
      setSelectedIds([]); // Reset la sélection après chargement
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // --- LOGIQUE DE FILTRE ET RECHERCHE ---
  const filteredExpenses = expenses.filter(e => {
    const matchesCategory = !filterCategory || e.category_id.toString() === filterCategory;
    const matchesMonth = !filterMonth || (e.date && e.date.substring(0, 7) === filterMonth);
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      e.description?.toLowerCase().includes(searchLower) || 
      e.user_full_name?.toLowerCase().includes(searchLower) ||
      e.user_email?.toLowerCase().includes(searchLower);
    
    return matchesCategory && matchesMonth && matchesSearch;
  });

  const totalFiltered = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  // --- LOGIQUE DE SÉLECTION ---
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredExpenses.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredExpenses.map(e => e.id));
    }
  };

  // --- ACTIONS ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({ ...formData, amount: parseFloat(formData.amount) })
      });
      setShowForm(false);
      loadData();
    } catch (err: any) { alert(err.message); }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi(`/api/expenses/${editData.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...editData, amount: parseFloat(editData.amount) })
      });
      setShowEditModal(false);
      loadData();
    } catch (err: any) { alert(err.message); }
  };

  const handleStatusUpdate = async (id: number, status: 'approved' | 'rejected') => {
    try {
      await fetchApi(`/api/expenses/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      loadData();
    } catch (err: any) { alert(err.message); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cette dépense ?')) return;
    try {
      await fetchApi(`/api/expenses/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) { alert(err.message); }
  };

  // NOUVELLE FONCTION : SUPPRESSION EN MASSE
  const handleDeleteBulk = async () => {
    if (!confirm(`Voulez-vous supprimer les ${selectedIds.length} dépenses sélectionnées ?`)) return;
    try {
      // On boucle sur les IDs (ou tu peux créer une route backend dédiée bulk-delete)
      await Promise.all(selectedIds.map(id => fetchApi(`/api/expenses/${id}`, { method: 'DELETE' })));
      alert("Suppression groupée réussie");
      loadData();
    } catch (err: any) { alert(err.message); }
  };

  const selectedCategoryEdit = categories.find(c => c.id.toString() === editData.category_id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight italic">Gestion des Dépenses</h2>
        
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* BARRE DE RECHERCHE */}
          <div className="relative flex-1 lg:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Rechercher description, employé..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 w-full border rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="border rounded-xl p-2 text-sm bg-white outline-none">
            <option value="">Tous les mois</option>
            {getMonthOptions().map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>

          <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center px-4 py-2 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all">
            <Plus className="-ml-1 mr-1 h-4 w-4" /> Nouvelle demande
          </button>
        </div>
      </div>

      {/* BANDEAU ACTIONS GROUPÉES (Apparaît si sélection) */}
      {selectedIds.length > 0 && (
        <div className="bg-indigo-600 p-3 rounded-xl shadow-lg flex items-center justify-between text-white animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3 pl-2">
            <CheckSquare size={20} />
            <span className="font-bold text-sm">{selectedIds.length} dépense(s) sélectionnée(s)</span>
          </div>
          <button 
            onClick={handleDeleteBulk}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 px-4 py-1.5 rounded-lg text-xs font-black transition-colors"
          >
            <Trash2 size={14} /> SUPPRIMER LA SÉLECTION
          </button>
        </div>
      )}

      {/* Cartes de synthèse */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-xl">
          <p className="text-xs text-blue-500 font-bold uppercase">Total Sélection</p>
          <p className="text-xl font-black text-blue-700">{totalFiltered.toLocaleString()} €</p>
        </div>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-xl">
          <p className="text-xs text-yellow-600 font-bold uppercase font-black tracking-tighter">En cours</p>
          <p className="text-xl font-black text-yellow-700">{filteredExpenses.filter(e => e.status === 'pending').length}</p>
        </div>
        <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-xl">
          <p className="text-xs text-green-600 font-bold uppercase font-black tracking-tighter">Acceptées</p>
          <p className="text-xl font-black text-green-700">{filteredExpenses.filter(e => e.status === 'approved').length}</p>
        </div>
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-xl">
          <p className="text-xs text-red-600 font-bold uppercase font-black tracking-tighter">Refusées</p>
          <p className="text-xl font-black text-red-700">{filteredExpenses.filter(e => e.status === 'rejected').length}</p>
        </div>
      </div>

      {showForm && (
        <div className="bg-white shadow-xl rounded-2xl p-6 border border-gray-100 animate-in fade-in zoom-in duration-200">
          <h3 className="text-lg font-bold text-gray-900 mb-6 uppercase tracking-tighter italic">Demande de paiement</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <label className="block text-sm font-bold text-gray-700">Famille</label>
              <select required value={formData.category_id} onChange={(e) => setFormData({ ...formData, category_id: e.target.value, sub_category_id: '' })} className="mt-1 block w-full border border-gray-300 rounded-xl shadow-sm p-2 outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Sélectionner</option>
                {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-bold text-gray-700">Sous-Famille</label>
              <select value={formData.sub_category_id} onChange={(e) => setFormData({ ...formData, sub_category_id: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-xl shadow-sm p-2 outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50" disabled={!formData.category_id}>
                <option value="">Sélectionner (Optionnel)</option>
                {categories.find(c => c.id.toString() === formData.category_id)?.sub_categories?.map((sub: any) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-1">
              <label className="block text-sm font-bold text-gray-700">Montant (€)</label>
              <input type="number" step="0.01" required value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-xl shadow-sm p-2 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-sm font-bold text-gray-700">Date</label>
              <input type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-xl shadow-sm p-2 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="sm:col-span-4">
              <label className="block text-sm font-bold text-gray-700">Description</label>
              <textarea rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-xl shadow-sm p-2 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-bold text-gray-700">Facture</label>
              <input type="file" onChange={handleFileChange} className="mt-1 block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            </div>
            <div className="sm:col-span-6 flex justify-end space-x-3 border-t pt-4">
              <button type="button" onClick={() => setShowForm(false)} className="bg-white py-2 px-4 border border-gray-300 rounded-xl shadow-sm text-sm font-bold text-gray-700 hover:bg-gray-50">Annuler</button>
              <button type="submit" className="bg-blue-600 py-2 px-6 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white hover:bg-blue-700 transition-colors">Envoyer</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <button onClick={toggleSelectAll} className="text-gray-400 hover:text-blue-600">
                  {selectedIds.length === filteredExpenses.length && filteredExpenses.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-black text-gray-400 uppercase tracking-widest">Date</th>
              <th className="px-6 py-3 text-left text-xs font-black text-gray-400 uppercase tracking-widest">Détails</th>
              <th className="px-6 py-3 text-left text-xs font-black text-gray-400 uppercase tracking-widest">Famille</th>
              <th className="px-6 py-3 text-left text-xs font-black text-gray-400 uppercase tracking-widest">Montant</th>
              <th className="px-6 py-3 text-left text-xs font-black text-gray-400 uppercase tracking-widest">Statut</th>
              <th className="px-6 py-3 text-right text-xs font-black text-gray-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredExpenses.map((expense) => (
              <tr key={expense.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.includes(expense.id) ? 'bg-blue-50/50' : ''}`}>
                <td className="px-4 py-4 whitespace-nowrap">
                  <button onClick={() => toggleSelect(expense.id)} className={`${selectedIds.includes(expense.id) ? 'text-blue-600' : 'text-gray-300'}`}>
                    {selectedIds.includes(expense.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-gray-500">
                  {new Date(expense.date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="font-black tracking-tight">{expense.description || '-'}</div>
                  <div className="text-[10px] text-gray-400">
                    {(user?.role === 'admin' || user?.role === 'admin_level_1') && (
                      <span className="text-indigo-600 font-black uppercase tracking-tighter">
                        {expense.user_full_name && expense.user_full_name !== "" ? expense.user_full_name : expense.user_email} • 
                      </span>
                    )}
                    {expense.attachment && (
                      <button onClick={() => setPreviewImage(expense.attachment)} className="text-blue-600 font-bold hover:underline ml-1">Facture</button>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="font-bold text-gray-700 tracking-tighter">{expense.category_name}</div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase">{expense.sub_category_name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-gray-900 tracking-tighter">
                  {expense.amount.toLocaleString()} €
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-3 py-1 inline-flex text-[10px] leading-5 font-black uppercase rounded-full ${
                    expense.status === 'approved' ? 'bg-green-100 text-green-800' :
                    expense.status === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {expense.status === 'approved' ? 'Approuvé' : expense.status === 'rejected' ? 'Rejeté' : 'En attente'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end space-x-2">
                    {(user?.role === 'admin' || user?.role === 'admin_level_1') && (
                      <button 
                        onClick={() => {
                          setEditData({
                            id: expense.id,
                            amount: expense.amount.toString(),
                            category_id: expense.category_id.toString(),
                            sub_category_id: expense.sub_category_id?.toString() || '',
                            description: expense.description || ''
                          });
                          setShowEditModal(true);
                        }}
                        className="text-gray-400 hover:text-blue-600 p-1.5 transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                    )}
                    {(user?.role === 'admin' || user?.role === 'admin_level_1') && expense.status === 'pending' && (
                      <button onClick={() => handleStatusUpdate(expense.id, 'approved')} className="text-green-600 bg-green-50 p-1.5 rounded-lg"><Check size={16} /></button>
                    )}
                    <button onClick={() => handleDelete(expense.id)} className="text-gray-300 hover:text-red-600 p-1.5 transition-colors"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL ÉDITION ADMIN */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[110] p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-2xl font-black mb-6 italic tracking-tighter uppercase">Modifier la dépense</h3>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-black text-gray-400 uppercase ml-2 tracking-widest">Montant (€)</label>
                <input type="number" step="0.01" value={editData.amount} required className="w-full border-2 rounded-xl p-3 outline-none font-bold focus:border-indigo-500" 
                  onChange={(e) => setEditData({...editData, amount: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-black text-gray-400 uppercase ml-2 tracking-widest">Famille</label>
                <select required className="w-full border-2 rounded-xl p-3 font-bold bg-white outline-none focus:border-indigo-500" 
                  value={editData.category_id} onChange={(e) => setEditData({...editData, category_id: e.target.value, sub_category_id: ''})}>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-black text-gray-400 uppercase ml-2 tracking-widest">Sous-Famille</label>
                <select className="w-full border-2 rounded-xl p-3 font-bold bg-white outline-none focus:border-indigo-500" 
                  value={editData.sub_category_id} onChange={(e) => setEditData({...editData, sub_category_id: e.target.value})}>
                  <option value="">Général / Autre</option>
                  {categories.find(c => c.id.toString() === editData.category_id)?.sub_categories?.map((sub: any) => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-6">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-3 font-bold text-gray-500">Annuler</button>
                <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-black shadow-lg flex items-center justify-center gap-2"><Save size={18}/> Sauvegarder</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black bg-opacity-80 p-4 backdrop-blur-sm" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-4xl w-full max-h-full flex flex-col items-center animate-in zoom-in duration-200">
            <button className="absolute -top-12 right-0 text-white hover:text-gray-300 bg-gray-800 p-2 rounded-full" onClick={() => setPreviewImage(null)}><X className="h-6 w-6" /></button>
            <img src={previewImage} alt="Preview" className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border-4 border-white" onClick={(e) => e.stopPropagation()} />
          </div>
        </div>
      )}
    </div>
  );
}