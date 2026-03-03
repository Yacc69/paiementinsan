import React, { useEffect, useState } from 'react';
import { fetchApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, Check, X, Filter, Trash2, Edit2, Save, 
  Search, CheckSquare, Square, FileText, FileArchive, Image as ImageIcon, Download
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [previewFile, setPreviewFile] = useState<string | null>(null); // Changé de previewImage à previewFile
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
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filteredExpenses = expenses.filter(e => {
    const matchesCategory = !filterCategory || e.category_id.toString() === filterCategory;
    const matchesMonth = !filterMonth || (e.date && e.date.substring(0, 7) === filterMonth);
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      (e.description?.toLowerCase() || "").includes(searchLower) || 
      (e.user_full_name?.toLowerCase() || "").includes(searchLower) ||
      (e.user_email?.toLowerCase() || "").includes(searchLower);
    
    return matchesCategory && matchesMonth && matchesSearch;
  });

  const totalFiltered = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

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

  // --- GESTION DES FICHIERS (PDF, IMAGES, ZIP) ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 15 * 1024 * 1024) { // Augmenté à 15Mo pour les PDF/Archives
        alert('Fichier trop lourd (max 15Mo)');
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
        body: JSON.stringify({ ...formData, amount: parseFloat(formData.amount) })
      });
      setShowForm(false);
      setFormData({ category_id: '', sub_category_id: '', amount: '', description: '', date: new Date().toISOString().split('T')[0], attachment: '' });
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
    const action = status === 'approved' ? 'approuver' : 'refuser';
    if (!confirm(`Voulez-vous vraiment ${action} cette dépense ?`)) return;
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

  const handleDeleteBulk = async () => {
    if (!confirm(`Voulez-vous supprimer les ${selectedIds.length} dépenses sélectionnées ?`)) return;
    try {
      await Promise.all(selectedIds.map(id => fetchApi(`/api/expenses/${id}`, { method: 'DELETE' })));
      loadData();
    } catch (err: any) { alert(err.message); }
  };

  const selectedCategory = categories.find(c => c.id.toString() === formData.category_id);
  const selectedCategoryEdit = categories.find(c => c.id.toString() === editData.category_id);

  // Fonction pour détecter le type de fichier et afficher l'icône
  const getFileIcon = (base64: string) => {
    if (base64.includes('application/pdf')) return <FileText size={14} className="text-red-500" />;
    if (base64.includes('image/')) return <ImageIcon size={14} className="text-blue-500" />;
    if (base64.includes('zip') || base64.includes('rar')) return <FileArchive size={14} className="text-yellow-600" />;
    return <FileText size={14} />;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight italic uppercase">Gestion des Dépenses</h2>
        
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Rechercher..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 w-full border rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white font-bold"
            />
          </div>

          <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="border rounded-xl p-2 text-sm bg-white outline-none font-bold">
            <option value="">Tous les mois</option>
            {getMonthOptions().map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>

          <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center px-4 py-2 border border-transparent rounded-xl shadow-sm text-sm font-black text-white bg-blue-600 hover:bg-blue-700 transition-all uppercase tracking-tighter">
            <Plus className="-ml-1 mr-1 h-4 w-4" /> Nouvelle demande
          </button>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="bg-indigo-600 p-3 rounded-xl shadow-lg flex items-center justify-between text-white animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3 pl-2">
            <CheckSquare size={20} />
            <span className="font-black text-sm uppercase tracking-tighter">{selectedIds.length} sélectionnée(s)</span>
          </div>
          <button onClick={handleDeleteBulk} className="flex items-center gap-2 bg-red-500 hover:bg-red-600 px-4 py-1.5 rounded-lg text-xs font-black transition-colors uppercase">
            <Trash2 size={14} /> SUPPRIMER
          </button>
        </div>
      )}

      {/* Cartes résumé */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-xl">
          <p className="text-[10px] text-blue-500 font-black uppercase tracking-widest">Total Sélection</p>
          <p className="text-xl font-black text-blue-700">{totalFiltered.toLocaleString()} €</p>
        </div>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-xl">
          <p className="text-[10px] text-yellow-600 font-black uppercase tracking-widest">En cours</p>
          <p className="text-xl font-black text-yellow-700">{filteredExpenses.filter(e => e.status === 'pending').length}</p>
        </div>
        <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-xl">
          <p className="text-[10px] text-green-600 font-black uppercase tracking-widest">Acceptées</p>
          <p className="text-xl font-black text-green-700">{filteredExpenses.filter(e => e.status === 'approved').length}</p>
        </div>
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-xl">
          <p className="text-[10px] text-red-600 font-black uppercase tracking-widest">Refusées</p>
          <p className="text-xl font-black text-red-700">{filteredExpenses.filter(e => e.status === 'rejected').length}</p>
        </div>
      </div>

      {showForm && (
        <div className="bg-white shadow-xl rounded-3xl p-8 border border-blue-100 animate-in fade-in zoom-in duration-200">
          <h3 className="text-xl font-black text-gray-900 mb-6 uppercase tracking-tighter italic">Demande de paiement</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Famille</label>
              <select required value={formData.category_id} onChange={(e) => setFormData({ ...formData, category_id: e.target.value, sub_category_id: '' })} className="mt-1 block w-full border-2 border-gray-100 rounded-xl p-3 outline-none focus:border-blue-500 font-bold bg-gray-50">
                <option value="">Sélectionner</option>
                {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Sous-Famille</label>
              <select value={formData.sub_category_id} onChange={(e) => setFormData({ ...formData, sub_category_id: e.target.value })} className="mt-1 block w-full border-2 border-gray-100 rounded-xl p-3 outline-none focus:border-blue-500 font-bold bg-gray-50 disabled:opacity-50" disabled={!formData.category_id}>
                <option value="">Général</option>
                {selectedCategory?.sub_categories?.map((sub: any) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-1">
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Montant (€)</label>
              <input type="number" step="0.01" required value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className="mt-1 block w-full border-2 border-gray-100 rounded-xl p-3 outline-none focus:border-blue-500 font-bold bg-gray-50" />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Date</label>
              <input type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="mt-1 block w-full border-2 border-gray-100 rounded-xl p-3 outline-none focus:border-blue-500 font-bold bg-gray-50" />
            </div>
            <div className="sm:col-span-4">
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Description</label>
              <textarea rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="mt-1 block w-full border-2 border-gray-100 rounded-xl p-3 outline-none focus:border-blue-500 font-bold bg-gray-50" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Pièce Jointe (Images, PDF, ZIP)</label>
              <input 
                type="file" 
                accept="image/*,.pdf,.zip,.rar"
                onChange={handleFileChange} 
                className="mt-1 block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" 
              />
            </div>
            <div className="sm:col-span-6 flex justify-end space-x-3 border-t pt-6">
              <button type="button" onClick={() => setShowForm(false)} className="py-3 px-6 font-bold text-gray-500 uppercase tracking-widest text-xs">Annuler</button>
              <button type="submit" className="bg-blue-600 py-3 px-10 rounded-xl font-black text-white hover:bg-blue-700 shadow-lg uppercase tracking-widest text-xs">Envoyer la demande</button>
            </div>
          </form>
        </div>
      )}

      {/* Table des dépenses */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden font-bold">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <button onClick={toggleSelectAll} className="text-gray-300 hover:text-blue-600 transition-colors">
                  {selectedIds.length === filteredExpenses.length && filteredExpenses.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}
                </button>
              </th>
              <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
              <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Détails</th>
              <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Famille</th>
              <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Montant</th>
              <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Statut</th>
              <th className="px-6 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
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
                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 uppercase">
                  {new Date(expense.date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="font-black tracking-tighter uppercase">{expense.description || '-'}</div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase mt-1 flex items-center gap-2">
                    {(user?.role === 'admin' || user?.role === 'admin_level_1') && (
                      <span className="text-indigo-600">
                        {expense.user_full_name || expense.user_email} • 
                      </span>
                    )}
                    {expense.attachment && (
                      <button onClick={() => setPreviewFile(expense.attachment)} className="text-blue-600 hover:underline flex items-center gap-1">
                        {getFileIcon(expense.attachment)} Justificatif
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="font-black text-gray-800 tracking-tighter uppercase text-xs">{expense.category_name}</div>
                  <div className="text-[9px] text-gray-400 font-black uppercase">{expense.sub_category_name || 'Général'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-gray-900 tracking-tighter">
                  {expense.amount.toLocaleString()} €
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-3 py-1 inline-flex text-[9px] leading-5 font-black uppercase rounded-lg ${
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
                      <>
                        <button onClick={() => handleStatusUpdate(expense.id, 'approved')} className="text-green-600 bg-green-50 p-1.5 rounded-lg hover:bg-green-100 transition-colors" title="Approuver">
                          <Check size={16} />
                        </button>
                        <button onClick={() => handleStatusUpdate(expense.id, 'rejected')} className="text-red-600 bg-red-50 p-1.5 rounded-lg hover:bg-red-100 transition-colors" title="Rejeter">
                          <X size={16} />
                        </button>
                      </>
                    )}
                    <button onClick={() => handleDelete(expense.id)} className="text-gray-300 hover:text-red-600 p-1.5 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL EDITION ADMIN */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[110] p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-2xl font-black mb-6 italic tracking-tighter uppercase">Modifier la dépense</h3>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-black text-gray-400 uppercase ml-2 tracking-widest">Montant (€)</label>
                <input type="number" step="0.01" value={editData.amount} required className="w-full border-2 border-gray-100 rounded-xl p-3 outline-none font-bold focus:border-indigo-500 bg-gray-50" 
                  onChange={(e) => setEditData({...editData, amount: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-black text-gray-400 uppercase ml-2 tracking-widest">Famille</label>
                <select required className="w-full border-2 border-gray-100 rounded-xl p-3 font-bold bg-gray-50 outline-none focus:border-blue-500" 
                  value={editData.category_id} onChange={(e) => setEditData({...editData, category_id: e.target.value, sub_category_id: ''})}>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-black text-gray-400 uppercase ml-2 tracking-widest">Sous-Famille</label>
                <select className="w-full border-2 border-gray-100 rounded-xl p-3 font-bold bg-gray-50 outline-none focus:border-blue-500" 
                  value={editData.sub_category_id} onChange={(e) => setEditData({...editData, sub_category_id: e.target.value})}>
                  <option value="">Général / Autre</option>
                  {categories.find(c => c.id.toString() === editData.category_id)?.sub_categories?.map((sub: any) => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-6">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-3 font-bold text-gray-500 uppercase tracking-widest text-xs">Annuler</button>
                <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-black shadow-lg flex items-center justify-center gap-2 uppercase tracking-widest text-xs"><Save size={16}/> Sauvegarder</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE PRÉVISUALISATION ET TÉLÉCHARGEMENT */}
      {previewFile && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md" onClick={() => setPreviewFile(null)}>
          <div className="relative max-w-4xl w-full max-h-full flex flex-col items-center animate-in zoom-in duration-200">
            <button className="absolute -top-12 right-0 text-white hover:text-gray-300 bg-gray-800 p-2 rounded-full" onClick={() => setPreviewFile(null)}><X className="h-6 w-6" /></button>
            
            <div className="bg-white rounded-3xl p-6 shadow-2xl w-full flex flex-col items-center gap-6" onClick={(e) => e.stopPropagation()}>
              {previewFile.includes('image/') ? (
                <img src={previewFile} alt="Preview" className="max-w-full max-h-[70vh] object-contain rounded-xl border border-gray-100" />
              ) : (
                <div className="py-20 flex flex-col items-center gap-4">
                  {previewFile.includes('pdf') ? <FileText size={80} className="text-red-500" /> : <FileArchive size={80} className="text-yellow-600" />}
                  <p className="font-black text-gray-800 uppercase">Document justificatif ({previewFile.includes('pdf') ? 'PDF' : 'Archive'})</p>
                </div>
              )}
              
              <a 
                href={previewFile} 
                download={`justificatif-${Date.now()}`}
                className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black flex items-center gap-3 hover:bg-blue-700 shadow-xl transition-all uppercase tracking-widest text-sm"
              >
                <Download size={20} /> Télécharger le document
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}