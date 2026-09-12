import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Users, BookOpen, BookCheck, AlertTriangle, DollarSign, TrendingUp, Clock, ArrowUpRight } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { requestJson } from "@/lib/api";

function fmt(d: string) { if (!d) return ""; return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }

export function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Record<string, number>>({});
  const [recentIssues, setRecentIssues] = useState<any[]>([]);
  const [recentFines, setRecentFines] = useState<any[]>([]);

  useEffect(() => {
    requestJson('/api/dashboard/recent-issues').then((rows) => {
      const safe = Array.isArray(rows) ? rows : [];
      setRecentIssues(safe.map((r: any) => ({ id: r.registration_no, name: r.name, book: r.book, dueDate: fmt(r.due_date), status: r.status })));
    }).catch(() => setRecentIssues([]));
  }, []);
  useEffect(() => { requestJson('/api/dashboard/recent-fines').then((rows) => setRecentFines(Array.isArray(rows) ? rows : [])).catch(() => setRecentFines([])); }, []);

  const statsCards = [
    { label: "Total Students", value: (stats.totalStudents ?? 0).toLocaleString(), icon: Users, bg: "bg-blue-50", textColor: "text-blue-600" },
    { label: "Total Books", value: (stats.totalBooks ?? 0).toLocaleString(), icon: BookOpen, bg: "bg-purple-50", textColor: "text-purple-600" },
    { label: "Issued Books", value: (stats.issuedBooks ?? 0).toLocaleString(), icon: BookCheck, bg: "bg-emerald-50", textColor: "text-emerald-600" },
    { label: "Overdue Books", value: (stats.overdueBooks ?? 0).toLocaleString(), icon: AlertTriangle, bg: "bg-red-50", textColor: "text-red-600" },
    { label: "Total Fines", value: `PKR ${(stats.totalFines ?? 0).toLocaleString()}`, icon: DollarSign, bg: "bg-yellow-50", textColor: "text-yellow-600" },
  ];

  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const load = () => {
      setLoadError(''); setLoading(true);
      Promise.all([requestJson('/api/dashboard/stats'), requestJson('/api/dashboard/monthly')])
        .then(([stats, monthly]) => { setStats(stats); setMonthlyData(monthly); })
        .catch(e => setLoadError(e.message)).finally(() => setLoading(false));
    };
    load(); window.addEventListener('catalog-updated', load);
    return () => window.removeEventListener('catalog-updated', load);
  }, []);

  return (
    <div className="p-6 space-y-6">
      {loadError && <p role="alert" className="p-3 bg-red-50 text-red-700 rounded">{loadError}</p>}
      <button onClick={() => navigate("/students")} className="text-sm text-blue-700 underline">View all students and import records</button>
      <div className="flex items-center justify-between">
        <div><h1 className="text-gray-800">Dashboard Overview</h1><p className="text-sm text-gray-500 mt-0.5">Welcome back! Here is what is happening in the library.</p></div>
        <div className="text-right"><p className="text-sm text-gray-500">Current Year</p><p className="text-sm font-semibold text-blue-700">{new Date().getFullYear()}</p></div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {statsCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3"><div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}><Icon size={20} className={card.textColor} /></div></div>
              <p className="text-2xl font-bold text-gray-800">{loadError || loading ? "—" : card.value}</p><p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="mb-4"><h3 className="text-gray-800">Book Issue Trends</h3><p className="text-xs text-gray-400">Monthly issued vs returned books</p></div>
          <ResponsiveContainer width="100%" height={200}><AreaChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} /><Tooltip /><Area type="monotone" dataKey="issued" stroke="#3B82F6" strokeWidth={2} fillOpacity={0.1} fill="#3B82F6" /><Area type="monotone" dataKey="returned" stroke="#8B5CF6" strokeWidth={2} fillOpacity={0.1} fill="#8B5CF6" /></AreaChart></ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="mb-4"><h3 className="text-gray-800">Monthly Fines</h3><p className="text-xs text-gray-400">Fine amounts (PKR)</p></div>
          <ResponsiveContainer width="100%" height={200}><BarChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} /><Tooltip formatter={(v: number) => [`PKR ${v.toLocaleString()}`, "Fines"]} /><Bar dataKey="fines" fill="#1F3A8A" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between"><h3 className="text-gray-800">Recent Book Issues</h3><button onClick={() => navigate("/issued-students")} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">View all <ArrowUpRight size={12} /></button></div>
          <div className="overflow-x-auto"><table className="w-full"><thead><tr className="bg-gray-50"><th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Roll No.</th><th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Student</th><th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Book</th><th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Due Date</th><th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th></tr></thead><tbody className="divide-y divide-gray-50">{recentIssues.map((row) => <tr key={`${row.id}-${row.book}`} className="hover:bg-gray-50 transition-colors"><td className="px-5 py-3 text-xs font-mono text-gray-600">{row.id}</td><td className="px-5 py-3 text-sm font-medium text-gray-800">{row.name}</td><td className="px-5 py-3 text-xs text-gray-500 hidden md:table-cell max-w-[160px] truncate">{row.book}</td><td className="px-5 py-3 text-xs text-gray-500 hidden lg:table-cell"><span className="flex items-center gap-1"><Clock size={11} className="text-gray-400" /> {row.dueDate}</span></td><td className="px-5 py-3"><span className={`text-xs font-semibold px-2 py-1 rounded-full ${row.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>{row.status}</span></td></tr>)}</tbody></table></div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100"><h3 className="text-gray-800">Recent Fine Activity</h3></div>
          <div className="divide-y divide-gray-50">{recentFines.map((f) => <div key={f.id} className="px-4 py-3 hover:bg-gray-50 transition-colors"><div className="flex justify-between items-center"><div><p className="text-sm font-medium text-gray-800">{f.name}</p><p className="text-xs text-gray-400">{f.reason} · <span className={f.type === "Auto" ? "text-purple-500" : "text-orange-500"}>{f.type}</span></p></div><div className="text-right"><p className="text-sm font-bold text-gray-700">{f.amount}</p><span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${f.status === "Sent" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>{f.status}</span></div></div></div>)}</div>
        </div>
      </div>
    </div>
  );
}
