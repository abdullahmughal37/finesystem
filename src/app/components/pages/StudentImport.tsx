import { useState, useRef } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, Download, X, Users } from "lucide-react";

const sampleData = [
  { rollNo: "FA24-BCS-001", name: "Hamza Ali Rana", dept: "Computer Science", semester: "1st", email: "hamza.ali@students.cuisahiwal.edu.pk", status: "Valid" },
  { rollNo: "FA24-BCS-002", name: "Nadia Imran Sheikh", dept: "Computer Science", semester: "1st", email: "nadia.imran@students.cuisahiwal.edu.pk", status: "Valid" },
  { rollNo: "FA24-BCE-001", name: "Omer Farooq Butt", dept: "Electrical Engineering", semester: "1st", email: "omer.farooq@students.cuisahiwal.edu.pk", status: "Valid" },
  { rollNo: "FA24-BCE-002", name: "Rabia Malik Chaudhry", dept: "Electrical Engineering", semester: "1st", email: "rabia.malik@students.cuisahiwal.edu.pk", status: "Duplicate" },
  { rollNo: "FA24-BBA-001", name: "Sana Akhtar Hussain", dept: "Business Administration", semester: "1st", email: "sana.akhtar@students.cuisahiwal.edu.pk", status: "Valid" },
  { rollNo: "", name: "Invalid Row", dept: "", semester: "", email: "", status: "Error" },
  { rollNo: "FA24-BCS-003", name: "Taha Raza Khan", dept: "Computer Science", semester: "1st", email: "taha.raza@students.cuisahiwal.edu.pk", status: "Valid" },
];

