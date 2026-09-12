import { useState } from "react";
import { Search, CheckCircle, AlertTriangle, BookCheck, DollarSign } from "lucide-react";
import { requestJson } from "@/lib/api";


type RecordType = {
  issueId: number;
  studentName: string;
  registrationNo: string;
  bookTitle: string;
  accessionNo: string;
  issueDate: string;
  dueDate: string;
  status: string;
  overdueDays: number;
  fineAmount: number;
  finePerDay: number;
};

export function ReturnBook() {
  const [mode, setMode] = useState<"student" | "book">("student");
  const [input, setInput] = useState("");
  const [records, setRecords] = useState<RecordType[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [returningId, setReturningId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");

  const handleSearch = async () => {
    const key = input.trim();
    if (!key) return;
    setLoading(true);
    setError("");
    setNotice("");
    setRecords([]);
    try {
      const endpoint = mode === "student" ? `/api/return/issues/student/${encodeURIComponent(key)}` : `/api/return/issues/book/${encodeURIComponent(key)}`;
      const data = await requestJson(endpoint);
      const rows = Array.isArray(data?.records) ? data.records : [];
      setRecords(rows);
      if (rows.length === 0) setError("No active books");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async (record: RecordType) => {
    setReturningId(record.issueId);
    setError("");
    setNotice("");
    try {
      const data = await requestJson(`/api/return/return/${record.issueId}`, { method: "POST" });
      setRecords((prev) => prev.filter((row) => row.issueId !== record.issueId));
      setNotice(data.fineGenerated ? `Book returned. An overdue fine of PKR ${Number(data.fineAmount).toLocaleString()} was generated.` : data.alreadyReturned ? "This book was already returned." : "Book returned successfully with no overdue fine.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Server error. Please try again.");
    } finally {
      setReturningId(null);
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div><h1 className="text-gray-800">Return Book</h1><p className="text-sm text-gray-500 mt-0.5">Process book return and auto-calculate overdue fines</p></div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100"><div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center"><BookCheck size={14} className="text-blue-600" /></div><h3 className="text-gray-800">Search Active Issues</h3></div>
            <div className="flex gap-2">
              <button onClick={() => { setMode("student"); setInput(""); setRecords([]); setError(""); setNotice(""); }} className={`px-3 py-2 rounded-lg text-sm ${mode === "student" ? "bg-blue-600 text-white" : "border text-gray-600"}`}>By Roll Number</button>
              <button onClick={() => { setMode("book"); setInput(""); setRecords([]); setError(""); setNotice(""); }} className={`px-3 py-2 rounded-lg text-sm ${mode === "book" ? "bg-blue-600 text-white" : "border text-gray-600"}`}>By Accession Number</button>
            </div>
            <div className="flex gap-2">
              <div className="flex-1"><label className="block text-sm font-medium text-gray-700 mb-1">{mode === "student" ? "Student Registration Number" : "Book Accession Number"}</label><input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono" placeholder={mode === "student" ? "e.g. FA21-BCS-001" : "e.g. ACC-001"} /></div>
              <button onClick={handleSearch} disabled={loading} className="self-end flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium" style={{ background: "linear-gradient(135deg, #1F3A8A, #3B82F6)" }}><Search size={14} /> Find</button>
            </div>
            {error && <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg"><AlertTriangle size={15} /> {error}</div>}
            {notice && <div role="status" className="flex items-center gap-2 text-emerald-700 text-sm bg-emerald-50 px-3 py-2 rounded-lg"><CheckCircle size={15} /> {notice}</div>}
          </div>

          {records.length > 0 && (
            <div className="space-y-4">
              {records.map((record) => {
                const isOverdue = record.overdueDays > 0;
                const isReturning = returningId === record.issueId;
                return (
                  <div key={record.issueId} className={`bg-white rounded-xl shadow-sm border p-5 space-y-4 ${isOverdue ? "border-red-200 bg-red-50/30" : "border-gray-100"}`}>
                    <div className="flex items-center justify-between pb-3 border-b border-gray-100"><h3 className="text-gray-800">Issue Record</h3><span className={`text-xs font-semibold px-2 py-1 rounded-full ${isOverdue ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700"}`}>{isOverdue ? `${record.overdueDays} Days Overdue` : "On Time"}</span></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><p className="text-xs text-gray-400 mb-0.5">Student Name</p><p className="text-sm font-medium text-gray-800">{record.studentName}</p></div>
                      <div><p className="text-xs text-gray-400 mb-0.5">Roll Number</p><p className="text-sm font-medium text-gray-800">{record.registrationNo}</p></div>
                      <div className="col-span-2"><p className="text-xs text-gray-400 mb-0.5">Book Title</p><p className="text-sm font-medium text-gray-800">{record.bookTitle}</p></div>
                      <div><p className="text-xs text-gray-400 mb-0.5">Book Serial</p><p className="text-sm font-medium text-gray-800">{record.accessionNo}</p></div>
                      <div><p className="text-xs text-gray-400 mb-0.5">Due Date</p><p className={`text-sm font-medium ${isOverdue ? "text-red-600" : "text-gray-800"}`}>{new Date(record.dueDate).toLocaleDateString()}</p></div>
                    </div>
                    {isOverdue ? (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-4"><div className="flex items-center gap-2 mb-2"><AlertTriangle size={16} className="text-red-500" /><span className="text-red-700 font-semibold text-sm">Overdue Fine Detected</span></div><div className="flex items-center justify-between"><div><p className="text-xs text-red-500">{record.overdueDays} days x PKR {record.finePerDay}/day</p><p className="text-xs text-red-500 mt-0.5">Fine will be auto-generated upon return</p></div><p className="text-2xl font-bold text-red-600">PKR {record.fineAmount}</p></div></div>
                    ) : (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4"><div className="flex items-center gap-2"><CheckCircle size={16} className="text-emerald-600" /><span className="text-emerald-700 font-semibold text-sm">No fine - book returned on time</span></div></div>
                    )}
                    <button onClick={() => handleReturn(record)} disabled={returningId !== null} className="w-full py-3 rounded-xl text-sm text-white font-semibold shadow-md disabled:opacity-70" style={{ background: "linear-gradient(135deg, #1F3A8A, #3B82F6)" }}>{isReturning ? "Processing..." : "Return Book"}</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="space-y-4"><div className="bg-blue-50 rounded-xl p-5 border border-blue-100"><h4 className="text-blue-800 mb-3">📋 Return Policy</h4><ul className="space-y-2 text-sm text-blue-700"><li>• Fine uses the current rate in Settings</li><li>• Fine generated automatically on return</li><li>• Damaged books: additional manual fine</li><li>• Outstanding fines are managed by the library</li></ul></div></div>
      </div>
    </div>
  );
}
