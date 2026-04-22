import { useState, useEffect } from "react";

import { api } from "@/config";
const API = api("/api/fines");

type Fine = { id: number; rollNo: string; name: string; fine_amount: number; days_late: number; created_at: string; bookTitle?: string; reason?: string };

export function FinedStudents() {
  const [unsent, setUnsent] = useState<Fine[]>([]);
  const [sent, setSent] = useState<Fine[]>([]);

  useEffect(() => {
    fetch(`${API}/unsent`).then((r) => r.json()).then((rows) => setUnsent(rows || [])).catch(() => []);
    fetch(`${API}/sent`).then((r) => r.json()).then((rows) => setSent(rows || [])).catch(() => []);
  }, []);

  const FineTable = ({ data, title }: { data: Fine[]; title: string }) => (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="px-5 py-3 border-b bg-gray-50">
        <h3 className="font-semibold text-gray-800">{title}</h3>
      </div>
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-5 py-2 text-left text-xs font-semibold text-gray-500">Student</th>
            <th className="px-5 py-2 text-left text-xs font-semibold text-gray-500">Roll No</th>
            <th className="px-5 py-2 text-left text-xs font-semibold text-gray-500">Amount</th>
            <th className="px-5 py-2 text-left text-xs font-semibold text-gray-500">Reason</th>
            <th className="px-5 py-2 text-left text-xs font-semibold text-gray-500">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {data.map((f) => (
            <tr key={f.id} className="hover:bg-gray-50">
              <td className="px-5 py-3 text-sm font-medium text-gray-800">{f.name}</td>
              <td className="px-5 py-3 text-sm font-mono text-gray-600">{f.rollNo}</td>
              <td className="px-5 py-3 text-sm font-semibold text-gray-700">PKR {Number(f.fine_amount || 0).toLocaleString()}</td>
              <td className="px-5 py-3 text-xs text-gray-500">{f.reason || (f.days_late > 0 ? `Overdue ${f.days_late} days` : "-")}</td>
              <td className="px-5 py-3 text-xs text-gray-500">{f.created_at ? new Date(f.created_at).toLocaleDateString() : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.length === 0 && <p className="px-5 py-6 text-center text-gray-500">No records</p>}
    </div>
  );

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-gray-800">Fined Students</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage library fines</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FineTable data={unsent} title="Unsent Fines" />
        <FineTable data={sent} title="Sent Fines" />
      </div>
    </div>
  );
}
