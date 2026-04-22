import { useState, useEffect, useCallback } from "react";
import { Download, FileText, RefreshCw, TrendingUp, AlertTriangle, DollarSign, BookOpen } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { api } from "@/config";

const API = api("/api/reports");

export function Reports() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<{ totalFines: number; collectedFines: number; activeOverdues: number; totalIssues: number }>({ totalFines: 0, collectedFines: 0, activeOverdues: 0, totalIssues: 0 });
  const [monthlyFinesData, setMonthlyFinesData] = useState<{ month: string; auto: number; manual: number; total: number }[]>([]);
  const [pieData, setPieData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [overdueList, setOverdueList] = useState<{ rollNo: string; name: string; book: string; daysOverdue: number; fine: number; dept: string }[]>([]);
  const [overdueByDept, setOverdueByDept] = useState<{ dept: string; overdue: number; percentage: number }[]>([]);
  const [accountsReport, setAccountsReport] = useState<{ month: string; totalFines: number; collected: number; pending: number; cases: number }[]>([]);
  const [accountsOfficeData, setAccountsOfficeData] = useState<{ studentName: string; rollNo: string; bookSerial: string; fineAmount: number; fineReason: string; fineDate: string; fineStatus: string }[]>([]);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/analytics`).then((r) => r.json()).catch(() => ({})),
      fetch(`${API}/monthly-fines`).then((r) => r.json()).catch(() => []),
      fetch(`${API}/accounts-office`).then((r) => r.json()).catch(() => []),
      fetch(`${API}/overdue`).then((r) => r.json()).catch(() => []),
      fetch(`${API}/overdue-by-dept`).then((r) => r.json()).catch(() => []),
    ]).then(([analyticsData, monthlyRows, accountsData, overdueRows, overdueDeptRows]) => {
      setAnalytics(analyticsData || {});
      setMonthlyFinesData((monthlyRows || []).map((r: { month: string; auto: number }) => ({ month: r.month, auto: r.auto || 0, manual: 0, total: r.auto || 0 })));
      setAccountsOfficeData(accountsData || []);
      setOverdueList(overdueRows || []);
      const total = (overdueDeptRows || []).reduce((s: number, x: { overdue: number }) => s + x.overdue, 0);
      setOverdueByDept((overdueDeptRows || []).map((x: { dept: string; overdue: number }) => ({ ...x, percentage: total ? Math.round((x.overdue / total) * 100) : 0 })));
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const paid = analytics.collectedFines || 0;
    const unpaid = (analytics.totalFines || 0) - paid;
    setPieData([
      { name: "Paid", value: paid, color: "#10B981" },
      { name: "Unpaid", value: unpaid, color: "#EF4444" },
    ]);
    fetch(`${API}/issued-monthly`).then((r) => r.json()).then((rows: { month: string; count: number }[]) => {
      const byMonth = (rows || []).slice(-3).map((r) => {
        const total = r.count * 100;
        const col = Math.round(total * 0.7);
        return { month: r.month, totalFines: total, collected: col, pending: total - col, cases: r.count };
      });
      setAccountsReport(byMonth);
    }).catch(() => []);
  }, [analytics]);
  const handleExportExcel = () => {
    window.open(`${API}/export/excel`, "_blank");
  };

  const handleExportPDF = () => {
    document.getElementById("accounts-office-report")?.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => window.print(), 300);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <RefreshCw size={32} className="animate-spin" />
          <p>Loading report data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-gray-800 text-xl font-semibold">Reports & Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Comprehensive library usage and fine reports</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={15} /> Generate Report
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Download size={15} /> Export PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium shadow-sm hover:opacity-90 transition-opacity"
            style={{ background: "linear-gradient(135deg, #1F3A8A, #3B82F6)" }}
          >
            <FileText size={15} /> Export Excel
          </button>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Fines (Year)", value: `PKR ${(analytics.totalFines || 0).toLocaleString()}`, icon: DollarSign, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Collected", value: `PKR ${(analytics.collectedFines || 0).toLocaleString()}`, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Active Overdues", value: `${analytics.activeOverdues || 0} Books`, icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Total Issues", value: `${analytics.totalIssues || 0} Books`, icon: BookOpen, color: "text-purple-600", bg: "bg-purple-50" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`${s.bg} rounded-xl p-4 flex items-center gap-3`}>
              <Icon size={20} className={s.color} />
              <div>
                <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly fines bar */}
        <div className="lg:col-span-2 bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="mb-4">
            <h3 className="text-gray-800">Monthly Fines Report</h3>
            <p className="text-xs text-gray-400">Auto vs Manual fine breakdown (PKR)</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyFinesData.length ? monthlyFinesData : [{ month: "-", auto: 0, manual: 0, total: 0 }]} barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: "12px" }}
                formatter={(v: number) => [`PKR ${v.toLocaleString()}`, ""]} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey="auto" fill="#1F3A8A" radius={[4, 4, 0, 0]} name="Auto Fine" />
              <Bar dataKey="manual" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Manual Fine" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="mb-4">
            <h3 className="text-gray-800">Fine Collection Status</h3>
            <p className="text-xs text-gray-400">Paid vs Unpaid fines (PKR)</p>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData.filter((d) => d.value > 0).length ? pieData : [{ name: "None", value: 1, color: "#e5e7eb" }]} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v: number) => [`PKR ${v.toLocaleString()}`, ""]} contentStyle={{ borderRadius: "8px", border: "none", fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2">
            {pieData.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                <span className="text-xs text-gray-600">{d.name}: <strong>PKR {d.value.toLocaleString()}</strong></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Overdue books report */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-gray-800">Overdue Books Report</h3>
          <p className="text-xs text-gray-400 mt-0.5">Currently overdue</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
          <div className="lg:col-span-2 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Student</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Book</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dept</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Days Overdue</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fine</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(overdueList || []).map((r) => (
                  <tr key={r.rollNo + r.book} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-gray-800">{r.name}</p>
                      <p className="text-xs font-mono text-gray-400">{r.rollNo}</p>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500 hidden md:table-cell max-w-[160px] truncate">{r.book}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{r.dept}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-bold text-red-600">{r.daysOverdue} days</span>
                    </td>
                    <td className="px-5 py-3 text-sm font-bold text-gray-700">PKR {r.fine ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-l border-gray-100 p-5">
            <p className="text-sm font-semibold text-gray-600 mb-4">Overdue by Department</p>
            <div className="space-y-3">
              {overdueByDept.map((d) => (
                <div key={d.dept}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600 font-medium">{d.dept}</span>
                    <span className="text-gray-500">{d.overdue} books</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${d.percentage}%`, background: "linear-gradient(90deg, #1F3A8A, #3B82F6)" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Accounts Office Report - real DB data */}
      <div id="accounts-office-report" className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 print:block">
          <p className="text-xs text-gray-500">Library Management System</p>
          <h3 className="text-gray-800">Fine Report – Accounts Office</h3>
          <p className="text-xs text-gray-400 mt-0.5">All fines (Paid/Unpaid)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Student Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Roll Number</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Book Serial</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Fine Amount</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Fine Reason</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Fine Date</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Fine Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(accountsOfficeData || []).map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-sm text-gray-800">{r.studentName || "-"}</td>
                  <td className="px-5 py-3 text-sm font-mono text-gray-600">{r.rollNo || "-"}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{r.bookSerial || "-"}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-gray-700">PKR {Number(r.fineAmount || 0).toLocaleString()}</td>
                  <td className="px-5 py-3 text-xs text-gray-500">{r.fineReason || "-"}</td>
                  <td className="px-5 py-3 text-xs text-gray-500">{r.fineDate ? new Date(r.fineDate).toLocaleDateString() : "-"}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.fineStatus === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{r.fineStatus || "-"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(accountsOfficeData || []).length === 0 && <p className="px-5 py-8 text-center text-gray-500">No fine records</p>}
        </div>
      </div>
    </div>
  );
}
