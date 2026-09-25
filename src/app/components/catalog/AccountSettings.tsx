import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Trash2, UserRound } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { requestJson, jsonBody } from '@/lib/api';

type Admin = { id: number; name: string; email: string; created_at: string };
type Audit = {id:number;adminName:string;adminEmail:string;action:string;method:string;path:string;summary:string;ipAddress:string;statusCode:number;createdAt:string};
const inputClass = 'w-full mt-1.5 px-3 py-2.5 border rounded-lg text-sm';

export function AccountSettings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [newAdmin, setNewAdmin] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [audit,setAudit]=useState<Audit[]>([]);

  const loadAdmins = () => requestJson('/api/auth/admins').then(setAdmins).catch(error => setError(error.message));
  const loadAudit=()=>requestJson('/api/auth/audit?limit=50').then(data=>setAudit(data.rows)).catch(error=>setError(error.message));
  useEffect(() => { loadAdmins();loadAudit(); }, []);

  async function saveAccount(event: FormEvent) {
    event.preventDefault(); setError(''); setNotice('');
    if (password !== confirm) { setError('New passwords do not match.'); return; }
    setBusy(true);
    try {
      await requestJson('/api/auth/account', { method: 'PUT', ...jsonBody({ name, email, currentPassword, password }) });
      logout(); navigate('/login', { replace: true });
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }

  async function createAdmin(event: FormEvent) {
    event.preventDefault(); setError(''); setNotice('');
    if (newAdmin.password !== newAdmin.confirm) { setError('The new administrator passwords do not match.'); return; }
    setBusy(true);
    try {
      await requestJson('/api/auth/admins', { method: 'POST', ...jsonBody(newAdmin) });
      setNewAdmin({ name: '', email: '', password: '', confirm: '' });
      setNotice('Administrator login created successfully.');
      await loadAdmins();
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }

  async function removeAdmin(admin: Admin) {
    if (!window.confirm(`Remove the login for ${admin.name} (${admin.email})?`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await requestJson(`/api/auth/admins/${admin.id}`, { method: 'DELETE' });
      setNotice('Administrator login removed.');
      await loadAdmins();
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }

  return <div className="space-y-4">
    {error && <p role="alert" className="text-sm text-red-700 bg-red-50 p-3 rounded-lg">{error}</p>}
    {notice && <p role="status" className="text-sm text-emerald-800 bg-emerald-50 p-3 rounded-lg">{notice}</p>}

    <form onSubmit={saveAccount} className="bg-white rounded-xl border p-6 space-y-5">
      <div><h2 className="font-semibold">Your administrator login</h2><p className="text-sm text-slate-500 mt-1">Login protection limits repeated attempts and temporarily locks an account after five failures. Updating this account signs out existing sessions.</p></div>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="text-sm">Display name<input required maxLength={100} autoComplete="name" value={name} onChange={event => setName(event.target.value)} className={inputClass} /></label>
        <label className="text-sm">Login email<input required type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} className={inputClass} /></label>
        <label className="text-sm">Current password<input required type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} className={inputClass} /></label>
        <span className="hidden sm:block" />
        <label className="text-sm">New password (optional)<input type="password" autoComplete="new-password" minLength={12} value={password} onChange={event => setPassword(event.target.value)} className={inputClass} /></label>
        <label className="text-sm">Confirm new password<input required={!!password} type="password" autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} className={inputClass} /></label>
      </div>
      <p className="text-xs text-slate-500">New passwords need at least 12 characters. Leave both new-password fields empty to keep the current password.</p>
      <button disabled={busy} className="bg-blue-800 text-white px-4 py-2.5 rounded-lg text-sm disabled:opacity-40">{busy ? 'Saving…' : 'Save login and sign out'}</button>
    </form>

    <section className="bg-white rounded-xl border p-6 space-y-4">
      <div><h2 className="font-semibold">Administrator accounts</h2><p className="text-sm text-slate-500 mt-1">Each account has full administrator access. Give every librarian their own login.</p></div>
      <div className="divide-y border rounded-lg">{admins.map(admin => <div key={admin.id} className="p-3 flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-blue-50 text-blue-800 flex items-center justify-center"><UserRound size={17} /></div><div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{admin.name}{admin.id === user?.id ? ' (you)' : ''}</p><p className="text-xs text-slate-500 truncate">{admin.email}</p></div>{admin.id !== user?.id && <button disabled={busy} aria-label={`Remove ${admin.name}`} onClick={() => removeAdmin(admin)} className="p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-40"><Trash2 size={16} /></button>}</div>)}</div>
    </section>

    <form onSubmit={createAdmin} className="bg-white rounded-xl border p-6 space-y-5">
      <div className="flex items-center gap-2"><Plus size={18} className="text-blue-800" /><div><h2 className="font-semibold">Create another login</h2><p className="text-sm text-slate-500 mt-1">The password is stored only as a secure hash.</p></div></div>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="text-sm">Administrator name<input required maxLength={100} value={newAdmin.name} onChange={event => setNewAdmin(current => ({ ...current, name: event.target.value }))} className={inputClass} /></label>
        <label className="text-sm">Login email<input required type="email" value={newAdmin.email} onChange={event => setNewAdmin(current => ({ ...current, email: event.target.value }))} className={inputClass} /></label>
        <label className="text-sm">Password<input required type="password" minLength={12} autoComplete="new-password" value={newAdmin.password} onChange={event => setNewAdmin(current => ({ ...current, password: event.target.value }))} className={inputClass} /></label>
        <label className="text-sm">Confirm password<input required type="password" autoComplete="new-password" value={newAdmin.confirm} onChange={event => setNewAdmin(current => ({ ...current, confirm: event.target.value }))} className={inputClass} /></label>
      </div>
      <button disabled={busy} className="bg-blue-800 text-white px-4 py-2.5 rounded-lg text-sm disabled:opacity-40">{busy ? 'Creating…' : 'Create administrator login'}</button>
    </form>
    <section className="bg-white rounded-xl border p-6 space-y-4">
      <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Security and change audit</h2><p className="text-sm text-slate-500 mt-1">Latest 50 login events and administrator changes.</p></div><button onClick={loadAudit} className="px-3 py-2 border rounded-lg text-sm">Refresh</button></div>
      <div className="overflow-auto border rounded-lg"><table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="p-3 text-left">Date</th><th className="p-3 text-left">Administrator</th><th className="p-3 text-left">Action</th><th className="p-3 text-left">Path</th><th className="p-3 text-left">Result</th></tr></thead><tbody>{audit.map(entry=><tr key={entry.id} className="border-t"><td className="p-3 whitespace-nowrap">{entry.createdAt}</td><td className="p-3"><p>{entry.adminName||'Unknown account'}</p><p className="text-xs text-slate-500">{entry.adminEmail||entry.ipAddress}</p></td><td className="p-3">{entry.action.replaceAll('_',' ')}</td><td className="p-3 text-xs max-w-72 truncate" title={entry.path}>{entry.path}</td><td className="p-3"><span className={`px-2 py-1 rounded-full text-xs ${entry.statusCode<400?'bg-emerald-50 text-emerald-800':'bg-red-50 text-red-700'}`}>{entry.statusCode}</span></td></tr>)}{!audit.length&&<tr><td colSpan={5} className="p-6 text-center text-slate-500">No audit entries yet.</td></tr>}</tbody></table></div>
    </section>
  </div>;
}
