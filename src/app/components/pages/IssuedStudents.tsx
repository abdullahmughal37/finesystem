import { useState, useEffect } from "react";

import { api } from "@/config";
const API = api("/api");

type Row = { name: string; rollNo: string; bookSerial: string; issueDate: string; dueDate: string };

export function IssuedStudents() {
  const [list, setList] = useState<Row[]>([]);

  useEffect(() => {
    fetch(`${API}/issued-students`)
      .then((r) => r.json())
      .then((rows: Row[]) => setList(rows || []))
      .catch(() => []);
  }, []);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-gray-800">Issued Students</h1>
        <p className="text-sm text-gray-500 mt-0.5">Students who currently have books issued</p>
      </div>
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Student Name</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Roll No</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Book Serial</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Issue Date</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Due Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {list.map((r) => (
              <tr key={`${r.rollNo}-${r.bookSerial}`} className="hover:bg-gray-50">
                <td className="px-5 py-3 text-sm font-medium text-gray-800">{r.name}</td>
                <td className="px-5 py-3 text-sm font-mono text-gray-600">{r.rollNo}</td>
                <td className="px-5 py-3 text-sm text-gray-600">{r.bookSerial}</td>
                <td className="px-5 py-3 text-sm text-gray-500">{r.issueDate ? new Date(r.issueDate).toLocaleDateString() : "-"}</td>
                <td className="px-5 py-3 text-sm text-gray-500">{r.dueDate ? new Date(r.dueDate).toLocaleDateString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && (
          <p className="px-5 py-8 text-center text-gray-500">No books currently issued</p>
        )}
      </div>
    </div>
  );
}
