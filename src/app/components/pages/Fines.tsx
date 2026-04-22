import { useState, useEffect } from "react";
import { Search, Download, Plus, ChevronDown, ChevronLeft, ChevronRight, DollarSign, AlertCircle, CheckCircle, Clock, Send } from "lucide-react";
import axios from "axios";
import { api } from "@/config";

const API = api("/api/fines");

const FINE_REASONS = ["Noise in library", "Late book return", "Damaged book", "Lost book", "Other"];

function GenFineModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [rollNo, setRollNo] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("Noise in library");
  const [customReason, setCustomReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!rollNo.trim() || !amount || Number(amount) < 1) {
      setError("Roll number and valid amount required");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/create`, {
        rollNo: rollNo.trim(),
        serialNo: serialNo.trim() || undefined,
        fine_amount: Number(amount),
        reason: reason === "Other" ? customReason.trim() || "Other" : reason,
      });
      if (res.data?.success) onSuccess();
      else setError(res.data?.error || "Failed");
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-gray-800">Generate Manual Fine</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Student Roll Number</label>
            <input value={rollNo} onChange={(e) => setRollNo(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 font-mono" placeholder="FA21-BCS-001" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Book Serial (optional)</label>
            <input value={serialNo} onChange={(e) => setSerialNo(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 font-mono" placeholder="SN-CS-001" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fine Amount (PKR)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" placeholder="500" min="1" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <div className="relative">
              <select value={reason} onChange={(e) => setReason(e.target.value)} className="appearance-none w-full px-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white">
                {FINE_REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
          {reason === "Other" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Custom Reason</label>
              <input value={customReason} onChange={(e) => setCustomReason(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Enter reason" />
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="px-5 py-2 rounded-lg text-sm text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-70" style={{ background: "linear-gradient(135deg, #1F3A8A, #3B82F6)" }}>Generate Fine</button>
        </div>
      </div>
    </div>
  );
}

type FineRow = { id: number; rollNo: string; name: string; amount: number; reason: string; type: string; status: string; date: string; bookTitle?: string };

export function Fines() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [showGenModal, setShowGenModal] = useState(false);
  const [page, setPage] = useState(1);
  const [unsentFines, setUnsentFines] = useState<FineRow[]>([]);
  const [sentFines, setSentFines] = useState<FineRow[]>([]);
  const [sending, setSending] = useState(false);
  const perPage = 7;

  const loadFines = () => {
    fetch(`${API}/unsent`).then((r) => r.json()).then((rows) => setUnsentFines(rows || [])).catch(() => []);
    fetch(`${API}/sent`).then((r) => r.json()).then((rows) => setSentFines(rows || [])).catch(() => []);
  };
  useEffect(loadFines, []);

  const mapFine = (f: { id?: number; rollNo: string; name: string; fine_amount?: number; days_late?: number; created_at?: string; bookTitle?: string; status: string }) => ({
    id: f.id || 0,
    rollNo: f.rollNo,
    name: f.name,
    amount: Number(f.fine_amount) || 0,
    reason: `Overdue – ${f.days_late ?? 0} days`,
    type: "Auto",
    status: f.status === "sent" ? "Paid" : "Unpaid",
    date: f.created_at ? new Date(f.created_at).toISOString().slice(0, 10) : "",
    bookTitle: f.bookTitle,
  });
  const allFines: FineRow[] = [
    ...unsentFines.map((f) => mapFine({ ...f, status: "unsent" })),
    ...sentFines.map((f) => mapFine({ ...f, status: "sent" })),
  ].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const handleSendToAccount = async () => {
    setSending(true);
    try {
      await axios.post(`${API}/send-to-account`);
      loadFines();
    } finally {
      setSending(false);
    }
  };

  const filtered = allFines.filter((f) => {
    const q = search.toLowerCase();
    const matchSearch = f.name.toLowerCase().includes(q) || f.rollNo.toLowerCase().includes(q) || String(f.id).includes(q);
    const matchStatus = statusFilter === "All" || f.status === statusFilter;
    const matchType = typeFilter === "All" || f.type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const totalFines = allFines.reduce((a, f) => a + (Number(f.amount) || 0), 0);
  const paidFines = allFines.filter(f => f.status === "Paid").reduce((a, f) => a + (Number(f.amount) || 0), 0);
  const unpaidFines = allFines.filter(f => f.status === "Unpaid").reduce((a, f) => a + (Number(f.amount) || 0), 0);

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-gray-800">Fines Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track and manage student library fines</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSendToAccount}
            disabled={sending || unsentFines.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #059669, #10B981)" }}
          >
            <Send size={15} /> Send to Account Office
          </button>
          <button
            onClick={() => window.open(api("/api/fines/export/csv"), "_blank")}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Download size={15} /> Export CSV
          </button>
          <button
            onClick={() => setShowGenModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium shadow-sm hover:opacity-90 transition-opacity"
            style={{ background: "linear-gradient(135deg, #1F3A8A, #3B82F6)" }}
          >
            <Plus size={15} /> Generate Fine
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Fines", value: `PKR ${totalFines.toLocaleString()}`, icon: DollarSign, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Collected", value: `PKR ${paidFines.toLocaleString()}`, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Pending", value: `PKR ${unpaidFines.toLocaleString()}`, icon: Clock, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Unpaid Cases", value: allFines.filter(f => f.status === "Unpaid").length, icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`${s.bg} rounded-xl p-4 flex items-center gap-3`}>
              <Icon size={20} className={s.color} />
              <div>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by student name or roll number..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {["All", "Paid", "Unpaid"].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-2 text-xs font-medium transition-colors ${statusFilter === s ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >{s}</button>
          ))}
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {["All", "Auto", "Manual"].map((t) => (
            <button
              key={t}
              onClick={() => { setTypeFilter(t); setPage(1); }}
              className={`px-3 py-2 text-xs font-medium transition-colors ${typeFilter === t ? "bg-purple-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >{t}</button>
          ))}
        </div>
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} records</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fine ID</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Roll No.</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Student Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Amount</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Reason</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Date</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginated.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-5 py-3.5 text-xs font-mono text-gray-500">{f.id}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">{f.rollNo}</span>
                  </td>
                  <td className="px-5 py-3.5 text-sm font-medium text-gray-800">{f.name}</td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <span className="text-sm font-bold text-gray-700">PKR {f.amount.toLocaleString()}</span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-gray-500 hidden lg:table-cell max-w-[180px] truncate">{f.reason}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${f.type === "Auto" ? "bg-purple-100 text-purple-700" : "bg-orange-100 text-orange-700"}`}>{f.type}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${f.status === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>{f.status}</span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-gray-500 hidden lg:table-cell">{f.date}</td>
                  <td className="px-5 py-3.5">
                    {f.status === "Unpaid" && (
                      <button className="text-xs bg-emerald-600 text-white px-2.5 py-1 rounded-md hover:bg-emerald-700 transition-colors font-medium">Mark Paid</button>
                    )}
                    {f.status === "Paid" && (
                      <button className="text-xs border border-gray-200 text-gray-500 px-2.5 py-1 rounded-md hover:bg-gray-50 transition-colors font-medium">Receipt</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">Showing {Math.min((page - 1) * perPage + 1, filtered.length)}–{Math.min(page * perPage, filtered.length)} of {filtered.length}</p>
          <div className="flex gap-1">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"><ChevronLeft size={15} /></button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 rounded-md text-xs font-medium ${p === page ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-100"}`}>{p}</button>
            ))}
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"><ChevronRight size={15} /></button>
          </div>
        </div>
      </div>

      {/* Generate Fine Modal */}
      {showGenModal && (
        <GenFineModal
          onClose={() => setShowGenModal(false)}
          onSuccess={() => { setShowGenModal(false); loadFines(); }}
        />
      )}
    </div>
  );
}
