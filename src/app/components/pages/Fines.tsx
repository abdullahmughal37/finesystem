import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle, CheckCircle, ChevronDown, ChevronLeft, ChevronRight,
  Clock, DollarSign, Download, Plus, RotateCcw, Search, Send, Trash2, BadgeCheck, Ban,
} from 'lucide-react';
import { downloadFile, jsonBody, requestJson } from '@/lib/api';

const FINE_REASONS = ['Noise in library', 'Late book return', 'Damaged book', 'Lost book', 'Other'];
const PER_PAGE = 7;

type FineRow = {
  id: number;
  registrationNo: string;
  name: string;
  amount: number;
  reason: string;
  type: 'Auto' | 'Manual';
  status: 'Sent' | 'Unsent';
  resolution: 'Pending' | 'Paid' | 'Waived';
  resolutionReason: string;
  date: string;
};

type TrashRow = {
  trashId: number;
  fineId: number;
  registrationNo: string;
  studentName: string;
  accessionNo: string;
  bookTitle: string;
  fineAmount: number;
  fineType: string;
  reason: string;
  originalStatus: string;
  sentToAccounts: number;
  resolutionStatus: string;
  resolvedAt: string | null;
  resolutionReason: string;
  originalCreatedAt: string | null;
  deletionReason: string;
  deletedByName: string;
  deletedByEmail: string;
  deletedAt: string;
  expiresAt: string;
  daysRemaining: number;
};

const displayDate = (value?: string | null, withTime = false) => {
  if (!value) return '—';
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value;
  return withTime ? date.toLocaleString() : date.toLocaleDateString();
};

function GenFineModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [registrationNo, setRegistrationNo] = useState('');
  const [accessionNo, setAccessionNo] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('Noise in library');
  const [customReason, setCustomReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError('');
    if (!registrationNo.trim() || !amount || Number(amount) < 1) {
      setError('Registration number and a valid amount are required.');
      return;
    }
    setLoading(true);
    try {
      await requestJson('/api/fines/create', {
        method: 'POST',
        ...jsonBody({
          registration_no: registrationNo.trim(),
          accession_no: accessionNo.trim() || undefined,
          fine_amount: Number(amount),
          reason: reason === 'Other' ? customReason.trim() || 'Other' : reason,
        }),
      });
      onSuccess();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={event => event.target === event.currentTarget && !loading && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="generate-fine-title" className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 id="generate-fine-title" className="font-semibold text-gray-800">Generate Manual Fine</h2>
          <button aria-label="Close" disabled={loading} onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <label className="block text-sm font-medium text-gray-700">Student Registration Number<input autoFocus value={registrationNo} onChange={event => setRegistrationNo(event.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm font-mono" placeholder="FA21-BCS-001" /></label>
          <label className="block text-sm font-medium text-gray-700">Book Accession (optional)<input value={accessionNo} onChange={event => setAccessionNo(event.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm font-mono" placeholder="ACC-001" /></label>
          <label className="block text-sm font-medium text-gray-700">Fine Amount (PKR)<input type="number" min="1" max="99999999.99" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="500" /></label>
          <label className="block text-sm font-medium text-gray-700">Reason<span className="relative block mt-1"><select value={reason} onChange={event => setReason(event.target.value)} className="appearance-none w-full px-3 pr-8 py-2 border rounded-lg text-sm bg-white">{FINE_REASONS.map(item => <option key={item}>{item}</option>)}</select><ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" /></span></label>
          {reason === 'Other' && <label className="block text-sm font-medium text-gray-700">Custom Reason<input value={customReason} onChange={event => setCustomReason(event.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="Enter reason" /></label>}
          {error && <p role="alert" className="text-sm text-red-700 bg-red-50 p-3 rounded-lg">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button disabled={loading} onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
          <button disabled={loading} onClick={handleSubmit} className="px-5 py-2 rounded-lg text-sm text-white bg-blue-700 disabled:opacity-50">{loading ? 'Generating…' : 'Generate Fine'}</button>
        </div>
      </div>
    </div>
  );
}

function MoveFineModal({ fine, onClose, onMoved }: { fine: FineRow; onClose: () => void; onMoved: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function move() {
    setBusy(true);
    setError('');
    try {
      await requestJson(`/api/fines/${fine.id}/trash`, { method: 'POST', ...jsonBody({ reason }) });
      onMoved();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={event => event.target === event.currentTarget && !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="move-fine-title" className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b"><h2 id="move-fine-title" className="font-semibold text-gray-800">Move fine #{fine.id} to trash</h2></div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">The PKR {fine.amount.toLocaleString()} fine for {fine.name} will leave the active fine list. Its complete details will remain in Fine Trash for 90 days.</p>
          {fine.status === 'Sent' && <p className="text-sm text-amber-800 bg-amber-50 p-3 rounded-lg">This fine was sent to the Accounts Office. Trash will retain that sent status for reconciliation.</p>}
          <label className="block text-sm font-medium text-gray-700">Reason for removal<textarea autoFocus rows={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} className="block w-full mt-1.5 px-3 py-2 border rounded-lg" placeholder="Example: Fine generated in error" /></label>
          {error && <p role="alert" className="text-sm text-red-700 bg-red-50 p-3 rounded-lg">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button disabled={busy} onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
          <button disabled={busy || reason.trim().length < 3} onClick={move} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm disabled:opacity-40">{busy ? 'Moving…' : 'Move to trash'}</button>
        </div>
      </div>
    </div>
  );
}

function ResolveFineModal({ fine, resolution, onClose, onDone }: { fine:FineRow; resolution:'paid'|'waived'|'reopen'; onClose:()=>void; onDone:()=>void }) {
  const [reason,setReason]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function submit(){setBusy(true);setError('');try{await requestJson(`/api/fines/${fine.id}/${resolution==='reopen'?'reopen':'resolve'}`,{method:'POST',...jsonBody(resolution==='reopen'?{reason}:{resolution,reason})});onDone();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={e=>e.target===e.currentTarget&&!busy&&onClose()}><div role="dialog" aria-modal="true" className="bg-white rounded-2xl shadow-xl w-full max-w-md"><div className="p-5 border-b"><h2 className="font-semibold text-gray-800">{resolution==='paid'?'Mark fine as paid':resolution==='waived'?'Waive fine':'Reopen fine'} #{fine.id}</h2></div><div className="p-5 space-y-3"><p className="text-sm text-gray-600">Student: {fine.name} · PKR {fine.amount.toLocaleString()}</p><label className="block text-sm font-medium">Audit note<textarea autoFocus rows={3} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} className="block w-full mt-1 border rounded-lg p-3" placeholder={resolution==='paid'?'Example: Accounts receipt 1234 verified':resolution==='waived'?'Example: Approved by Head Librarian':'Explain why the fine is active again'}/></label>{error&&<p role="alert" className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</p>}</div><div className="p-4 border-t flex justify-end gap-2"><button disabled={busy} onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Cancel</button><button disabled={busy||reason.trim().length<3} onClick={()=>void submit()} className="px-4 py-2 bg-blue-800 text-white rounded-lg text-sm disabled:opacity-40">{busy?'Saving…':'Confirm'}</button></div></div></div>;
}

export function Fines() {
  const [view, setView] = useState<'active' | 'trash'>('active');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [showGenModal, setShowGenModal] = useState(false);
  const [page, setPage] = useState(1);
  const [unsentFines, setUnsentFines] = useState<any[]>([]);
  const [sentFines, setSentFines] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const [moving, setMoving] = useState<FineRow | null>(null);
  const [resolving, setResolving] = useState<{fine:FineRow;resolution:'paid'|'waived'|'reopen'}|null>(null);
  const [notice, setNotice] = useState('');
  const [pageError, setPageError] = useState('');
  const [trashRows, setTrashRows] = useState<TrashRow[]>([]);
  const [trashTotal, setTrashTotal] = useState(0);
  const [trashPage, setTrashPage] = useState(1);
  const [trashDraft, setTrashDraft] = useState('');
  const [trashSearch, setTrashSearch] = useState('');

  const loadActive = useCallback(async () => {
    const [unsent, sent] = await Promise.all([requestJson('/api/fines/unsent'), requestJson('/api/fines/sent')]);
    setUnsentFines(Array.isArray(unsent) ? unsent : []);
    setSentFines(Array.isArray(sent) ? sent : []);
  }, []);

  const loadTrash = useCallback(async () => {
    const query = new URLSearchParams({ page: String(trashPage), limit: '25' });
    if (trashSearch) query.set('search', trashSearch);
    const data = await requestJson(`/api/fines/trash?${query}`);
    setTrashRows(Array.isArray(data.rows) ? data.rows : []);
    setTrashTotal(Number(data.total) || 0);
  }, [trashPage, trashSearch]);

  useEffect(() => {
    setPageError('');
    void loadActive().catch(error => setPageError((error as Error).message));
  }, [loadActive]);

  useEffect(() => {
    setPageError('');
    void loadTrash().catch(error => setPageError((error as Error).message));
  }, [loadTrash]);

  const allFines = useMemo<FineRow[]>(() => [...unsentFines, ...sentFines].map((fine: any) => ({
    id: Number(fine.id) || 0,
    registrationNo: fine.registration_no || '',
    name: fine.name || '',
    amount: Number(fine.fine_amount) || 0,
    reason: fine.reason || (Number(fine.days_late) ? `Late return - ${fine.days_late} days` : 'Manual fine'),
    type: fine.fine_type === 'manual' ? 'Manual' : 'Auto',
    status: fine.status === 'sent' ? 'Sent' : 'Unsent',
    resolution: fine.resolution_status === 'paid' ? 'Paid' : fine.resolution_status === 'waived' ? 'Waived' : 'Pending',
    resolutionReason: fine.resolution_reason || '',
    date: fine.created_at || '',
  })).sort((a, b) => b.date.localeCompare(a.date)), [sentFines, unsentFines]);

  const filtered = useMemo(() => allFines.filter(fine => {
    const query = search.toLowerCase();
    return (fine.name.toLowerCase().includes(query) || fine.registrationNo.toLowerCase().includes(query) || String(fine.id).includes(query))
      && (statusFilter === 'All' || fine.resolution === statusFilter)
      && (typeFilter === 'All' || fine.type === typeFilter);
  }), [allFines, search, statusFilter, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const trashPages = Math.max(1, Math.ceil(trashTotal / 25));
  const totalFines = allFines.filter(fine=>fine.resolution==='Pending').reduce((sum, fine) => sum + fine.amount, 0);
  const sentAmount = allFines.filter(fine => fine.status === 'Sent'&&fine.resolution==='Pending').reduce((sum, fine) => sum + fine.amount, 0);
  const unsentAmount = totalFines - sentAmount;

  async function refreshAfterMove() {
    setMoving(null);
    setNotice('Fine moved to Fine Trash. It will be permanently removed automatically after 90 days.');
    await Promise.all([loadActive(), loadTrash()]);
  }

  async function sendToAccounts() {
    setSending(true);
    setPageError('');
    try {
      const result = await requestJson('/api/fines/send-to-account', { method: 'POST' });
      setNotice(`${result.updated || 0} fine(s) marked as sent to the Accounts Office.`);
      await loadActive();
    } catch (error) {
      setPageError((error as Error).message);
    } finally {
      setSending(false);
    }
  }

  function submitTrashSearch(event: FormEvent) {
    event.preventDefault();
    setTrashPage(1);
    setTrashSearch(trashDraft.trim());
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-gray-800">Fines Management</h1><p className="text-sm text-gray-500 mt-0.5">Track active fines and 90-day trash history</p></div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { setView(current => current === 'active' ? 'trash' : 'active'); setNotice(''); }} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm text-gray-700"><Trash2 size={15} />{view === 'active' ? `Fine Trash (${trashTotal})` : 'Back to active fines'}</button>
          {view === 'active' && <>
            <button onClick={sendToAccounts} disabled={sending || unsentFines.length === 0} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium bg-emerald-700 disabled:opacity-50"><Send size={15} />{sending ? 'Sending…' : 'Send to Account Office'}</button>
            <button onClick={() => downloadFile('/api/fines/export/csv', 'fines-export.csv').catch(error => setPageError(error.message))} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm text-gray-600"><Download size={15} />Export CSV</button>
            <button onClick={() => setShowGenModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium bg-blue-800"><Plus size={15} />Generate Fine</button>
          </>}
        </div>
      </div>

      {notice && <p role="status" className="bg-emerald-50 text-emerald-800 p-3 rounded-lg text-sm">{notice}</p>}
      {pageError && <p role="alert" className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{pageError}</p>}

      {view === 'active' ? <>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Fines', value: `PKR ${totalFines.toLocaleString()}`, icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Sent', value: `PKR ${sentAmount.toLocaleString()}`, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Pending', value: `PKR ${unsentAmount.toLocaleString()}`, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
            { label: 'Unsent Cases', value: unsentFines.length, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
          ].map(card => { const Icon = card.icon; return <div key={card.label} className={`${card.bg} rounded-xl p-4 flex items-center gap-3`}><Icon size={20} className={card.color} /><div><p className={`text-lg font-bold ${card.color}`}>{card.value}</p><p className="text-xs text-gray-500">{card.label}</p></div></div>; })}
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input placeholder="Search by student, registration, or fine ID" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm" /></div>
          <div className="flex rounded-lg border overflow-hidden">{['All', 'Pending', 'Paid', 'Waived'].map(item => <button key={item} onClick={() => { setStatusFilter(item); setPage(1); }} className={`px-3 py-2 text-xs font-medium ${statusFilter === item ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>{item}</button>)}</div>
          <div className="flex rounded-lg border overflow-hidden">{['All', 'Auto', 'Manual'].map(item => <button key={item} onClick={() => { setTypeFilter(item); setPage(1); }} className={`px-3 py-2 text-xs font-medium ${typeFilter === item ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>{item}</button>)}</div>
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} records</span>
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full min-w-[1100px]"><thead><tr className="bg-gray-50 border-b">{['Fine ID', 'Registration', 'Student Name', 'Amount', 'Reason', 'Type', 'Accounts', 'Resolution', 'Date', 'Action'].map(label => <th key={label} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">{label}</th>)}</tr></thead><tbody className="divide-y">{paginated.map(fine => <tr key={fine.id} className="hover:bg-gray-50"><td className="px-5 py-3.5 text-xs font-mono">{fine.id}</td><td className="px-5 py-3.5 text-xs font-mono text-blue-700">{fine.registrationNo}</td><td className="px-5 py-3.5 text-sm font-medium">{fine.name}</td><td className="px-5 py-3.5 text-sm font-bold">PKR {fine.amount.toLocaleString()}</td><td className="px-5 py-3.5 text-xs text-gray-600">{fine.reason}</td><td className="px-5 py-3.5 text-xs">{fine.type}</td><td className="px-5 py-3.5 text-xs">{fine.status}</td><td className="px-5 py-3.5"><span title={fine.resolutionReason} className={`text-xs px-2 py-1 rounded-full ${fine.resolution==='Pending'?'bg-amber-100 text-amber-800':fine.resolution==='Paid'?'bg-emerald-100 text-emerald-800':'bg-blue-100 text-blue-800'}`}>{fine.resolution}</span></td><td className="px-5 py-3.5 text-xs text-gray-500">{displayDate(fine.date)}</td><td className="px-5 py-3.5"><div className="flex">{fine.resolution==='Pending'?<><button aria-label={`Mark fine ${fine.id} paid`} title="Mark paid" onClick={()=>setResolving({fine,resolution:'paid'})} className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg"><BadgeCheck size={16}/></button><button aria-label={`Waive fine ${fine.id}`} title="Waive fine" onClick={()=>setResolving({fine,resolution:'waived'})} className="p-2 text-blue-700 hover:bg-blue-50 rounded-lg"><Ban size={16}/></button></>:<button aria-label={`Reopen fine ${fine.id}`} title="Reopen fine" onClick={()=>setResolving({fine,resolution:'reopen'})} className="p-2 text-amber-700 hover:bg-amber-50 rounded-lg"><RotateCcw size={16}/></button>}<button aria-label={`Move fine ${fine.id} to trash`} title="Move to Fine Trash" onClick={() => setMoving(fine)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button></div></td></tr>)}</tbody></table></div>
          {paginated.length === 0 && <p className="px-5 py-8 text-center text-gray-500">No fine records match the filters.</p>}
          <div className="flex items-center justify-between px-5 py-3 border-t"><p className="text-xs text-gray-500">Showing {filtered.length ? (page - 1) * PER_PAGE + 1 : 0}-{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}</p><div className="flex gap-1"><button aria-label="Previous page" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="p-1.5 disabled:opacity-40"><ChevronLeft size={15} /></button><span className="px-2 py-1 text-xs">{page} / {totalPages}</span><button aria-label="Next page" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="p-1.5 disabled:opacity-40"><ChevronRight size={15} /></button></div></div>
        </div>
      </> : <>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4"><h2 className="font-semibold text-blue-900">Fine Trash</h2><p className="text-sm text-blue-800 mt-1">Deleted fines retain their original student, book, amount, status, removal reason, and administrator details for 90 days. Expired records are purged at startup and every six hours.</p></div>
        <form onSubmit={submitTrashSearch} className="bg-white rounded-xl border p-4 flex gap-2"><div className="relative flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={trashDraft} onChange={event => setTrashDraft(event.target.value)} placeholder="Search trash by student, registration, accession, or fine ID" className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm" /></div><button className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm">Search</button></form>
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full min-w-[1250px]"><thead><tr className="bg-gray-50 border-b">{['Fine ID', 'Student', 'Book', 'Amount', 'Fine details', 'Original status', 'Removal reason', 'Removed by', 'Removed', 'Expires'].map(label => <th key={label} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{label}</th>)}</tr></thead><tbody className="divide-y">{trashRows.map(row => <tr key={row.trashId} className="hover:bg-gray-50 align-top"><td className="px-4 py-3 text-xs font-mono">#{row.fineId}</td><td className="px-4 py-3"><p className="text-sm font-medium">{row.studentName || 'Deleted student'}</p><p className="text-xs font-mono text-gray-500">{row.registrationNo || '—'}</p></td><td className="px-4 py-3"><p className="text-sm">{row.bookTitle || 'No linked book'}</p><p className="text-xs font-mono text-gray-500">{row.accessionNo || '—'}</p></td><td className="px-4 py-3 text-sm font-bold">PKR {Number(row.fineAmount).toLocaleString()}</td><td className="px-4 py-3"><p className="text-xs font-medium capitalize">{row.fineType}</p><p className="text-xs text-gray-500 mt-1">{row.reason || '—'}</p></td><td className="px-4 py-3 text-xs capitalize">{row.originalStatus}<span className="block mt-1 font-medium">Resolution: {row.resolutionStatus || 'pending'}</span>{row.resolutionReason&&<span className="block mt-1 text-gray-500 normal-case">{row.resolutionReason}</span>}{row.sentToAccounts ? <span className="block text-emerald-700 mt-1">Accounts handoff recorded</span> : null}</td><td className="px-4 py-3 text-xs text-gray-700 max-w-[220px]">{row.deletionReason}</td><td className="px-4 py-3"><p className="text-xs font-medium">{row.deletedByName || 'Administrator'}</p><p className="text-xs text-gray-500">{row.deletedByEmail}</p></td><td className="px-4 py-3 text-xs text-gray-500">{displayDate(row.deletedAt, true)}</td><td className="px-4 py-3"><p className="text-xs text-gray-600">{displayDate(row.expiresAt)}</p><p className="text-xs font-medium text-amber-700 mt-1">{row.daysRemaining} day(s) left</p></td></tr>)}</tbody></table></div>
          {trashRows.length === 0 && <p className="px-5 py-10 text-center text-gray-500">Fine Trash is empty.</p>}
          <div className="flex items-center justify-between px-5 py-3 border-t"><p className="text-xs text-gray-500">{trashTotal} deleted fine(s)</p><div className="flex gap-1"><button aria-label="Previous trash page" onClick={() => setTrashPage(Math.max(1, trashPage - 1))} disabled={trashPage === 1} className="p-1.5 disabled:opacity-40"><ChevronLeft size={15} /></button><span className="px-2 py-1 text-xs">{trashPage} / {trashPages}</span><button aria-label="Next trash page" onClick={() => setTrashPage(Math.min(trashPages, trashPage + 1))} disabled={trashPage === trashPages} className="p-1.5 disabled:opacity-40"><ChevronRight size={15} /></button></div></div>
        </div>
      </>}

      {showGenModal && <GenFineModal onClose={() => setShowGenModal(false)} onSuccess={() => { setShowGenModal(false); setNotice('Fine generated successfully.'); void loadActive(); }} />}
      {moving && <MoveFineModal fine={moving} onClose={() => setMoving(null)} onMoved={() => void refreshAfterMove()} />}
      {resolving && <ResolveFineModal fine={resolving.fine} resolution={resolving.resolution} onClose={()=>setResolving(null)} onDone={()=>{setResolving(null);setNotice('Fine resolution updated. Clearance checks will use the new status.');void loadActive();}}/>}
    </div>
  );
}
