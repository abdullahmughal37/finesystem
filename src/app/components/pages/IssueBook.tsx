import { useState } from "react";
import { Search, User, BookOpen, Calendar, CheckCircle, AlertCircle, ChevronDown } from "lucide-react";
import { api } from "@/config";

function addDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function IssueBook() {

  const [rollNo, setRollNo] = useState("");
  const [student, setStudent] = useState<any>(null);
  const [studentError, setStudentError] = useState("");

  const [serialNo, setSerialNo] = useState("");
  const [book, setBook] = useState<any>(null);
  const [bookError, setBookError] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const [issueDate] = useState(today);
  const [dueDate] = useState(addDays(new Date(), 15));

  const [issued, setIssued] = useState(false);
  const [issueError, setIssueError] = useState("");


  /* VERIFY STUDENT FROM DATABASE */

  const verifyStudent = async () => {

    const res = await fetch(api(`/api/student/${rollNo}`));
    const data = await res.json();

    if (data.found) {

      setStudent({
        name: data.student.name,
        dept: data.student.dept,
        semester: data.student.semester,
        issued: data.student.issued || 0
      });

      setStudentError("");

    } else {

      setStudent(null);
      setStudentError("Student not found. Please check the roll number.");

    }

  };


  /* VERIFY BOOK FROM DATABASE */

  const verifyBook = async () => {
  try {

    const res = await fetch(api(`/api/book/${encodeURIComponent(serialNo.trim())}`));
    const data = await res.json();

    if (data.found) {

      setBook(data.book);

      const avail = typeof data.book?.available === "number" ? data.book.available : (data.book?.total || 0) - (data.book?.issuedCount || 0);
      if (avail <= 0) {
        setBookError("This book is currently not available (all copies issued).");
      } else {
        setBookError("");
      }

    } else {

      setBook(null);
      setBookError("Book not found. Please check the serial number.");

    }

  } catch (err) {

    setBook(null);
    setBookError("Server error. Please try again.");

  }
};


  /* ISSUE BOOK TO DATABASE */

  const handleIssue = async () => {
    setIssueError("");
    try {
      const res = await fetch(api("/api/issue"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rollNo,
          serialNo: serialNo.trim(),
          issueDate,
          dueDate,
        }),
      });
      const data = await res.json();
      if (data.message && data.message.includes("Successfully")) {
        setIssued(true);
      } else {
        setIssueError(data.message || "Issue failed. Please try again.");
      }
    } catch {
      setIssueError("Server error. Please try again.");
    }
  };


  const handleReset = () => {
    setIssueError("");
    setRollNo("");
    setStudent(null);
    setStudentError("");

    setSerialNo("");
    setBook(null);
    setBookError("");

    setIssued(false);

  };


  if (issued) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-emerald-600" />
          </div>

          <h2 className="text-gray-800 mb-2">Book Issued Successfully!</h2>

          <p className="text-sm text-gray-500 mb-1">
            Book has been issued to
            <span className="font-semibold text-gray-700"> {student?.name}</span>
          </p>

          <p className="text-sm text-gray-500 mb-6">
            Due date:
            <span className="font-semibold text-red-500"> {dueDate}</span>
          </p>

          <button
            onClick={handleReset}
            className="w-full py-2.5 rounded-lg text-sm text-white font-medium hover:opacity-90 transition-opacity"
            style={{ background: "linear-gradient(135deg, #1F3A8A, #3B82F6)" }}
          >
            Issue Another Book
          </button>

        </div>
      </div>
    );
  }


  return (

    <div className="p-6 space-y-5">

      <div>
        <h1 className="text-gray-800">Issue Book</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Issue a library book to a registered student
        </p>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">


        {/* FORM */}

        <div className="lg:col-span-2 space-y-4">


          {/* STUDENT VERIFY */}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">

            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">

              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                <User size={14} className="text-blue-600" />
              </div>

              <h3 className="text-gray-800">Step 1: Verify Student</h3>

            </div>

            <div className="flex gap-2">

              <div className="flex-1">

                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Student Roll Number
                </label>

                <input
                  type="text"
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && verifyStudent()}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 font-mono"
                  placeholder="e.g. FA21-BCS-001"
                />

              </div>

              <button
                onClick={verifyStudent}
                className="self-end flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium hover:opacity-90 transition-opacity"
                style={{ background: "linear-gradient(135deg, #1F3A8A, #3B82F6)" }}
              >
                <Search size={14} /> Verify
              </button>

            </div>


            {studentError && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
                <AlertCircle size={15} /> {studentError}
              </div>
            )}


            {student && (
              <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">

                <div className="flex items-center gap-2 mb-2">

                  <CheckCircle size={15} className="text-emerald-600" />

                  <span className="text-emerald-700 text-sm font-semibold">
                    Student Verified
                  </span>

                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">

                  <div>
                    <span className="text-gray-500">Name:</span>
                    <span className="font-medium text-gray-800"> {student.name}</span>
                  </div>

                  <div>
                    <span className="text-gray-500">Dept:</span>
                    <span className="font-medium text-gray-800"> {student.dept}</span>
                  </div>

                  <div>
                    <span className="text-gray-500">Semester:</span>
                    <span className="font-medium text-gray-800"> {student.semester}</span>
                  </div>

                  <div>
                    <span className="text-gray-500">Books Issued:</span>
                    <span className="font-medium text-gray-800"> {student.issued}/3</span>
                  </div>

                </div>

              </div>
            )}

          </div>


          {/* BOOK VERIFY */}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">

            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">

              <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
                <BookOpen size={14} className="text-purple-600" />
              </div>

              <h3 className="text-gray-800">Step 2: Select Book</h3>

            </div>


            <div className="flex gap-2">

              <div className="flex-1">

                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Book Serial Number
                </label>

                <input
                  type="text"
                  value={serialNo}
                  onChange={(e) => setSerialNo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && verifyBook()}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 font-mono"
                  placeholder="e.g. SN-CS-001"
                />

              </div>

              <button
                onClick={verifyBook}
                className="self-end flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium hover:opacity-90 transition-opacity"
                style={{ background: "linear-gradient(135deg, #6d28d9, #8B5CF6)" }}
              >
                <Search size={14} /> Find Book
              </button>

            </div>


            {bookError && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
                <AlertCircle size={15} /> {bookError}
              </div>
            )}


            {book && book.available > 0 && (

              <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">

                <div className="flex items-center gap-2 mb-2">

                  <CheckCircle size={15} className="text-emerald-600" />

                  <span className="text-emerald-700 text-sm font-semibold">
                    Book Available
                  </span>

                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">

                  <div className="col-span-2">
                    <span className="text-gray-500">Title:</span>
                    <span className="font-medium text-gray-800"> {book.title}</span>
                  </div>

                  <div>
                    <span className="text-gray-500">Author:</span>
                    <span className="font-medium text-gray-800"> {book.author}</span>
                  </div>

                  <div>
                    <span className="text-gray-500">Available:</span>
                    <span className="font-medium text-emerald-700"> {book.available} copies</span>
                  </div>

                </div>

              </div>

            )}



{issueError && (
  <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
    <AlertCircle size={15} /> {issueError}
  </div>
)}

{student && book && book.available > 0 && (
  <button
    onClick={handleIssue}
    className="w-full py-3 rounded-xl text-sm text-white font-semibold hover:opacity-90 transition-opacity shadow-md mt-4"
    style={{ background: "linear-gradient(135deg, #1F3A8A, #3B82F6)" }}
  >
    Issue Book to Student
  </button>

)}

          </div>

        </div>


        {/* POLICY PANEL (UNCHANGED) */}

        <div className="space-y-4">

          <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">

            <h4 className="text-blue-800 mb-3">📋 Issuance Policy</h4>

            <ul className="space-y-2 text-sm text-blue-700">

              <li>• Each student can borrow maximum 3 books</li>

              <li>• Books are issued for 15 days</li>

              <li>• Late return incurs PKR 10/day fine</li>

              <li>• Damaged books attract manual fine</li>

              <li>• Lost books: full replacement cost</li>

            </ul>

          </div>

        </div>

      </div>

    </div>





  );

}