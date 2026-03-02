import React, { useEffect, useState } from 'react';
import { fetchApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
// AJOUT DE CHEVRON POUR L'ACCORDÉON
import { TrendingUp, Users, Receipt, Calendar, RefreshCw, Filter, Shield, ChevronDown, ChevronRight, Layers } from 'lucide-react';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

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

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 25;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#4B5563" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-[11px] font-bold">
      {`${name} (${(percent * 100).toFixed(0)}%)`}
    </text>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState('');
  
  const [monthsToCompare, setMonthsToCompare] = useState<string[]>([]);
  const [comparisonType, setComparisonType] = useState<'category' | 'total' | 'payroll'>('total');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [isComparing, setIsComparing] = useState(false);

  // --- NOUVEL ÉTAT POUR L'ACCORDÉON ---
  const [expandedCats, setExpandedCats] = useState<string[]>([]);

  const isManager = user?.role === 'admin' || user?.role === 'admin_level_1';

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([
        fetchApi(filterMonth ? `/api/dashboard?month=${filterMonth}` : '/api/dashboard'),
        fetchApi('/api/categories')
      ]);
      setStats(s);
      setCategories(c);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [filterMonth]);

  useEffect(() => {
    const now = new Date();
    const m1 = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const m2 = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;
    setMonthsToCompare([m2, m1]);
  }, []);

  const handleRunComparison = async () => {
    setIsComparing(true);
    try {
      const catParam = selectedCategories.length > 0 ? `&categories=${selectedCategories.join(',')}` : '';
      const data = await fetchApi(`/api/dashboard/comparison?months=${monthsToCompare.join(',')}&type=${comparisonType}${catParam}`);
      setComparisonData(data);
    } catch (err) { console.error(err); }
    finally { setIsComparing(false); }
  };

  // --- LOGIQUE POUR DÉROULER/FERMER ---
  const toggleCat = (name: string) => {
    setExpandedCats(prev => prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]);
  };

  let chartData: any[] = [];
  if (comparisonData) {
    const labels = new Set<string>();
    Object.values(comparisonData).forEach((m: any) => m.forEach((d: any) => labels.add(d.label)));
    chartData = Array.from(labels).map(label => {
      const row: any = { label };
      monthsToCompare.forEach(m => {
        const found = comparisonData[m]?.find((d: any) => d.label === label);
        row[m] = found ? found.total : 0;
      });
      return row;
    });
  }

  const distributionData = stats ? [
    ...stats.expensesByCategory,
    ...(isManager ? [{ name: 'Masse Salariale', total: stats.totalPayroll }] : [])
  ] : [];

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Vue d'ensemble</h2>
          {user?.role === 'admin_level_1' && <p className="text-xs text-indigo-600 font-bold uppercase tracking-widest mt-1 flex items-center gap-1"><Shield size={12}/> Mode Manager</p>}
        </div>
        <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="border rounded-lg p-1.5 text-sm font-bold bg-gray-50">
          <option value="">Cumul Global</option>
          {getMonthOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-500 flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-lg"><Receipt className="text-blue-600" /></div>
          <div><p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{isManager ? 'Dépenses Entreprise' : 'Mes Dépenses'}</p><p className="text-2xl font-black text-gray-800">{stats?.totalExpenses.toLocaleString()} €</p></div>
        </div>
        
        {isManager && (
          <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-green-500 flex items-center gap-4">
            <div className="p-3 bg-green-50 rounded-lg"><Users className="text-green-600" /></div>
            <div><p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Masse Salariale</p><p className="text-2xl font-black text-gray-800">{stats?.totalPayroll.toLocaleString()} €</p></div>
          </div>
        )}

        {isManager && (
          <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-indigo-500 flex items-center gap-4">
            <div className="p-3 bg-indigo-50 rounded-lg"><TrendingUp className="text-indigo-600" /></div>
            <div><p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Réel</p><p className="text-2xl font-black text-gray-800">{(stats ? stats.totalExpenses + stats.totalPayroll : 0).toLocaleString()} €</p></div>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-4 mb-6">
          <h3 className="text-lg font-bold flex items-center gap-2"><Calendar className="text-indigo-500" /> Analyse Comparative</h3>
          <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
            <button onClick={() => setComparisonType('total')} className={`px-4 py-2 rounded-lg text-xs font-bold ${comparisonType === 'total' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>{isManager ? 'Total Réel' : 'Vue Globale'}</button>
            <button onClick={() => setComparisonType('category')} className={`px-4 py-2 rounded-lg text-xs font-bold ${comparisonType === 'category' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Par Famille</button>
            {isManager && (
              <button onClick={() => setComparisonType('payroll')} className={`px-4 py-2 rounded-lg text-xs font-bold ${comparisonType === 'payroll' ? 'bg-white shadow text-green-600' : 'text-gray-500'}`}>Salaires</button>
            )}
          </div>
          <button onClick={handleRunComparison} className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-bold shadow-lg flex items-center gap-2">
            <RefreshCw className={isComparing ? 'animate-spin' : ''} size={16} /> Actualiser
          </button>
        </div>

        {comparisonType === 'category' && (
          <div className="mb-6 flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs font-bold text-gray-400 w-full mb-1">Filtrer par familles :</p>
            {categories.map(c => (
              <button key={c.id} onClick={() => setSelectedCategories(prev => prev.includes(c.id.toString()) ? prev.filter(x => x !== c.id.toString()) : [...prev, c.id.toString()])} className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${selectedCategories.includes(c.id.toString()) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:border-blue-400'}`}>{c.name}</button>
            ))}
          </div>
        )}

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{fontSize: 11, fontWeight: 'bold'}} />
              <YAxis tickFormatter={(v) => `${v.toLocaleString()} €`} tick={{fontSize: 11}} axisLine={false} />
              <Tooltip cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
              <Legend verticalAlign="top" height={36}/>
              {monthsToCompare.map((m, i) => <Bar key={m} dataKey={m} name={m} fill={COLORS[i % COLORS.length]} radius={[6, 6, 0, 0]} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-6 uppercase text-xs tracking-widest text-center">Répartition des Coûts (%)</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={distributionData} cx="50%" cy="50%" innerRadius={65} outerRadius={95} paddingAngle={5} dataKey="total" label={renderCustomLabel}>
                  {distributionData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />)}
                </Pie>
                <Tooltip formatter={(v: any) => `${v.toLocaleString()} €`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center text-center">
            <div className="p-8 bg-indigo-50/50 rounded-3xl border border-indigo-100">
              <TrendingUp className="text-indigo-600 mb-3 mx-auto" size={32} />
              <h4 className="font-black text-gray-800 text-lg uppercase tracking-tight">Analyse de Performance</h4>
              <p className="text-sm text-gray-600 mt-3 leading-relaxed font-medium">
                {isManager ? 
                 "Vous accédez à la vue complète incluant les charges de personnel et les dépenses opérationnelles globales." : 
                 "Vous suivez ici l'évolution de vos demandes de frais personnels approuvées."}
              </p>
            </div>
        </div>
      </div>

      {/* --- NOUVELLE SECTION : HIÉRARCHIE FAMILLES ET SOUS-FAMILLES --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
          <Layers size={18} className="text-indigo-500" />
          <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wider">Détails des Sous-Familles</h3>
        </div>
        
        <div className="divide-y divide-gray-100">
          {stats?.expensesByCategory?.map((cat: any) => (
            <div key={cat.name} className="transition-all">
              <button 
                onClick={() => toggleCat(cat.name)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1 rounded transition-colors ${expandedCats.includes(cat.name) ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
                    {expandedCats.includes(cat.name) ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                  </div>
                  <span className="font-bold text-gray-800 text-sm">{cat.name}</span>
                </div>
                <span className="font-black text-indigo-600">{cat.total.toLocaleString()} €</span>
              </button>
              
              {expandedCats.includes(cat.name) && cat.subFamilies && (
                <div className="bg-indigo-50/30 px-12 py-3 space-y-2 border-t border-indigo-50">
                  {Object.entries(cat.subFamilies).map(([subName, subTotal]: any) => (
                    <div key={subName} className="flex justify-between items-center text-xs py-1 border-b border-gray-100 last:border-0">
                      <span className="text-gray-600 font-semibold">{subName}</span>
                      <span className="font-bold text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-100 shadow-sm">
                        {subTotal.toLocaleString()} €
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}