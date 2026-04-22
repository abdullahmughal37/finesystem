import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Users, BookOpen, BookCheck, AlertTriangle, DollarSign, TrendingUp, Clock, ArrowUpRight } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from "recharts";
import { api } from "@/config";

const API = api("/api");

function fmt(d: string) {
  if (!d) return "";
  const x = new Date(d);
  return x.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Record<string, number>>({});
  const [monthlyData, setMonthlyData] = useState<{ month: string; issued: number; returned: number; fines: number }[]>([]);
  const [recentIssues, setRecentIssues] = useState<{ id: string; name: string; book: string; issueDate: string; dueDate: string; status: string }[]>([]);
  const [overdueBooks, setOverdueBooks] = useState<{ id: string; name: string; book: string; daysOverdue: number; fine: string }[]>([]);
  const [recentFines, setRecentFines] = useState<{ id: string; name: string; amount: string; reason: string; type: string; status: string }[]>([]);

  useEffect(() => {
    fetch(`${API}/dashboard/stats`).then((r) => r.json()).then(setStats).catch(() => {});
  }, []);
  useEffect(() => {
    fetch(`${API}/dashboard/monthly-trends`).then((r) => r.json()).then(setMonthlyData).catch(() => []);
  }, []);
  useEffect(() => {
    fetch(`${API}/dashboard/recent-issues`).then((r) => r.json()).then((rows: { rollNo: string; name: string; book: string; issue_date: string; due_date: string; status: string }[]) => {
      setRecentIssues((rows || []).map((r) => ({
        id: r.rollNo,
        name: r.name,
        book: r.book,
        issueDate: fmt(r.issue_date),
        dueDate: fmt(r.due_date),
        status: r.status,
      })));
    }).catch(() => []);
  }, []);
  useEffect(() => {
    fetch(`${API}/dashboard/overdue`).then((r) => r.json()).then((rows: { id: string; name: string; book: string; daysOverdue: number; fine: number }[]) => {
      setOverdueBooks((rows || []).map((r) => ({
        ...r,
        fine: `PKR ${r.fine || 0}`,
      })));
    }).catch(() => []);
  }, []);
  useEffect(() => {
    fetch(`${API}/dashboard/recent-fines`).then((r) => r.json()).then(setRecentFines).catch(() => []);
  }, []);

  const statsCards = [
    { label: "Total Students", value: (stats.totalStudents ?? 0).toLocaleString(), change: "", icon: Users, color: "from-blue-500 to-blue-600", bg: "bg-blue-50", textColor: "text-blue-600" },
    { label: "Total Books", value: (stats.totalBooks ?? 0).toLocaleString(), change: "", icon: BookOpen, color: "from-purple-500 to-purple-600", bg: "bg-purple-50", textColor: "text-purple-600" },
    { label: "Issued Books", value: (stats.issuedBooks ?? 0).toLocaleString(), change: "", icon: BookCheck, color: "from-emerald-500 to-emerald-600", bg: "bg-emerald-50", textColor: "text-emerald-600" },
    { label: "Overdue Books", value: (stats.studentsWithFines ?? 0).toLocaleString(), change: "", icon: AlertTriangle, color: "from-orange-500 to-red-500", bg: "bg-red-50", textColor: "text-red-600" },
    { label: "Total Fines", value: `PKR ${(stats.totalFines ?? 0).toLocaleString()}`, change: "", icon: DollarSign, color: "from-yellow-400 to-orange-500", bg: "bg-yellow-50", textColor: "text-yellow-600" },
  ];
  return (
    <div className="p-6 space-y-6">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-800">Dashboard Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">Welcome back! Here's what's happening in the library today.</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Academic Year</p>
          <p className="text-sm font-semibold text-blue-700">2025 – 2026</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {statsCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}>
                  <Icon size={20} className={card.textColor} />
                </div>
                {card.change && (
                <span className={`text-xs font-semibold flex items-center gap-0.5 ${card.change.startsWith("+") ? "text-emerald-600" : "text-red-500"}`}>
                  <TrendingUp size={11} />
                  {card.change}
                </span>
              )}
              </div>
              <p className="text-2xl font-bold text-gray-800">{card.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Issue trend */}
        <div className="lg:col-span-2 bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-gray-800">Book Issue Trends</h3>
              <p className="text-xs text-gray-400">Monthly issued vs returned books</p>
            </div>
            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-md font-medium">Aug 2025 – Mar 2026</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyData.length ? monthlyData : [{ month: "-", issued: 0, returned: 0, fines: 0 }]}>
              <defs>
                <linearGradient id="issued" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="returned" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: "12px" }} />
              <Area type="monotone" dataKey="issued" stroke="#3B82F6" strokeWidth={2} fill="url(#issued)" name="Issued" />
              <Area type="monotone" dataKey="returned" stroke="#8B5CF6" strokeWidth={2} fill="url(#returned)" name="Returned" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly fines */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="mb-4">
            <h3 className="text-gray-800">Monthly Fines</h3>
            <p className="text-xs text-gray-400">Auto-generated fine amounts (PKR)</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData.length ? monthlyData.slice(-5) : [{ month: "-", fines: 0 }]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: "12px" }}
                formatter={(v: number) => [`PKR ${v.toLocaleString()}`, "Fines"]} />
              <Bar dataKey="fines" fill="#1F3A8A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tables row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Issues */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-gray-800">Recent Book Issues</h3>
            <button
              onClick={() => navigate("/issued-students")}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              View all <ArrowUpRight size={12} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Roll No.</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Student</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Book</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Due Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentIssues.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-xs font-mono text-gray-600">{row.id}</td>
                    <td className="px-5 py-3 text-sm font-medium text-gray-800">{row.name}</td>
                    <td className="px-5 py-3 text-xs text-gray-500 hidden md:table-cell max-w-[160px] truncate">{row.book}</td>
                    <td className="px-5 py-3 text-xs text-gray-500 hidden lg:table-cell">
                      <span className="flex items-center gap-1">
                        <Clock size={11} className="text-gray-400" /> {row.dueDate}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        row.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
                      }`}>{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Overdue */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-gray-800">Overdue Books</h3>
              <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center">{overdueBooks.length}</span>
            </div>
            <div className="divide-y divide-gray-50">
              {overdueBooks.map((item) => (
                <div key={item.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{item.name}</p>
                      <p className="text-xs text-gray-400 truncate max-w-[140px]">{item.book}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-red-600">{item.fine}</p>
                      <p className="text-xs text-gray-400">{item.daysOverdue}d overdue</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent fines */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-gray-800">Recent Fine Activity</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {recentFines.map((f) => (
                <div key={f.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{f.name}</p>
                      <p className="text-xs text-gray-400">{f.reason} · <span className={f.type === "Auto" ? "text-purple-500" : "text-orange-500"}>{f.type}</span></p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-700">{f.amount}</p>
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                        f.status === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
                      }`}>{f.status}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
