import React, { useEffect, useState } from 'react';
import { fetchApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { TrendingUp, Users, Receipt, ArrowRight, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

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

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [monthsToCompare, setMonthsToCompare] = useState<string[]>([]);
  const [comparisonType, setComparisonType] = useState<'category' | 'subcategory' | 'total'>('category');
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const { user } = useAuth();

  const loadStats = async () => {
    setLoading(true);
    try {
      const url = filterMonth ? `/api/dashboard?month=${filterMonth}` : '/api/dashboard';
      const [statsData, categoriesData] = await Promise.all([
        fetchApi(url),
        fetchApi('/api/categories')
      ]);
      setStats(statsData);
      setCategories(categoriesData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [filterMonth]);

  useEffect(() => {
    // Default comparison: current month and previous month (local time)
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
    setMonthsToCompare([prevMonth, currentMonth]);
  }, []);

  useEffect(() => {
    if (monthsToCompare.length > 0) {
      const catFilter = selectedCategories.length > 0 ? `&categories=${selectedCategories.join(',')}` : '';
      fetchApi(`/api/dashboard/comparison?months=${monthsToCompare.join(',')}&type=${comparisonType}${catFilter}`)
        .then(setComparisonData);
    }
  }, [monthsToCompare, comparisonType, selectedCategories]);

  if (loading && !stats) return <div className="flex justify-center items-center h-64">Chargement...</div>;

  // Transform comparison data for Recharts
  let chartData: any[] = [];
  if (comparisonData) {
    const labels = new Set<string>();
    Object.values(comparisonData).forEach((monthData: any) => {
      monthData.forEach((d: any) => labels.add(d.label));
    });

    labels.forEach(label => {
      const entry: any = { label };
      monthsToCompare.forEach(month => {
        const monthVal = comparisonData[month]?.find((d: any) => d.label === label)?.total || 0;
        entry[month] = monthVal;
      });
      chartData.push(entry);
    });
  }

  // Add payroll to distribution chart (only if not admin_level_1)
  const distributionData = stats ? [
    ...stats.expensesByCategory,
    ...(user?.role === 'admin' ? [{ name: 'Masse Salariale', total: stats.totalPayroll }] : [])
  ] : [];

  const cards = stats ? [
    { 
      name: 'Dépenses approuvées', 
      value: `${stats.totalExpenses.toLocaleString()} €`, 
      icon: Receipt, 
      color: 'bg-blue-500',
      sub: `${stats.stats?.approved || 0} demandes`
    },
    ...(user?.role === 'admin' ? [{ 
      name: 'Masse salariale mensuelle', 
      value: `${stats.totalPayroll.toLocaleString()} €`, 
      icon: Users, 
      color: 'bg-green-500',
      sub: 'Fixe'
    }] : []),
    { 
      name: 'Total mensuel estimé', 
      value: `${(stats.totalExpenses + stats.totalPayroll).toLocaleString()} €`, 
      icon: TrendingUp, 
      color: 'bg-purple-500',
      sub: 'Approuvé + Payroll'
    },
  ] : [];

  const toggleCategory = (id: string) => {
    setSelectedCategories(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Tableau de Bord</h2>
          <p className="text-sm text-gray-500">Bienvenue, {user?.email}</p>
        </div>
        <div className="flex items-center space-x-3">
          <label className="text-sm font-medium text-gray-700">Filtrer par mois:</label>
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="border rounded p-2 text-sm bg-white"
          >
            <option value="">Tous les mois</option>
            {getMonthOptions().map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className={`grid grid-cols-1 gap-5 sm:grid-cols-${cards.length}`}>
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.name} className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className={`flex-shrink-0 rounded-md p-3 ${card.color}`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">{card.name}</dt>
                      <dd className="text-lg font-semibold text-gray-900">{card.value}</dd>
                      <dd className="text-xs text-gray-400">{card.sub}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pending/Rejected Summary */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-yellow-800">Demandes en cours</p>
            <p className="text-2xl font-bold text-yellow-900">{stats?.stats?.pending || 0}</p>
          </div>
          <Link to="/expenses" className="text-yellow-700 hover:text-yellow-900">
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-red-800">Demandes refusées</p>
            <p className="text-2xl font-bold text-red-900">{stats?.stats?.rejected || 0}</p>
          </div>
          <Link to="/expenses" className="text-red-700 hover:text-red-900">
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* Comparison Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex flex-col mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <Calendar className="mr-2 h-5 w-5 text-blue-500" />
              Comparaison Mensuelle
            </h3>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex bg-gray-100 p-1 rounded-md">
                <button
                  onClick={() => setComparisonType('total')}
                  className={`px-3 py-1 text-xs font-medium rounded ${comparisonType === 'total' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                >
                  Total
                </button>
                <button
                  onClick={() => setComparisonType('category')}
                  className={`px-3 py-1 text-xs font-medium rounded ${comparisonType === 'category' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                >
                  Familles
                </button>
                <button
                  onClick={() => setComparisonType('subcategory')}
                  className={`px-3 py-1 text-xs font-medium rounded ${comparisonType === 'subcategory' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                >
                  Sous-Familles
                </button>
              </div>
              <div className="flex items-center space-x-2">
                <select
                  value={monthsToCompare[0] || ''}
                  onChange={(e) => setMonthsToCompare([e.target.value, monthsToCompare[1]])}
                  className="border rounded p-1 text-sm bg-white"
                >
                  {getMonthOptions().map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <span className="text-gray-400">vs</span>
                <select
                  value={monthsToCompare[1] || ''}
                  onChange={(e) => setMonthsToCompare([monthsToCompare[0], e.target.value])}
                  className="border rounded p-1 text-sm bg-white"
                >
                  {getMonthOptions().map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {(comparisonType === 'category' || comparisonType === 'subcategory') && (
            <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs font-medium text-gray-500 w-full mb-1">Filtrer par familles :</p>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id.toString())}
                  className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                    selectedCategories.includes(cat.id.toString())
                      ? 'bg-blue-100 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
              {selectedCategories.length > 0 && (
                <button
                  onClick={() => setSelectedCategories([])}
                  className="px-2 py-1 text-xs text-red-600 hover:underline"
                >
                  Réinitialiser
                </button>
              )}
            </div>
          )}
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis tickFormatter={(val) => `${val} €`} />
              <Tooltip formatter={(val) => `${val.toLocaleString()} €`} />
              <Legend />
              {monthsToCompare.map((month, index) => (
                <Bar key={month} dataKey={month} fill={COLORS[index % COLORS.length]} name={month} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Chart: Expenses by Category + Payroll */}
        <div className="bg-white p-6 shadow rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Répartition globale (Approuvé + Payroll)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="total"
                >
                  {distributionData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val) => `${val.toLocaleString()} €`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white shadow rounded-lg">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Activités récentes</h3>
            <Link to="/expenses" className="text-sm text-blue-600 hover:text-blue-500 flex items-center">
              Voir tout <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
          <div className="flow-root">
            <ul className="divide-y divide-gray-200">
              {stats?.recentExpenses.map((expense: any) => (
                <li key={expense.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center space-x-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {expense.description || 'Sans description'}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {expense.category_name} {expense.sub_category_name ? `(${expense.sub_category_name})` : ''} • {new Date(expense.date).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        expense.status === 'approved' ? 'bg-green-100 text-green-800' :
                        expense.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {expense.amount.toLocaleString()} €
                      </span>
                    </div>
                  </div>
                </li>
              ))}
              {(!stats || stats.recentExpenses.length === 0) && (
                <li className="p-4 text-center text-gray-500 text-sm">Aucune dépense récente</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
