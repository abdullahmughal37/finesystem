import React, { useState, useEffect } from "react";
import { Save, Shield, BookOpen, DollarSign, Database, Code2, Upload, Columns3, FileCheck2 } from "lucide-react";
import { api } from "@/config";
import { downloadFile, jsonBody, requestJson } from '@/lib/api';

import { AccountSettings } from '../catalog/AccountSettings';
import { FieldLayoutEditor } from '../catalog/FieldLayoutEditor';
import { ClearanceTemplateEditor } from '../catalog/ClearanceTemplateEditor';

type TabKey = "student-fields" | "book-fields" | "general" | "fines" | "clearance" | "security" | "backup" | "developers";

const developers = [
  { name: "Mudassar Khan", role: "Project Supervisor", roll: "" },
  { name: "Muhammad Abdullah", roll: "084" },
  { name: "Ali Hasnain", roll: "140" },
  { name: "Dawood Tahir", roll: "133" },
];

export function Settings() {
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [layoutDirty,setLayoutDirty]=useState(false);
  const isLayout=activeTab==="student-fields"||activeTab==="book-fields";
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    universityName: "",
    address: "",
    logoUrl: "",
    maxBooks: "3",
    issueDays: "15",
    finePerDay: "10",
    reminderDays: "2",
    enable2FA: "0",
  });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch(api("/api/settings"))
      .then((r) => r.json())
      .then((s) => {
        setForm({
          universityName: s.universityName || "COMSATS University Islamabad",
          address: s.address || "",
          logoUrl: s.logoUrl || "",
          maxBooks: s.maxBooks || "3",
          issueDays: s.issueDays || "15",
          finePerDay: s.finePerDay || "10",
          reminderDays: s.reminderDays || "2",
          enable2FA: s.enable2FA || "0",
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setError("");
    try {
      await requestJson('/api/settings', { method: 'POST', ...jsonBody(form) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      window.dispatchEvent(new Event("settings-updated"));
    } catch (error) { setError((error as Error).message); }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("logo", file);
    setError("");
    try {
      const data = await requestJson('/api/settings/logo', { method: 'POST', body: fd });
      if (data?.logoUrl) {
        setForm((f) => ({ ...f, logoUrl: data.logoUrl }));
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        window.dispatchEvent(new Event("settings-updated"));
        window.location.reload();
      }
    } catch (error) { setError((error as Error).message); }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm("Delete ALL data? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await requestJson('/api/backup/delete-all', { method: 'POST' });
      window.location.reload();
    } catch (error) {
      setError((error as Error).message);
      setDeleting(false);
    }
  };

  const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: "general", label: "General", icon: BookOpen },
    { key: "student-fields", label: "Student fields", icon: Columns3 },
    { key: "book-fields", label: "Book fields", icon: Columns3 },
    { key: "fines", label: "Fine Policy", icon: DollarSign },
    { key: "clearance", label: "Clearance Letter", icon: FileCheck2 },
    { key: "security", label: "Security", icon: Shield },
    { key: "backup", label: "Backup & Data", icon: Database },
    { key: "developers", label: "Developers", icon: Code2 },
  ];

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-800">Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure library system</p>
        </div>
        {(activeTab === "general" || activeTab === "fines") && <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium ${saved ? "bg-emerald-500" : ""}`}
          style={!saved ? { background: "linear-gradient(135deg, #1F3A8A, #3B82F6)" } : {}}
        >
          <Save size={15} /> {saved ? "Saved!" : "Save Changes"}
        </button>}
      </div>
      {error && <p role="alert" className="text-sm text-red-700 bg-red-50 p-3 rounded-lg">{error}</p>}

      <div className="flex flex-col lg:flex-row gap-5">
        <div className="lg:w-52 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => {if(key===activeTab)return;if(!layoutDirty||window.confirm('Discard unsaved layout changes?'))setActiveTab(key);}}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm border-b last:border-0
                  ${activeTab === key ? "text-white" : "text-gray-600 hover:bg-gray-50"}`}
                style={activeTab === key ? { background: "linear-gradient(135deg, #1F3A8A, #3B82F6)" } : {}}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-4">
          {isLayout && <FieldLayoutEditor key={activeTab} kind={activeTab==="student-fields"?"students":"books"} onDirtyChange={setLayoutDirty}/>}
          {activeTab === "clearance" && <ClearanceTemplateEditor />}
          {activeTab === "general" && (
            <div className="bg-white rounded-xl border p-6 space-y-5">
              <h3 className="text-gray-800 pb-3 border-b">Library Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">University Name</label>
                  <input
                    value={form.universityName}
                    onChange={(e) => setForm({ ...form, universityName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" id="logo" />
                  <label htmlFor="logo" className="flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer text-sm">
                    <Upload size={16} /> Upload Logo
                  </label>
                  {form.logoUrl && <p className="text-xs text-gray-500 mt-1">Logo uploaded</p>}
                </div>
              </div>
            </div>
          )}

          {activeTab === "fines" && (
            <div className="bg-white rounded-xl border p-6 space-y-5">
              <h3 className="text-gray-800 pb-3 border-b">Fine & Issuance Policy</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Books</label>
                  <input type="number" value={form.maxBooks} onChange={(e) => setForm({ ...form, maxBooks: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Issue Days</label>
                  <input type="number" value={form.issueDays} onChange={(e) => setForm({ ...form, issueDays: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fine Per Day (PKR)</label>
                  <input type="number" value={form.finePerDay} onChange={(e) => setForm({ ...form, finePerDay: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reminder Days</label>
                  <input type="number" value={form.reminderDays} onChange={(e) => setForm({ ...form, reminderDays: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
            </div>
          )}

          {activeTab === "security" && <AccountSettings/>}

          {activeTab === "backup" && (
            <div className="bg-white rounded-xl border p-6 space-y-5">
              <h3 className="text-gray-800 pb-3 border-b">Data Backup</h3>
              <p className="text-sm text-gray-600">CSV exports are suitable for review and transfer. The SQL file backs up application data and settings for restoration into an initialized installation; keep it private because it contains student records.</p>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => downloadFile('/api/backup/sql','library-data-backup.sql').catch(error => setError(error.message))} className="px-4 py-2 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700">Download Data Backup (SQL)</button>
                <button onClick={() => downloadFile('/api/backup/students.csv','students.csv').catch(error => setError(error.message))} className="px-4 py-2 border rounded-lg text-sm">Export Students CSV</button>
                <button onClick={() => downloadFile('/api/backup/books.csv','books.csv').catch(error => setError(error.message))} className="px-4 py-2 border rounded-lg text-sm">Export Books CSV</button>
                <button onClick={() => downloadFile('/api/fines/export/csv','fines-export.csv').catch(error => setError(error.message))} className="px-4 py-2 border rounded-lg text-sm">Export Fines CSV</button>
              </div>
              <div className="border-t pt-4 mt-4">
                <p className="text-sm font-semibold text-red-700 mb-2">Danger Zone</p>
                <button onClick={handleDeleteAll} disabled={deleting} className="px-4 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                  {deleting ? "Deleting..." : "Delete All Data"}
                </button>
              </div>
            </div>
          )}

          {activeTab === "developers" && (
            <div className="bg-white rounded-xl border p-6">
              <h3 className="text-gray-800 pb-3 border-b">Supervisor & Developers</h3>
              <div className="space-y-3 mt-4">
                {developers.map((d) => (
                  <div key={d.name} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">{d.name.charAt(0)}</div>
                    <div>
                      <p className="font-semibold text-gray-800">{d.name}</p>
                      {'role' in d && d.role && <p className="text-sm text-blue-700">{d.role}</p>}
                      {d.roll && <p className="text-sm text-gray-500">({d.roll})</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
