import { useEffect, useState, type FormEvent } from 'react';
import { Search, Plus, Upload, Eye, Edit2, Trash2, RefreshCw } from 'lucide-react';
import { requestJson, jsonBody } from '@/lib/api';
import { Modal } from './Modal';
import { ImportDialog } from './ImportDialog';
import { recordValues, type CatalogLayout, type CatalogField } from '@/lib/fields';
type Row = Record<string, any>;
export function Catalog({ kind }: { kind: 'students' | 'books' }) {
  const [layout,setLayout]=useState<CatalogLayout|null>(null);
  const [layoutError,setLayoutError]=useState('');
  const [formFields,setFormFields]=useState<CatalogField[]>([]);
  const fields=layout?.fields.filter(f=>!f.archived)||[];
  const isStudent = kind === 'students'; const singular = isStudent ? 'Student' : 'Book';
  const [rows, setRows] = useState<Row[]>([]); const [total, setTotal] = useState(0); const [stats, setStats] = useState<Row>({});
  const [page, setPage] = useState(1); const [search, setSearch] = useState(''); const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<Row | null>(null); const [viewing, setViewing] = useState<Row | null>(null); const [history, setHistory] = useState<Row[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false); const [historyError, setHistoryError] = useState('');
  const [importing, setImporting] = useState(false); const [busy, setBusy] = useState(false); const [formError, setFormError] = useState('');
  const limit = 25; const pages = Math.max(1, Math.ceil(total / limit));
  const reload = () => { setVersion(v => v + 1); window.dispatchEvent(new Event('catalog-updated')); };
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    const timer = setTimeout(async () => {
      try {
        const data = await requestJson(`/api/${kind}?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`, { signal: controller.signal });
        setRows(data.rows.map(recordValues)); setTotal(Number(data.total)); setStats(data.stats || {});
        const last = Math.max(1, Math.ceil(Number(data.total) / limit)); if (page > last) setPage(last);
      } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [kind, page, search, version]);
  useEffect(()=>{const controller=new AbortController();requestJson(`/api/settings/layouts/${kind}`,{signal:controller.signal}).then(data=>{setLayout(data);setLayoutError('');}).catch(e=>{if(!controller.signal.aborted)setLayoutError(e.message);});return()=>controller.abort();},[kind,version]);
  useEffect(()=>{const update=()=>setVersion(v=>v+1);window.addEventListener('layout-updated',update);window.addEventListener('storage',update);window.addEventListener('focus',update);return()=>{window.removeEventListener('layout-updated',update);window.removeEventListener('storage',update);window.removeEventListener('focus',update);};},[]);
  function openForm(row?: Row) {
    if(!layout || layoutError)return;setFormFields(fields.filter(f=>f.showInForm));
    setEditing({...(row ? { ...row } : Object.fromEntries(fields.map(f => [f.key, f.key === 'status' ? 'Active' : f.key === 'total_copies' ? 1 : f.core && f.type === 'number' ? 0 : '']))),layoutRevision:layout?.revision}); setFormError('');
  }
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!editing) return; setBusy(true); setFormError('');
    try { await requestJson(`/api/${kind}${editing.id ? `/${editing.id}` : ''}`, { method: editing.id ? 'PUT' : 'POST', ...jsonBody(editing) }); setNotice(`${singular} ${editing.id ? 'updated' : 'added'} successfully.`); setEditing(null); reload(); }
    catch (e) { setFormError((e as Error).message); } finally { setBusy(false); }
  }
  async function remove(row: Row) {
    if (!window.confirm(`Delete ${isStudent ? row.name : row.title}? Records with loan or fine history cannot be deleted.`)) return;
    setBusy(true); setError('');
    try { await requestJson(`/api/${kind}/${row.id}`, { method: 'DELETE' }); setNotice(`${singular} deleted.`); reload(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  useEffect(() => {
    if (!viewing || isStudent) return;
    const controller = new AbortController(); setHistory([]); setHistoryError(''); setHistoryLoading(true);
    requestJson(`/api/books/issued/${encodeURIComponent(viewing.accession_no)}`, { signal: controller.signal }).then(setHistory).catch(e => { if (!controller.signal.aborted) setHistoryError(e.message); }).finally(() => { if (!controller.signal.aborted) setHistoryLoading(false); });
    return () => controller.abort();
  }, [viewing, isStudent]);
  const columns = fields.filter(f=>f.showInTable);
  return <div className="p-4 md:p-6 space-y-5">
    <div className="flex flex-wrap justify-between items-center gap-3"><div><h1 className="text-xl font-semibold text-slate-900">{isStudent ? 'Students' : 'Books Catalog'}</h1><p className="text-sm text-slate-500 mt-1">{isStudent ? 'University student records and CSV imports' : 'Book records, copy counts, availability, and borrowing history'}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => setImporting(true)} className="flex gap-2 items-center border px-4 py-2 rounded-lg text-sm"><Upload size={16} />Import CSV</button><button disabled={!layout || !!layoutError} onClick={() => openForm()} className="flex gap-2 items-center bg-blue-800 text-white px-4 py-2 rounded-lg text-sm"><Plus size={16} />Add {singular}</button></div></div>
    {!isStudent && <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[['total', 'Total copies'], ['available', 'Available'], ['issued', 'Issued copies'], ['overdue', 'Overdue copies']].map(([key, label]) => <div key={key} className="bg-white border rounded-xl p-4"><p className="text-sm text-slate-500">{label}</p><p className="font-bold text-2xl text-blue-900 mt-1">{loading || error ? '—' : stats[key] ?? 0}</p></div>)}</div>}
    {notice && <p role="status" className="bg-emerald-50 text-emerald-800 p-3 rounded-lg text-sm">{notice}</p>}
    {(error || layoutError) && <div role="alert" className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error || layoutError} <button onClick={reload} className="underline ml-2">Retry</button></div>}
    <div className="bg-white p-4 border rounded-xl flex gap-3 items-center"><Search size={18} className="text-slate-400" /><input aria-label={`Search ${kind}`} placeholder={isStudent ? 'Search name, registration, email, contact, or custom fields' : 'Search title, accession, author, ISBN, or custom fields'} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="flex-1 min-w-0 text-sm outline-none" /><button aria-label="Refresh records" onClick={reload}><RefreshCw size={17} /></button></div>
    <div className="bg-white border rounded-xl overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="p-3 text-left whitespace-nowrap">Sr #</th>{columns.map(f => <th key={f.key} className="p-3 text-left whitespace-nowrap">{f.label}</th>)}{!isStudent && <th className="p-3 text-left">Availability</th>}<th className="p-3 text-left">Actions</th></tr></thead><tbody>
      {loading ? <tr><td className="p-8 text-center text-slate-500" colSpan={columns.length + 3}>Loading records…</td></tr> : error ? <tr><td className="p-8 text-center" colSpan={columns.length + 3}>Records could not be loaded.</td></tr> : !rows.length ? <tr><td className="p-8 text-center text-slate-500" colSpan={columns.length + 3}>{search ? 'No matching records.' : `No ${kind} yet. Add one or import a CSV.`}</td></tr> : rows.map((row, i) => <tr key={row.id} className="border-t hover:bg-slate-50"><td className="p-3 text-slate-500">{(page - 1) * limit + i + 1}</td>{columns.map(f => <td key={f.key} title={String(row[f.key] ?? '')} className={`p-3 max-w-60 truncate ${f.key === 'name' || f.key === 'title' ? 'font-medium' : 'text-slate-600'}`}>{row[f.key] === '' || row[f.key] == null ? '—' : row[f.key]}</td>)}{!isStudent && <td className="p-3 whitespace-nowrap"><span className={`px-2 py-1 rounded-full text-xs ${row.overdueCount ? 'bg-red-50 text-red-700' : Number(row.availableCount)===0 ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>{row.availableCount} / {row.total_copies} available</span>{Number(row.overdueCount)>0&&<p className="text-red-700 text-xs mt-1">{row.overdueCount} overdue</p>}</td>}<td className="p-3"><div className="flex gap-2"><button aria-label={`View ${isStudent ? row.name : row.title}`} onClick={() => setViewing(row)} className="p-1.5 hover:bg-blue-50 rounded"><Eye size={16} /></button><button aria-label={`Edit ${isStudent ? row.name : row.title}`} onClick={() => openForm(row)} className="p-1.5 hover:bg-blue-50 rounded"><Edit2 size={16} /></button><button disabled={busy} aria-label={`Delete ${isStudent ? row.name : row.title}`} onClick={() => remove(row)} className="p-1.5 text-red-600 hover:bg-red-50 rounded disabled:opacity-40"><Trash2 size={16} /></button></div></td></tr>)}
    </tbody></table></div><div className="p-4 border-t flex justify-between items-center gap-3 text-sm"><span>{loading || error ? '—' : `${total} ${kind}${search ? ' matched' : ''}`}</span><div className="flex items-center gap-3"><button disabled={page === 1 || loading} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 border rounded disabled:opacity-40">Previous</button><span>{page} / {pages}</span><button disabled={page >= pages || loading} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 border rounded disabled:opacity-40">Next</button></div></div></div>
    {editing && <Modal title={`${editing.id ? 'Edit' : 'Add'} ${singular}`} onClose={() => setEditing(null)} busy={busy}><form onSubmit={submit}><div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">{formFields.map(f => <label key={f.key} className={`block text-sm font-medium text-slate-700 ${f.width === 'full' ? 'sm:col-span-2' : ''}`}>{f.label}{f.required ? ' *' : ''}{f.type === 'select' ? <select aria-label={`${f.label}${f.required ? ' *' : ''}`} required={f.required} value={editing[f.key] ?? ''} onChange={e => setEditing({ ...editing, [f.key]: e.target.value })} className="block w-full mt-1 border p-2 rounded-lg"><option value="">Select {f.label}</option>{f.options.map(s => <option key={s}>{s}</option>)}</select> : f.type === 'textarea' ? <textarea required={f.required} value={editing[f.key] ?? ''} maxLength={5000} rows={3} onChange={e => setEditing({ ...editing, [f.key]: e.target.value })} className="block w-full mt-1 border p-2 rounded-lg" /> : <input required={f.required} type={f.type || 'text'} maxLength={255} min={f.key === 'total_copies' ? 1 : f.core && f.type === 'number' ? 0 : undefined} max={f.key === 'total_copies' ? 1000000 : f.key === 'cost' ? 99999999.99 : f.key === 'pages' ? 2147483647 : undefined} step={f.key === 'cost' ? '0.01' : f.type === 'number' ? (f.core ? '1' : 'any') : undefined} value={editing[f.key] ?? ''} onChange={e => setEditing({ ...editing, [f.key]: e.target.value })} className="block w-full mt-1 border p-2 rounded-lg" />}</label>)}{isStudent && <p className="text-xs text-slate-500 sm:col-span-2">Sr # is generated for the list. Registration numbers identify student records; students may share a name. Contact numbers and email addresses are stored separately.</p>}{formError && <p role="alert" className="text-sm text-red-700 bg-red-50 p-3 rounded sm:col-span-2">{formError}</p>}</div><div className="flex justify-end gap-3 p-5 border-t"><button type="button" disabled={busy} onClick={() => setEditing(null)} className="px-4 py-2 border rounded-lg">Cancel</button><button disabled={busy} className="px-4 py-2 bg-blue-800 text-white rounded-lg disabled:opacity-50">{busy ? 'Saving…' : `Save ${singular}`}</button></div></form></Modal>}
    {viewing && <Modal title={`${singular} details`} onClose={() => setViewing(null)}><div className="p-5 space-y-5"><dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">{fields.map(f => <div key={f.key}><dt className="text-xs text-slate-500">{f.label}</dt><dd className="text-sm mt-1 break-words whitespace-pre-wrap">{viewing[f.key] === '' || viewing[f.key] == null ? '—' : viewing[f.key]}</dd></div>)}</dl>{!isStudent && <section><h3 className="font-semibold mb-2">Borrowing history (latest 100 loans)</h3>{historyLoading ? <p>Loading history…</p> : historyError ? <p role="alert" className="text-red-700">{historyError}</p> : !history.length ? <p className="text-sm text-slate-500">This copy has no borrowing history.</p> : <div className="overflow-auto"><table className="w-full text-sm"><thead><tr>{['Student', 'Registration', 'Issued', 'Due', 'Returned', 'Status'].map(h => <th className="p-2 text-left" key={h}>{h}</th>)}</tr></thead><tbody>{history.map(r => <tr key={r.id} className="border-t"><td className="p-2">{r.name}</td><td className="p-2">{r.registration_no}</td><td className="p-2 whitespace-nowrap">{r.issue_date}</td><td className="p-2 whitespace-nowrap">{r.due_date}</td><td className="p-2 whitespace-nowrap">{r.return_date || '—'}</td><td className="p-2">{r.status}</td></tr>)}</tbody></table></div>}</section>}</div></Modal>}
    {importing && <ImportDialog kind={kind} onClose={() => setImporting(false)} onImported={() => { setNotice('Import completed. Review the import results for skipped rows.'); setPage(1); reload(); }} />}
  </div>;
}
