import { useState } from "react";
import { Search, CheckCircle, AlertTriangle, BookCheck, DollarSign } from "lucide-react";
import { api } from "@/config";

const API = api("/api/return");
const FINE_PER_DAY = 10;

type RecordType = {
  rollNo: string;
  studentName: string;
  dept: string;
  bookTitle: string;
  bookSerial: string;
  issueDate: string;
  dueDate: string;
  recordId: number;
  daysPassed: number;
  daysLate: number;
  fineAmount: number;
};

export function ReturnBook() {
  const [input, setInput] = useState("");
  const [record, setRecord] = useState<RecordType | null>(null);
  const [error, setError] = useState("");
  const [returned, setReturned] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    const key = input.trim();
    if (!key) return;
    setLoading(true);
    setError("");
    setRecord(null);
    try {
      const res = await fetch(`${API}/search?q=${encodeURIComponent(key)}`);
      const data = await res.json();
      if (data.found && data.record) {
        setRecord(data.record);
      } else {
        setError("No active issue found for this roll number or serial. Please verify.");
      }
    } catch {
      setError("Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const overdueDays = record?.daysLate ?? 0;
  const fineAmount = record?.fineAmount ?? 0;
  const isOverdue = overdueDays > 0;

  const handleReturn = async () => {
    if (!record?.recordId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: record.recordId }),
      });
      const data = await res.json();
      if (data.success) {
        setReturned(true);
      } else {
        setError(data.error || "Return failed. Please try again.");
      }
    } catch {
      setError("Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setInput(""); setRecord(null); setError(""); setReturned(false);
  };

  if (returned && record) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-emerald-600" />
          </div>
          <h2 className="text-gray-800 mb-2">Book Returned Successfully!</h2>
          <p className="text-sm text-gray-500 mb-6">
            <span className="font-semibold text-gray-700">{record.bookTitle}</span> has been returned by {record.studentName}
          </p>
          {isOverdue && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={16} className="text-red-600" />
                <span className="text-red-700 font-semibold text-sm">Fine Generated</span>
              </div>
              <p className="text-2xl font-bold text-red-600 mb-1">PKR {fineAmount}</p>
              <p className="text-xs text-red-500">{overdueDays} days overdue × PKR {FINE_PER_DAY}/day</p>
            </div>
          )}
          <button
            onClick={handleReset}
            className="w-full py-2.5 rounded-lg text-sm text-white font-medium hover:opacity-90 transition-opacity"
            style={{ background: "linear-gradient(135deg, #1F3A8A, #3B82F6)" }}
          >Return Another Book</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-gray-800">Return Book</h1>
        <p className="text-sm text-gray-500 mt-0.5">Process a book return and auto-calculate overdue fines</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          {/* Search */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                <BookCheck size={14} className="text-blue-600" />
              </div>
              <h3 className="text-gray-800">Search by Book Serial Number</h3>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Roll No. or Book Serial</label>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 font-mono"
                  placeholder="e.g. SN-CS-002 or FA21-BCS-001"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={loading}
                className="self-end flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium hover:opacity-90 transition-opacity"
                style={{ background: "linear-gradient(135deg, #1F3A8A, #3B82F6)" }}
              >
                <Search size={14} /> Find Record
              </button>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
                <AlertTriangle size={15} /> {error}
              </div>
            )}
          </div>

          {/* Issue record */}
          {record && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <h3 className="text-gray-800">Issue Record Found</h3>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${isOverdue ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700"}`}>
                  {isOverdue ? `${overdueDays} Days Overdue` : "On Time"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  ["Student Name", record.studentName],
                  ["Roll Number", record.rollNo],
                  ["Department", record.dept],
                  ["Book Title", record.bookTitle],
                  ["Book Serial", record.bookSerial],
                  ["Issue Date", record.issueDate],
                  ["Due Date", record.dueDate],
                  ["Return Date", new Date().toLocaleDateString() + " (Today)"],
                ].map(([label, value]) => (
                  <div key={label} className={label === "Book Title" || label === "Student Name" ? "col-span-2" : ""}>
                    <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                    <p className={`text-sm font-medium ${label === "Due Date" && isOverdue ? "text-red-600" : "text-gray-800"}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Fine notification */}
              {isOverdue ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={16} className="text-red-500" />
                    <span className="text-red-700 font-semibold text-sm">Overdue Fine Detected</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-red-500">{overdueDays} days × PKR {FINE_PER_DAY}/day</p>
                      <p className="text-xs text-red-500 mt-0.5">Fine will be auto-generated upon return</p>
                    </div>
                    <p className="text-2xl font-bold text-red-600">PKR {fineAmount}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-emerald-600" />
                    <span className="text-emerald-700 font-semibold text-sm">No fine – book returned on time</span>
                  </div>
                </div>
              )}

              <button
                onClick={handleReturn}
                disabled={loading}
                className="w-full py-3 rounded-xl text-sm text-white font-semibold hover:opacity-90 transition-opacity shadow-md disabled:opacity-70"
                style={{ background: "linear-gradient(135deg, #1F3A8A, #3B82F6)" }}
              >
                ✓ Confirm Book Return{isOverdue ? ` & Generate PKR ${fineAmount} Fine` : ""}
              </button>
            </div>
          )}
        </div>

        {/* Help */}
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
            <h4 className="text-blue-800 mb-3">📋 Return Policy</h4>
            <ul className="space-y-2 text-sm text-blue-700">
              <li className="flex gap-2"><span>•</span>Fine: PKR 10 per day after due date</li>
              <li className="flex gap-2"><span>•</span>Fine generated automatically on return</li>
              <li className="flex gap-2"><span>•</span>Damaged books: additional manual fine</li>
              <li className="flex gap-2"><span>•</span>Fines must be cleared before new issuance</li>
            </ul>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h4 className="text-gray-700 mb-3">🔍 Search Tip</h4>
            <p className="text-xs text-gray-600">Enter roll number or book serial to find the active issue record.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
