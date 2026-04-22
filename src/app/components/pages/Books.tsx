import { useState, useEffect } from "react";
import axios from "axios";
import { api } from "@/config";
import { Search, Plus, ChevronDown, Eye, Edit2, Trash2, ChevronLeft, ChevronRight, BookOpen } from "lucide-react";

const categories = ["All Categories", "Computer Science", "Engineering", "Mathematics", "Physics", "Business", "Literature", "History", "Islamic Studies", "Reference"];





export function Books() {

  const [booksData, setBooksData] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [availFilter, setAvailFilter] = useState("All");
  const [showAddModal, setShowAddModal] = useState(false);
  const [page, setPage] = useState(1);
  const [viewIssuedFor, setViewIssuedFor] = useState<string | null>(null);
  const [issuedList, setIssuedList] = useState<{ name: string; rollNo: string; issue_date: string }[]>([]);

  const perPage = 8;

  const [newBook, setNewBook] = useState({
    title: "",
    author: "",
    isbn: "",
    serial: "",
    category: "Computer Science",
    total: 1
  });

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    const res = await axios.get(api("/api/books"));
    setBooksData(res.data);
  };

  const addBook = async () => {
    await axios.post(api("/api/books"), newBook);
    setShowAddModal(false);
    fetchBooks();
  };

  const deleteBook = async (id:number) => {

    if(!window.confirm("Delete book?")) return;

    await axios.delete(api(`/api/books/${id}`));
    fetchBooks();
  };

  const filtered = booksData.filter((b) => {

    const q = search.toLowerCase();

    const matchSearch =
      b.title?.toLowerCase().includes(q) ||
      b.author?.toLowerCase().includes(q) ||
      b.isbn?.includes(q) ||
      b.serial?.toLowerCase().includes(q);

    const matchCat = category === "All Categories" || b.category === category;

    const avail = typeof b.available === "number" ? b.available : (b.total || 0) - (b.issuedCount || 0);
    const matchAvail =
      availFilter === "All" ||
      (availFilter === "Available" && avail > 0) ||
      (availFilter === "Issued" && avail === 0);

    return matchSearch && matchCat && matchAvail;
  });

const fetchIssuedForBook = async (serial: string) => {
    const res = await axios.get(api(`/api/books/issued/${encodeURIComponent(serial)}`));
    setIssuedList(res.data || []);
    setViewIssuedFor(serial);
  };

  const handleCSVImport = async (e:any) => {

  const file = e.target.files[0]

  const formData = new FormData()

  formData.append("file", file)

  await axios.post(
    api("/api/books/import"),
    formData
  )

  fetchBooks()

}




  const totalPages = Math.ceil(filtered.length / perPage);

  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">

        <div>
          <h1 className="text-gray-800">Books Catalog</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage and track library book inventory
          </p>
        </div>

  <div className="flex gap-2">

<input
 type="file"
 accept=".csv"
 onChange={handleCSVImport}
 className="hidden"
 id="csvUpload"
/>

<label
 htmlFor="csvUpload"
 className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm cursor-pointer"
>
 Import CSV
</label>

<button
 onClick={() => setShowAddModal(true)}
 className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white"
 style={{ background: "linear-gradient(135deg, #1F3A8A, #3B82F6)" }}
>
 <Plus size={15}/> Add Book
</button>

