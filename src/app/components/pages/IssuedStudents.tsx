import { useState, useEffect } from "react";
import { requestJson } from "@/lib/api";

type Row = { name: string; registration_no: string; accession_no: string; issue_date: string; due_date: string };

export function IssuedStudents() {
  const [list, setList] = useState<Row[]>([]);
  useEffect(() => {
    requestJson('/api/issued-students').then((rows) => setList(Array.isArray(rows) ? rows : [])).catch(() => setList([]));
  }, []);

  return (
    <div className="p-6 space-y-5">
      <div><h1 className="text-gray-800">Issued Students</h1><p className="text-sm text-gray-500 mt-0.5">Students who currently have books issued</p></div>
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50"><tr><th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Student Name</th><th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Roll No</th><th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Book Serial</th><th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Issue Date</th><th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Due Date</th></tr></thead>
          <tbody className="divide-y divide-gray-50">
            {list.map((r) => (
              <tr key={`${r.registration_no}-${r.accession_no}`} className="hover:bg-gray-50">
                <td className="px-5 py-3 text-sm font-medium text-gray-800">{r.name}</td>
                <td className="px-5 py-3 text-sm font-mono text-gray-600">{r.registration_no}</td>
                <td className="px-5 py-3 text-sm text-gray-600">{r.accession_no}</td>
                <td className="px-5 py-3 text-sm text-gray-500">{r.issue_date ? new Date(r.issue_date).toLocaleDateString() : "-"}</td>
                <td className="px-5 py-3 text-sm text-gray-500">{r.due_date ? new Date(r.due_date).toLocaleDateString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="px-5 py-8 text-center text-gray-500">No books currently issued</p>}
      </div>
    </div>
  );
}
