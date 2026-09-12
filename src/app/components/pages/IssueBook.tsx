import { useState } from 'react';
import { Search, CheckCircle } from 'lucide-react';
import { requestJson, jsonBody } from '@/lib/api';
export function IssueBook() {
  const [studentQuery,setStudentQuery]=useState('');const [bookQuery,setBookQuery]=useState('');
  const [student,setStudent]=useState<any>(null);const [book,setBook]=useState<any>(null);
  const [students,setStudents]=useState<any[]>([]);const [books,setBooks]=useState<any[]>([]);
  const [policy,setPolicy]=useState<any>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [result,setResult]=useState<any>(null);
  async function search(kind:'student'|'book') {
    const query=(kind==='student'?studentQuery:bookQuery).trim();if(!query)return;
    setBusy(true);setError('');if(kind==='student'){setStudent(null);setStudents([]);}else{setBook(null);setBooks([]);}
    try{const data=await requestJson(`/api/${kind}/${encodeURIComponent(query)}`);setPolicy(data.policy);if(kind==='student'){setStudents(data.matches);setStudent(data.student);}else{setBooks(data.matches);setBook(data.book);}if(!data.matches.length)setError(`No matching ${kind}.`);}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function issue(){
    setBusy(true);setError('');
    try{setResult(await requestJson('/api/issue',{method:'POST',...jsonBody({registration_no:student.registration_no,accession_no:book.accession_no})}));window.dispatchEvent(new Event('catalog-updated'));}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  function reset(){setStudent(null);setBook(null);setStudents([]);setBooks([]);setStudentQuery('');setBookQuery('');setResult(null);setError('');}
  if(result)return <div className="p-6"><div className="bg-white rounded-xl border p-8 max-w-xl mx-auto text-center space-y-4"><CheckCircle className="mx-auto text-emerald-600" size={40}/><h1 className="text-xl font-semibold">Book issued successfully</h1><p>{book.title} ({book.accession_no})</p><p>{student.name} · {student.registration_no}</p><p>Issued: {result.issueDate} · Due: <strong>{result.dueDate}</strong></p><button onClick={reset} className="px-5 py-2 rounded-lg bg-blue-800 text-white">Issue another book</button></div></div>;
  return <div className="p-4 md:p-6 space-y-5"><div><h1 className="text-xl font-semibold">Issue Book</h1><p className="text-sm text-slate-500 mt-1">Verify a borrower and select an available physical copy.</p></div>
    {error&&<p role="alert" className="p-3 bg-red-50 text-red-700 rounded-lg">{error}</p>}
    <div className="grid lg:grid-cols-2 gap-5">{(['student','book'] as const).map(kind=>{
      const isStudent=kind==='student';const query=isStudent?studentQuery:bookQuery;const selected=isStudent?student:book;const matches=isStudent?students:books;
      return <section key={kind} className="bg-white p-5 rounded-xl border space-y-4"><h2 className="font-semibold">{isStudent?'1. Verify student':'2. Select book'}</h2><form onSubmit={e=>{e.preventDefault();search(kind);}} className="flex gap-2"><label className="flex-1 text-sm">{isStudent?'Registration No. or Name':'Accession No. or Title'}<input required disabled={busy} value={query} onChange={e=>{if(isStudent){setStudentQuery(e.target.value);setStudent(null);setStudents([]);}else{setBookQuery(e.target.value);setBook(null);setBooks([]);}}} className="block w-full border p-2 rounded-lg mt-1"/></label><button disabled={busy} className="self-end p-2.5 bg-blue-800 rounded-lg text-white disabled:opacity-40" aria-label={`Search ${kind}`}><Search size={20}/></button></form>
      {matches.length>1&&!selected&&<p className="text-sm text-amber-800">Multiple matches (up to 20). Select the correct {kind} or search by its unique number.</p>}
      {!selected&&matches.map(row=><button key={row.id} onClick={()=>isStudent?setStudent(row):setBook(row)} className="w-full text-left border rounded-lg p-3 hover:bg-blue-50"><p className="font-medium">{isStudent?row.name:row.title}</p><p className="text-sm text-slate-600">{isStudent?`${row.registration_no} · ${row.email||row.department||'No email'}`:`${row.accession_no} · ${row.activeIssues?'Already issued':'Available'}`}</p></button>)}
      {selected&&<div className="p-4 bg-blue-50 rounded-lg space-y-1"><p className="font-semibold">{isStudent?selected.name:selected.title}</p><p className="font-mono text-sm">{isStudent?selected.registration_no:selected.accession_no}</p>{isStudent?<><p className="text-sm">{selected.email||'No email recorded'} · {selected.department}</p><p className="text-sm">{selected.status} · {selected.issued} / {policy?.maxBooks} books borrowed</p></>:<p className={`text-sm ${selected.activeIssues?'text-red-700':'text-emerald-700'}`}>{selected.activeIssues?'Already issued. Choose another copy.':'Available for borrowing'}</p>}</div>}
      </section>;
    })}</div>
    {policy&&<p className="text-sm text-slate-600">Current policy: maximum {policy.maxBooks} books, {policy.issueDays} days per loan, PKR {policy.finePerDay}/day overdue. The server applies the current policy when issuing.</p>}
    <button disabled={busy||!student||!book||Number(book.activeIssues)>0||student.status!=='Active'||Number(student.issued)>=policy?.maxBooks} onClick={issue} className="px-6 py-3 rounded-xl bg-blue-800 text-white disabled:opacity-40">{busy?'Processing…':'Issue book to selected student'}</button>
  </div>;
}