</div>

      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

        <div className="bg-blue-50 rounded-xl p-3 flex gap-3">
          <BookOpen size={18} className="text-blue-600"/>
          <div>
            <p className="text-lg font-bold text-blue-600">
              {booksData.reduce((a,b)=>a + Math.max(0, Number(b.total) || 0),0)}
            </p>
            <p className="text-xs text-gray-500">Total Books</p>
          </div>
        </div>

        <div className="bg-emerald-50 rounded-xl p-3 flex gap-3">
          <BookOpen size={18} className="text-emerald-600"/>
          <div>
            <p className="text-lg font-bold text-emerald-600">
              {booksData.reduce((a,b)=>a + Math.max(0, (b.total || 0) - (b.issuedCount || 0)),0)}
            </p>
            <p className="text-xs text-gray-500">Available</p>
          </div>
        </div>

        <div className="bg-orange-50 rounded-xl p-3 flex gap-3">
          <BookOpen size={18} className="text-orange-600"/>
          <div>
            <p className="text-lg font-bold text-orange-600">
              {booksData.reduce((a,b)=>a + Math.max(0, b.issuedCount || 0),0)}
            </p>
            <p className="text-xs text-gray-500">Issued Out</p>
          </div>
        </div>

        <div className="bg-purple-50 rounded-xl p-3 flex gap-3">
          <BookOpen size={18} className="text-purple-600"/>
          <div>
            <p className="text-lg font-bold text-purple-600">
              {categories.length - 1}
            </p>
            <p className="text-xs text-gray-500">Categories</p>
          </div>
        </div>

      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 flex flex-wrap gap-3 items-center">

        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>

          <input
            type="text"
            placeholder="Search book..."
            value={search}
            onChange={(e)=>{setSearch(e.target.value);setPage(1)}}
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm"
          />
        </div>

        <div className="relative">
          <select
            value={category}
            onChange={(e)=>{setCategory(e.target.value);setPage(1)}}
            className="appearance-none pl-3 pr-8 py-2 border rounded-lg text-sm"
          >
            {categories.map(c=>(
              <option key={c}>{c}</option>
            ))}
          </select>

          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"/>
        </div>

        <div className="flex border rounded-lg overflow-hidden">
          {["All","Available","Issued"].map((f)=>(
            <button
              key={f}
              onClick={()=>{setAvailFilter(f);setPage(1)}}
              className={`px-3 py-2 text-xs ${availFilter===f ? "bg-blue-600 text-white":"text-gray-600"}`}
            >
              {f}
            </button>
          ))}
        </div>

        <span className="text-xs text-gray-400 ml-auto">
          {filtered.length} books
        </span>

      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden overflow-x-auto">

        <table className="w-full min-w-[700px]">

          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs">Title</th>
              <th className="px-5 py-3 text-left text-xs">Author</th>
              <th className="px-5 py-3 text-left text-xs">ISBN</th>
              <th className="px-5 py-3 text-left text-xs">Serial</th>
              <th className="px-5 py-3 text-left text-xs">Category</th>
              <th className="px-5 py-3 text-left text-xs">Availability</th>
              <th className="px-5 py-3 text-left text-xs">Actions</th>
            </tr>
          </thead>

          <tbody>

            {paginated.map((b)=>(
              <tr key={b.id} className="border-t">

                <td className="px-5 py-3">{b.title}</td>
                <td className="px-5 py-3">{b.author}</td>
                <td className="px-5 py-3">{b.isbn}</td>
                <td className="px-5 py-3">{b.serial}</td>
                <td className="px-5 py-3">{b.category}</td>

                <td className="px-5 py-3">
                  {((b.total || 0) - (b.issuedCount || 0)) > 0 ? `${(b.total || 0) - (b.issuedCount || 0)}/${b.total}` : "Issued"}
                </td>

                <td className="px-5 py-3 flex gap-2">

                  <button onClick={() => fetchIssuedForBook(b.serial)} title="View Issued"><Eye size={14}/></button>

                  <button><Edit2 size={14}/></button>

                  <button onClick={()=>deleteBook(b.id)}>
                    <Trash2 size={14}/>
                  </button>

                </td>

              </tr>
            ))}

          </tbody>

        </table>

      </div>

      {/* Pagination */}
      <div className="flex justify-end gap-2">

        <button
          onClick={()=>setPage(Math.max(1,page-1))}
          className="p-1.5"
        >
          <ChevronLeft size={15}/>
        </button>

        <span className="text-sm">
          {page} / {totalPages}
        </span>

        <button
          onClick={()=>setPage(Math.min(totalPages,page+1))}
          className="p-1.5"
        >
          <ChevronRight size={15}/>
        </button>

      </div>

      {/* View Issued Modal */}
      {viewIssuedFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold">Issued Students – {viewIssuedFor}</h3>
              <button onClick={() => { setViewIssuedFor(null); setIssuedList([]); }} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="overflow-auto max-h-64 p-4">
              {issuedList.length === 0 ? (
                <p className="text-sm text-gray-500">No issued copies for this book.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-gray-500"><th className="py-2">Student</th><th>Roll No</th><th>Issue Date</th></tr></thead>
                  <tbody>
                    {issuedList.map((r) => (
                      <tr key={r.rollNo} className="border-t"><td className="py-2">{r.name}</td><td className="font-mono">{r.rollNo}</td><td>{r.issue_date ? new Date(r.issue_date).toLocaleDateString() : "-"}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Book Modal */}
      {showAddModal && (

        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">

          <div className="bg-white rounded-xl w-full max-w-lg">

            <div className="p-6 space-y-4">

              <h2 className="text-lg">Add Book</h2>

              <input
                placeholder="Title"
                className="w-full border p-2 rounded"
                value={newBook.title}
                onChange={(e)=>setNewBook({...newBook,title:e.target.value})}
              />

              <input
                placeholder="Author"
                className="w-full border p-2 rounded"
                value={newBook.author}
                onChange={(e)=>setNewBook({...newBook,author:e.target.value})}
              />

              <input
                placeholder="ISBN"
                className="w-full border p-2 rounded"
                value={newBook.isbn}
                onChange={(e)=>setNewBook({...newBook,isbn:e.target.value})}
              />

              <input
                placeholder="Serial"
                className="w-full border p-2 rounded"
                value={newBook.serial}
                onChange={(e)=>setNewBook({...newBook,serial:e.target.value})}
              />

              <input
                type="number"
                placeholder="Total"
                className="w-full border p-2 rounded"
                value={newBook.total}
                onChange={(e)=>setNewBook({...newBook,total:Number(e.target.value)})}
              />

              <div className="flex justify-end gap-3">

                <button
                  onClick={()=>setShowAddModal(false)}
                  className="px-4 py-2 border rounded"
                >
                  Cancel
                </button>

                <button
                  onClick={addBook}
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                  Add Book
                </button>

              </div>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}

