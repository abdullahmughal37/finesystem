import React, { useState, useEffect } from "react";

import { api } from "@/config";
const API = api("/api");

type OverdueRow = { rollNo: string; name: string; email: string; book: string; dueDate: string; daysOverdue: number };

export function ReminderEmails() {
  const [list, setList] = useState<OverdueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`${API}/reminders/overdue`)
      .then((r) => r.json())
      .then((rows) => setList(rows || []))
      .catch(() => [])
      .finally(() => setLoading(false));
  }, []);

  const sendReminders = async () => {
    setSending(true);
    setMessage("");
    try {
      const res = await fetch(`${API}/reminders/send`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage(`Reminders sent to ${data.count || 0} students.`);
      } else {
        setMessage(data.error || "Failed to send.");
      }
    } catch {
      setMessage("Network error.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-gray-800">Reminder Emails</h1>
          <p className="text-sm text-gray-500 mt-0.5">Send reminders to students with overdue books</p>
        </div>
        <button
          onClick={sendReminders}
          disabled={sending || list.length === 0}
          className="px-4 py-2 rounded-lg text-sm text-white font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {sending ? "Sending..." : "Send Reminder Emails"}
        </button>
      </div>
      {message && <div className="p-3 rounded-lg bg-blue-50 text-blue-700 text-sm">{message}</div>}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Email</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Book</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Due Date</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-500">Loading...</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-500">No overdue books</td></tr>
              ) : (
                list.map((r) => (
                  <tr key={r.rollNo} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-sm font-medium text-gray-800">{r.name}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{r.email}</td>
                    <td className="px-5 py-3 text-sm text-gray-600 truncate max-w-[200px]">{r.book}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{r.dueDate ? new Date(r.dueDate).toLocaleDateString() : "-"}</td>
                    <td className="px-5 py-3"><span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">Pending</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