export function StudentImport() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState(false);
  const [imported, setImported] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const valid = sampleData.filter(r => r.status === "Valid").length;
  const duplicate = sampleData.filter(r => r.status === "Duplicate").length;
  const errors = sampleData.filter(r => r.status === "Error").length;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith(".csv")) {
      setFile(f);
      setPreview(true);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setPreview(true);
    }
  };

  const statusColors: Record<string, string> = {
    Valid: "bg-emerald-100 text-emerald-700",
    Duplicate: "bg-yellow-100 text-yellow-700",
    Error: "bg-red-100 text-red-600",
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-gray-800">Student Import</h1>
        <p className="text-sm text-gray-500 mt-0.5">Bulk import students via CSV file upload</p>
      </div>

      {imported ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-emerald-600" />
          </div>
          <h2 className="text-gray-800 mb-2">Import Successful!</h2>
          <p className="text-sm text-gray-500 mb-6">
            <span className="font-semibold text-emerald-600">{valid} students</span> have been imported successfully
          </p>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-emerald-50 rounded-xl p-3">
              <p className="text-xl font-bold text-emerald-600">{valid}</p>
              <p className="text-xs text-gray-500">Imported</p>
            </div>
            <div className="bg-yellow-50 rounded-xl p-3">
              <p className="text-xl font-bold text-yellow-600">{duplicate}</p>
              <p className="text-xs text-gray-500">Skipped</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3">
              <p className="text-xl font-bold text-red-600">{errors}</p>
              <p className="text-xs text-gray-500">Errors</p>
            </div>
          </div>
          <button
            onClick={() => { setFile(null); setPreview(false); setImported(false); }}
            className="w-full py-2.5 rounded-lg text-sm text-white font-medium hover:opacity-90 transition-opacity"
            style={{ background: "linear-gradient(135deg, #1F3A8A, #3B82F6)" }}
          >Import Another File</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            {/* Upload zone */}
            {!preview && (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => fileInputRef.current?.click()}
                className={`bg-white rounded-xl border-2 border-dashed cursor-pointer transition-all p-12 text-center
                  ${isDragging ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"}`}
              >
                <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
                <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                  <Upload size={24} className="text-blue-500" />
                </div>
                <h3 className="text-gray-700 mb-2">Drop your CSV file here</h3>
                <p className="text-sm text-gray-400 mb-4">or click to browse files</p>
                <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1.5 rounded-full">.CSV files only · Max 10MB</span>
              </div>
            )}

            {/* Preview table */}
            {preview && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-blue-600" />
                    <span className="text-sm font-semibold text-gray-700">{file?.name || "students.csv"}</span>
                  </div>
                  <button onClick={() => { setFile(null); setPreview(false); }} className="text-gray-400 hover:text-gray-600">
                    <X size={16} />
                  </button>
                </div>

                {/* Validation summary */}
                <div className="px-5 py-3 border-b border-gray-100 grid grid-cols-3 gap-3">
                  <div className="flex items-center gap-2 bg-emerald-50 rounded-lg px-3 py-2">
                    <CheckCircle size={14} className="text-emerald-600" />
                    <div>
                      <p className="text-sm font-bold text-emerald-700">{valid}</p>
                      <p className="text-xs text-gray-500">Valid</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-yellow-50 rounded-lg px-3 py-2">
                    <AlertCircle size={14} className="text-yellow-600" />
                    <div>
                      <p className="text-sm font-bold text-yellow-700">{duplicate}</p>
                      <p className="text-xs text-gray-500">Duplicate</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-red-50 rounded-lg px-3 py-2">
                    <AlertCircle size={14} className="text-red-600" />
                    <div>
                      <p className="text-sm font-bold text-red-600">{errors}</p>
                      <p className="text-xs text-gray-500">Errors</p>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Roll No.</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Department</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Semester</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {sampleData.map((row, i) => (
                        <tr key={i} className={`${row.status === "Error" ? "bg-red-50/50" : row.status === "Duplicate" ? "bg-yellow-50/50" : "hover:bg-gray-50"} transition-colors`}>
                          <td className="px-5 py-3 text-xs font-mono text-gray-600">{row.rollNo || "—"}</td>
                          <td className="px-5 py-3 text-sm font-medium text-gray-800">{row.name}</td>
                          <td className="px-5 py-3 text-sm text-gray-600 hidden md:table-cell">{row.dept || "—"}</td>
                          <td className="px-5 py-3 text-sm text-gray-600 hidden lg:table-cell">{row.semester || "—"}</td>
                          <td className="px-5 py-3">
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColors[row.status]}`}>{row.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
                  <button onClick={() => { setFile(null); setPreview(false); }} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                  <button
                    onClick={() => setImported(true)}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm text-white font-medium hover:opacity-90 transition-opacity"
                    style={{ background: "linear-gradient(135deg, #1F3A8A, #3B82F6)" }}
                  >
                    <Users size={14} /> Import {valid} Students
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Side instructions */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h4 className="text-gray-700 mb-3">📋 CSV Format Requirements</h4>
              <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs text-gray-600 mb-3 overflow-x-auto">
                <p>roll_number,full_name,</p>
                <p>department,semester,</p>
                <p>email</p>
              </div>
              <ul className="space-y-1.5 text-xs text-gray-500">
                <li className="flex gap-2"><span className="text-emerald-500">✓</span>First row must be column headers</li>
                <li className="flex gap-2"><span className="text-emerald-500">✓</span>Roll number must be unique</li>
                <li className="flex gap-2"><span className="text-emerald-500">✓</span>Email must be university format</li>
                <li className="flex gap-2"><span className="text-emerald-500">✓</span>Use UTF-8 encoding</li>
                <li className="flex gap-2"><span className="text-red-400">✗</span>No special characters in names</li>
              </ul>
            </div>
            <button className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-blue-200 rounded-xl text-sm text-blue-600 font-medium hover:bg-blue-50 transition-colors bg-white">
              <Download size={15} /> Download Sample CSV Template
            </button>
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <h4 className="text-blue-800 mb-2">ℹ️ Import Notes</h4>
              <ul className="space-y-1.5 text-xs text-blue-700">
                <li>• Duplicate roll numbers will be skipped</li>
                <li>• Error rows require correction before import</li>
                <li>• Preview shows first 50 rows</li>
                <li>• Import history is logged automatically</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
