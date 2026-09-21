import { useState } from 'react';
import { requestJson, downloadCsv, downloadFile } from '@/lib/api';
import { Modal } from './Modal';
type Result = { preview: boolean; layoutRevision:number; counts: Record<string, number>; rows: { row: number; identifier: string; name: string; status: string; message: string }[] };
export function ImportDialog({ kind, onClose, onImported }: { kind: 'students' | 'books'; onClose: () => void; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null); const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [page, setPage] = useState(1);
  async function run(preview: boolean) {
    if (!file) return;
    setBusy(true); setError('');
    try {
      const body = new FormData(); body.append('file', file);
      const data = await requestJson(`/api/${kind}/import?preview=${preview}${!preview && result ? `&revision=${result.layoutRevision}` : ''}`, { method: 'POST', body });
      setResult(data); setPage(1); if (!preview) onImported();
    } catch (e) { setError((e as Error).message); if(!preview)setResult(null); } finally { setBusy(false); }
  }
  return <Modal title={`Import ${kind}`} onClose={onClose} busy={busy}>
    <div className="p-5 space-y-4">
      <p className="text-sm text-slate-600">Choose a CSV UTF-8 file, up to 5 MB and 10,000 records. Preview the rows before adding them. Existing records are never overwritten by an import.</p>
      <p className="text-sm text-slate-600">{kind === 'students' ? 'Matching name, registration number, and email means duplicate. Shared names with different registration numbers are allowed. A reused registration with different identity details is a conflict. Required columns follow your saved layout.' : 'Use one row per book title or edition and set Total Copies to its stock count. Matching ISBNs, or matching title/author/publisher/year when ISBN is blank, are skipped as duplicates. A reused accession with different details is a conflict.'}</p>
      <button type="button" onClick={() => downloadFile(`/api/${kind}/template.csv`, `${kind}-template.csv`).catch(error => setError(error.message))} className="text-left text-sm text-blue-700 underline">Download CSV template</button>
      <label className="block text-sm font-medium">CSV file<input type="file" accept=".csv,text/csv" disabled={busy} onChange={e => { setFile(e.target.files?.[0] || null); setResult(null); setError(''); }} className="block mt-2 w-full p-3 border rounded-lg" /></label>
      {error && <p role="alert" className="p-3 rounded bg-red-50 text-red-700 text-sm">{error}</p>}
      {result && <>
        <div role="status" className="flex flex-wrap gap-2 text-sm">{Object.entries(result.counts).filter(([key]) => !['added', 'ready'].includes(key) || key === (result.preview ? 'ready' : 'added')).map(([key, count]) => <span className="px-3 py-2 rounded bg-slate-100 capitalize" key={key}>{key}: <strong>{count}</strong></span>)}</div>
        {!result.preview && <p className="text-sm text-emerald-700">Import completed. Added {result.counts.added}; other rows were skipped. Download the results to review conflicts and corrections.</p>}
        <div className="overflow-auto max-h-72 border rounded-lg"><table className="w-full text-sm"><thead className="bg-slate-50 sticky top-0"><tr>{['CSV record', 'Identifier', 'Name / Title', 'Result', 'Details'].map(h => <th key={h} className="p-2 text-left">{h}</th>)}</tr></thead><tbody>{result.rows.slice((page - 1) * 25, page * 25).map(r => <tr className="border-t" key={r.row}><td className="p-2">{r.row}</td><td className="p-2 whitespace-nowrap">{r.identifier}</td><td className="p-2">{r.name}</td><td className={`p-2 capitalize ${['invalid', 'conflict'].includes(r.status) ? 'text-red-700' : 'text-emerald-700'}`}>{r.status}</td><td className="p-2 min-w-52">{r.message}</td></tr>)}</tbody></table></div>
        <div className="flex justify-between gap-2 text-sm"><button onClick={() => downloadCsv(`${kind}-import-results.csv`, ['CSV Record', 'Identifier', 'Name / Title', 'Result', 'Details'], result.rows.map(r => [r.row, r.identifier, r.name, r.status, r.message]))} className="text-blue-700 underline">Download results</button><div className="flex gap-3"><button disabled={page === 1} onClick={() => setPage(page - 1)} className="disabled:opacity-40">Previous</button><span>{page} / {Math.max(1, Math.ceil(result.rows.length / 25))}</span><button disabled={page * 25 >= result.rows.length} onClick={() => setPage(page + 1)} className="disabled:opacity-40">Next</button></div></div>
      </>}
    </div>
    <div className="p-5 border-t flex justify-end gap-3"><button disabled={busy} onClick={onClose} className="px-4 py-2 border rounded-lg">Close</button><button disabled={busy || !file || !!result && !result.preview} onClick={() => run(true)} className="px-4 py-2 border rounded-lg disabled:opacity-40">{busy ? 'Processing…' : 'Preview file'}</button>{result?.preview && <button disabled={busy || !result.counts.ready} onClick={() => run(false)} className="px-4 py-2 bg-blue-700 text-white rounded-lg disabled:opacity-40">Import {result.counts.ready} new records</button>}</div>
  </Modal>;
}
