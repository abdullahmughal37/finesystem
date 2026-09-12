import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BadgeCheck, BookOpen, ChevronLeft, ChevronRight, Download, FileCheck2, History, Search, ShieldX } from 'lucide-react';
import { downloadFile, jsonBody, requestJson } from '@/lib/api';

type Student = { id:number; name:string; registration_no:string; department?:string; semester?:string; email?:string; status?:string };
type Issue = { id:number; accession_no:string; title:string; issue_date:string; due_date:string };
type Fine = { id:number; fine_amount:number; reason:string; status:string; accession_no?:string; book_title?:string };
type Check = { eligible:boolean; student:Student; activeIssues:Issue[]; unresolvedFines:Fine[]; fineTotal:number; blockers:{type:string;message:string}[] };
type Letter = { id:number; referenceNumber:string; studentName:string; registrationNumber:string; purpose:string; status:'issued'|'revoked'; templateVersion:number; generatedByName:string; issuedAt:string; revokedAt?:string; revocationReason?:string };

const purposes = ['Degree issuance', 'Examination', 'Migration / withdrawal', 'Transcript issuance', 'Other'];
const date = (value?:string) => value ? new Date(value).toLocaleString() : '—';

export function Clearance() {
  const [query,setQuery]=useState('');
  const [students,setStudents]=useState<Student[]>([]);
  const [selected,setSelected]=useState<Student|null>(null);
  const [check,setCheck]=useState<Check|null>(null);
  const [purpose,setPurpose]=useState(purposes[0]);
  const [customPurpose,setCustomPurpose]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [letters,setLetters]=useState<Letter[]>([]);
  const [total,setTotal]=useState(0);
  const [page,setPage]=useState(1);
  const [historySearch,setHistorySearch]=useState('');
  const [historyDraft,setHistoryDraft]=useState('');
  const [revoking,setRevoking]=useState<Letter|null>(null);
  const [revokeReason,setRevokeReason]=useState('');

  const loadLetters=useCallback(async()=>{
    const qs=new URLSearchParams({page:String(page),limit:'25'});if(historySearch)qs.set('search',historySearch);
    const data=await requestJson(`/api/clearance/letters?${qs}`);setLetters(data.rows||[]);setTotal(Number(data.total)||0);
  },[page,historySearch]);
  useEffect(()=>{void loadLetters().catch(e=>setError((e as Error).message));},[loadLetters]);

  async function searchStudents(event:FormEvent){
    event.preventDefault();setError('');setNotice('');setSelected(null);setCheck(null);
    if(!query.trim()){setStudents([]);return;}
    setLoading(true);try{const data=await requestJson(`/api/students?search=${encodeURIComponent(query.trim())}&limit=20`);setStudents(data.rows||[]);if(data.rows?.length===1)await choose(data.rows[0]);}catch(e){setError((e as Error).message);}finally{setLoading(false);}
  }
  async function choose(student:Student){setSelected(student);setStudents([]);setLoading(true);setError('');try{setCheck(await requestJson(`/api/clearance/check/${student.id}`));}catch(e){setCheck(null);setError((e as Error).message);}finally{setLoading(false);}}
  async function refreshCheck(){if(selected)await choose(selected);}
  async function issue(){
    if(!selected||!check?.eligible)return;const finalPurpose=purpose==='Other'?customPurpose.trim():purpose;
    setLoading(true);setError('');setNotice('');try{const result=await requestJson('/api/clearance/issue',{method:'POST',...jsonBody({studentId:selected.id,purpose:finalPurpose})});setNotice(`Clearance ${result.referenceNumber} issued and stored successfully.`);await Promise.all([loadLetters(),refreshCheck()]);}catch(e){setError((e as Error).message);await refreshCheck().catch(()=>{});}finally{setLoading(false);}
  }
  async function revoke(){if(!revoking)return;setLoading(true);setError('');try{await requestJson(`/api/clearance/letters/${revoking.id}/revoke`,{method:'POST',...jsonBody({reason:revokeReason})});setRevoking(null);setRevokeReason('');setNotice('Clearance letter revoked. Its audit record and PDF were preserved.');await loadLetters();}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
  const pages=Math.max(1,Math.ceil(total/25));
  const issued=useMemo(()=>letters.filter(letter=>letter.status==='issued').length,[letters]);

  return <div className="p-4 md:p-6 space-y-5">
    <div><h1 className="text-gray-800">Student Clearance</h1><p className="text-sm text-gray-500 mt-0.5">Check obligations, issue verified letters, and preserve the complete history</p></div>
    {notice&&<p role="status" className="p-3 rounded-lg bg-emerald-50 text-emerald-800 text-sm">{notice}</p>}
    {error&&<p role="alert" className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</p>}

    <div className="grid xl:grid-cols-[1fr_1.25fr] gap-5">
      <section className="bg-white border rounded-xl shadow-sm p-5 space-y-4">
        <div><h2 className="font-semibold text-gray-800">Check a student</h2><p className="text-xs text-gray-500 mt-1">Use a registration number, name, email, or department.</p></div>
        <form onSubmit={searchStudents} className="flex gap-2"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input value={query} onChange={e=>setQuery(e.target.value)} className="w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm" placeholder="Registration number or student name"/></div><button disabled={loading} className="px-4 py-2.5 bg-blue-800 text-white rounded-lg text-sm disabled:opacity-50">Search</button></form>
        {students.length>0&&<div className="border rounded-lg divide-y max-h-64 overflow-y-auto">{students.map(student=><button key={student.id} onClick={()=>void choose(student)} className="w-full text-left p-3 hover:bg-blue-50"><p className="text-sm font-medium">{student.name}</p><p className="text-xs font-mono text-blue-700">{student.registration_no}</p><p className="text-xs text-gray-500">{student.department||'No department'}</p></button>)}</div>}
        {selected&&<div className="rounded-xl bg-slate-50 border p-4"><div className="flex justify-between gap-3"><div><p className="font-semibold text-gray-900">{selected.name}</p><p className="text-sm font-mono text-blue-700">{selected.registration_no}</p></div><span className="text-xs px-2 py-1 h-fit rounded-full bg-white border">{selected.status||'Unknown'}</span></div><div className="grid grid-cols-2 gap-2 mt-3 text-xs text-gray-600"><p>Department: {selected.department||'—'}</p><p>Semester: {selected.semester||'—'}</p><p className="col-span-2">Email: {selected.email||'—'}</p></div></div>}
        {check&&<div className={`rounded-xl border p-4 ${check.eligible?'bg-emerald-50 border-emerald-200':'bg-red-50 border-red-200'}`}><div className="flex items-center gap-2">{check.eligible?<BadgeCheck className="text-emerald-700"/>:<ShieldX className="text-red-700"/>}<h3 className={`font-semibold ${check.eligible?'text-emerald-900':'text-red-900'}`}>{check.eligible?'Ready for library clearance':'Clearance is pending'}</h3></div><p className="text-xs mt-2 text-gray-700">{check.eligible?'No issued books or unresolved fines were found. The server will check again during issuance.':`${check.activeIssues.length} issued book(s) and ${check.unresolvedFines.length} unresolved fine(s) must be completed.`}</p></div>}
      </section>

      <section className="bg-white border rounded-xl shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between"><div><h2 className="font-semibold text-gray-800">Eligibility details</h2><p className="text-xs text-gray-500 mt-1">Current records from circulation and fines</p></div>{selected&&<button disabled={loading} onClick={()=>void refreshCheck()} className="text-xs px-3 py-2 border rounded-lg">Refresh checks</button>}</div>
        {!check?<div className="py-16 text-center text-gray-400"><FileCheck2 className="mx-auto mb-2"/><p className="text-sm">Select a student to run clearance checks.</p></div>:<>
          {check.activeIssues.length>0&&<div><h3 className="text-sm font-semibold flex items-center gap-2 text-red-800"><BookOpen size={15}/>Books that must be returned</h3><div className="mt-2 border rounded-lg divide-y">{check.activeIssues.map(issue=><div key={issue.id} className="p-3 text-sm"><p className="font-medium">{issue.title}</p><p className="text-xs text-gray-500"><span className="font-mono">{issue.accession_no}</span> · Due {issue.due_date}</p></div>)}</div></div>}
          {check.unresolvedFines.length>0&&<div><h3 className="text-sm font-semibold flex items-center gap-2 text-red-800"><AlertTriangle size={15}/>Unresolved fines — PKR {Number(check.fineTotal).toLocaleString()}</h3><div className="mt-2 border rounded-lg divide-y">{check.unresolvedFines.map(fine=><div key={fine.id} className="p-3 text-sm flex justify-between gap-3"><div><p className="font-medium">Fine #{fine.id}: {fine.reason}</p><p className="text-xs text-gray-500">{fine.status==='sent'?'Sent to Accounts':'Not sent to Accounts'}{fine.book_title?` · ${fine.book_title}`:''}</p></div><strong>PKR {Number(fine.fine_amount).toLocaleString()}</strong></div>)}</div></div>}
          {!check.eligible&&selected&&<button onClick={()=>downloadFile(`/api/clearance/pending/${selected.id}/pdf`,`pending-clearance-${selected.registration_no}.pdf`).catch(e=>setError(e.message))} className="w-full py-2.5 border border-red-200 text-red-800 rounded-lg text-sm font-medium"><Download size={15} className="inline mr-2"/>Download pending report</button>}
          {check.eligible&&<div className="space-y-3"><label className="block text-sm font-medium text-gray-700">Purpose<select value={purpose} onChange={e=>setPurpose(e.target.value)} className="block w-full mt-1 px-3 py-2.5 border rounded-lg bg-white">{purposes.map(item=><option key={item}>{item}</option>)}</select></label>{purpose==='Other'&&<label className="block text-sm font-medium text-gray-700">Custom purpose<input value={customPurpose} onChange={e=>setCustomPurpose(e.target.value)} maxLength={150} className="block w-full mt-1 px-3 py-2.5 border rounded-lg"/></label>}<button onClick={()=>void issue()} disabled={loading||(purpose==='Other'&&customPurpose.trim().length<3)} className="w-full py-3 rounded-lg bg-emerald-700 text-white font-medium text-sm disabled:opacity-40"><FileCheck2 size={16} className="inline mr-2"/>{loading?'Checking and generating…':'Issue clearance letter'}</button><p className="text-xs text-gray-500 text-center">Eligibility is rechecked inside the same database transaction used to issue the letter.</p></div>}
        </>}
      </section>
    </div>

    <section className="bg-white border rounded-xl shadow-sm overflow-hidden">
      <div className="p-5 border-b flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-gray-800 flex items-center gap-2"><History size={17}/>Issued-letter history</h2><p className="text-xs text-gray-500 mt-1">{total} permanent record(s); {issued} issued on this page</p></div><form onSubmit={e=>{e.preventDefault();setPage(1);setHistorySearch(historyDraft.trim());}} className="flex gap-2"><input value={historyDraft} onChange={e=>setHistoryDraft(e.target.value)} placeholder="Reference or student" className="px-3 py-2 border rounded-lg text-sm"/><button className="px-3 py-2 border rounded-lg text-sm">Search</button></form></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1050px]"><thead><tr className="bg-gray-50 border-b">{['Reference','Student','Purpose','Status','Template','Issued by','Issued at','Actions'].map(label=><th key={label} className="text-left px-4 py-3 text-xs uppercase text-gray-500">{label}</th>)}</tr></thead><tbody className="divide-y">{letters.map(letter=><tr key={letter.id} className="hover:bg-gray-50"><td className="px-4 py-3 text-xs font-mono text-blue-700">{letter.referenceNumber}</td><td className="px-4 py-3"><p className="text-sm font-medium">{letter.studentName}</p><p className="text-xs font-mono text-gray-500">{letter.registrationNumber}</p></td><td className="px-4 py-3 text-sm">{letter.purpose}</td><td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full ${letter.status==='issued'?'bg-emerald-100 text-emerald-800':'bg-red-100 text-red-800'}`}>{letter.status}</span>{letter.revocationReason&&<p className="text-xs text-red-600 mt-1 max-w-[220px]">{letter.revocationReason}</p>}</td><td className="px-4 py-3 text-xs">v{letter.templateVersion}</td><td className="px-4 py-3 text-xs">{letter.generatedByName||'Administrator'}</td><td className="px-4 py-3 text-xs text-gray-500">{date(letter.issuedAt)}</td><td className="px-4 py-3"><div className="flex gap-1"><button title="Download stored PDF" onClick={()=>downloadFile(`/api/clearance/letters/${letter.id}/pdf`,`${letter.referenceNumber}.pdf`).catch(e=>setError(e.message))} className="p-2 text-blue-700 hover:bg-blue-50 rounded-lg"><Download size={16}/></button>{letter.status==='issued'&&<button title="Revoke letter" onClick={()=>{setRevoking(letter);setRevokeReason('');}} className="p-2 text-red-700 hover:bg-red-50 rounded-lg"><ShieldX size={16}/></button>}</div></td></tr>)}</tbody></table></div>
      {letters.length===0&&<p className="py-10 text-center text-sm text-gray-500">No clearance letters found.</p>}
      <div className="px-5 py-3 border-t flex justify-between items-center"><p className="text-xs text-gray-500">Page {page} of {pages}</p><div className="flex gap-1"><button aria-label="Previous page" disabled={page===1} onClick={()=>setPage(page-1)} className="p-2 disabled:opacity-30"><ChevronLeft size={16}/></button><button aria-label="Next page" disabled={page===pages} onClick={()=>setPage(page+1)} className="p-2 disabled:opacity-30"><ChevronRight size={16}/></button></div></div>
    </section>
    {revoking&&<div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onMouseDown={e=>e.target===e.currentTarget&&!loading&&setRevoking(null)}><div role="dialog" aria-modal="true" className="bg-white rounded-2xl w-full max-w-md shadow-xl"><div className="p-5 border-b"><h2 className="font-semibold">Revoke {revoking.referenceNumber}</h2></div><div className="p-5 space-y-3"><p className="text-sm text-gray-600">The PDF and audit record will remain stored, while verification will report the letter as revoked.</p><label className="text-sm font-medium">Reason<textarea autoFocus rows={3} maxLength={500} value={revokeReason} onChange={e=>setRevokeReason(e.target.value)} className="block w-full mt-1 border rounded-lg p-3"/></label></div><div className="p-4 border-t flex justify-end gap-2"><button onClick={()=>setRevoking(null)} disabled={loading} className="px-4 py-2 border rounded-lg text-sm">Cancel</button><button onClick={()=>void revoke()} disabled={loading||revokeReason.trim().length<3} className="px-4 py-2 bg-red-700 text-white rounded-lg text-sm disabled:opacity-40">Revoke letter</button></div></div></div>}
  </div>;
}
