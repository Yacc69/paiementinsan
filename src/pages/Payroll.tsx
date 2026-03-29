import React, { useEffect, useState } from 'react';
import { fetchApi } from '../api';
import { useAuth } from '../context/AuthContext';
// Ajout de Edit2 et X pour l'interface de modification
import { Plus, Users, History, Search, Trash2, Edit2, X } from 'lucide-react';

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

export default function Payroll() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [totalPayroll, setTotalPayroll] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  // Nouvel état pour savoir quel salarié on modifie
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filterMonth, setFilterMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [searchQuery, setSearchQuery] = useState('');
  const { user, loading: authLoading } = useAuth(); // 🛡️ MODIF: authLoading ajouté

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    salary: '',
    start_date: new Date().toISOString().split('T')[0]
  });

  const loadData = async () => {
    if (employees.length === 0) setLoading(true); // 🛡️ MODIF: Ne charge qu'au premier coup
    try {
      const monthParam = filterMonth ? `&month=${filterMonth}` : '';
      const searchParam = searchQuery ? `&search=${searchQuery}` : '';
      const [employeesData, payrollData] = await Promise.all([
        fetchApi(`/api/employees?${monthParam}${searchParam}`),
        fetchApi(`/api/employees/payroll?${monthParam}`)
      ]);
      setEmployees(employeesData);
      setTotalPayroll(payrollData.total_payroll);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading || !user) return; // 🛡️ MODIF: on attend authLoading
    const timer = setTimeout(() => {
      loadData();
    }, 300);
    return () => clearTimeout(timer);
  }, [filterMonth, searchQuery, user, authLoading]);

  // --- LOGIQUE DE SOUMISSION (AJOUT OU MODIFICATION) ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingId ? 'PATCH' : 'POST';
      const url = editingId ? `/api/employees/${editingId}` : '/api/employees';

      await fetchApi(url, {
        method: method,
        body: JSON.stringify({
          ...formData,
          salary: parseFloat(formData.salary)
        })
      });

      setShowForm(false);
      setEditingId(null);
      setFormData({ first_name: '', last_name: '', salary: '', start_date: new Date().toISOString().split('T')[0] });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // --- NOUVELLE FONCTION POUR PRE-REMPLIR LE FORMULAIRE ---
  const handleEdit = (employee: any) => {
    setEditingId(employee.id);
    setFormData({
      first_name: employee.first_name,
      last_name: employee.last_name,
      salary: employee.salary.toString(),
      start_date: employee.start_date
    });
    setShowForm(true);
    // Petit scroll automatique vers le formulaire
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Voulez-vous vraiment supprimer ce salarié ? Cette action est irréversible et les administrateurs seront notifiés.')) return;
    try {
      await fetchApi(`/api/employees/${id}`, {
        method: 'DELETE'
      });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 🛡️ MODIF : LE VERROU DE FLUIDITÉ
  if (authLoading || (loading && employees.length === 0)) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
        <p className="mt-4 font-black text-indigo-600 uppercase italic animate-pulse tracking-tighter">
          Flux de données sécurisé...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Masse Salariale</h2>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un salarié..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Mois :</label>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="border rounded p-2 text-sm bg-white outline-none"
            >
              <option value="">Tous les mois (Cumul)</option>
              {getMonthOptions().map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {user?.role === 'admin' && (
            <button
              onClick={() => {
                setShowForm(!showForm);
                if (showForm) setEditingId(null); // Reset si on ferme
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              <Plus className="-ml-1 mr-2 h-5 w-5" />
              {editingId ? 'Mode Edition' : 'Ajouter un salarié'}
            </button>
          )}
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-white shadow rounded-lg p-6 flex items-center justify-between border border-gray-100">
        <div className="flex items-center">
          <div className="bg-green-100 p-3 rounded-full">
            <Users className="h-6 w-6 text-green-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">
              {filterMonth ? `Masse Salariale Mensuelle (${filterMonth})` : 'Cumul Masse Salariale (Tous les mois)'}
            </p>
            <p className="text-2xl font-black text-gray-900">{totalPayroll.toLocaleString()} €</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wider text-xs">Salariés actifs</p>
          <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
        </div>
      </div>

      {showForm && (
        <div className={`bg-white shadow-xl rounded-lg p-6 border-2 animate-in zoom-in duration-200 ${editingId ? 'border-orange-400' : 'border-blue-100'}`}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900">
              {editingId ? `Modifier : ${formData.first_name} ${formData.last_name}` : 'Nouveau salarié'}
            </h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-3">
              <label className="block text-sm font-bold text-gray-700">Prénom</label>
              <input
                type="text"
                required
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-sm font-bold text-gray-700">Nom</label>
              <input
                type="text"
                required
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-sm font-bold text-gray-700">Salaire Mensuel (€)</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.salary}
                onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-sm font-bold text-gray-700">Date d'embauche</label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-6 flex justify-end space-x-3 border-t pt-4">
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingId(null); }}
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                className={`py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-bold text-white transition-colors ${editingId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {editingId ? 'Mettre à jour' : 'Enregistrer le salarié'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Employees Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6 flex items-center bg-gray-50/50">
          <History className="h-5 w-5 text-gray-400 mr-2" />
          <h3 className="text-lg leading-6 font-bold text-gray-900">Effectifs et historique</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Nom complet</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Salaire</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Date d'embauche</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Ajouté par</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Date d'ajout</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                    {employee.first_name} {employee.last_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                    {employee.salary.toLocaleString()} €
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(employee.start_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 italic">
                    {employee.added_by_email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                    {new Date(employee.added_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      {/* BOUTON MODIFIER */}
                      <button
                        onClick={() => handleEdit(employee)}
                        className="text-blue-500 hover:text-blue-700 p-1.5 rounded-full hover:bg-blue-50 transition-colors"
                        title="Modifier le salarié"
                      >
                        <Edit2 size={18} />
                      </button>
                      
                      {/* BOUTON SUPPRIMER */}
                      {user?.role === 'admin' && (
                        <button
                          onClick={() => handleDelete(employee.id)}
                          className="text-gray-400 hover:text-red-600 p-1.5 rounded-full hover:bg-red-50 transition-colors"
                          title="Supprimer le salarié"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm font-medium text-gray-500 bg-gray-50">
                    Aucun salarié enregistré pour cette recherche
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}