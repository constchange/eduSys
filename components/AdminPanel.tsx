import React, { useMemo, useState } from 'react';
import { useAppStore } from '../store';
import { Role } from '../types';
import { Search, Download } from 'lucide-react';

const roleBadge = (r: Role) => {
  switch (r) {
    case 'owner': return <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">Owner</span>;
    case 'editor': return <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Editor</span>;
    case 'viewer': return <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Viewer</span>;
    default: return <span className="text-xs bg-slate-50 text-slate-600 px-2 py-0.5 rounded-full">Guest</span>;
  }
};

const AdminPanel: React.FC = () => {
  const { users, currentUser, updateUserRole, inviteUser } = useAppStore();
  const [q, setQ] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('visitor');

  const [autoSync, setAutoSync] = useState(() => {
    try { return localStorage.getItem('autoPlatformSync') === '1'; } catch { return false; }
  });

  const toggleAutoSync = (v: boolean) => {
    try { localStorage.setItem('autoPlatformSync', v ? '1' : '0'); } catch {}
    setAutoSync(v);
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return users;
    return users.filter(u => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
  }, [users, q]);

  if (!currentUser || currentUser.role !== 'owner') {
    return <div className="p-4 bg-white rounded shadow">Only the owner can access this page.</div>;
  }

  const handleChange = async (id: string, role: Role) => {
    // Prevent downgrading the active owner accidentally
    if (id === currentUser.id && role !== 'owner') {
      alert('不能更改自己的负责人角色。如需降级，请先委任其他负责人。');
      return;
    }
    await updateUserRole(id, role);
  };

  const handleInvite = async () => {
    try {
      if (!inviteName.trim() || !inviteEmail.trim() || !invitePhone.trim()) return alert('Please input name, email and phone');
      // Basic uniqueness check
      if (users.some(u => u.name === inviteName)) return alert('Name already exists！');
      if (users.some(u => u.email === inviteEmail)) return alert('Email already exists!');
      if (users.some(u => u.phone === invitePhone)) return alert('Phone already exists!');
      await inviteUser(inviteEmail, inviteName, inviteRole, invitePhone);
      alert('User successfully added.');
      setInviteName(''); setInviteEmail(''); setInvitePhone(''); setInviteRole('visitor');
    } catch (e: any) {
      alert('Invitation failed.' + (e.message || JSON.stringify(e)));
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 h-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">User Management</h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or email…" className="pl-10 pr-3 py-2 border border-slate-200 rounded-lg w-80" />
          </div>
          <button className="btn-secondary flex items-center gap-2 px-3 py-2 border rounded hover:bg-slate-50"><Download size={16}/> 导出</button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-2">
          <div className="text-sm text-slate-500 mb-1">Add User / Invite</div>
          <div className="flex gap-2">
            <input className="p-2 border rounded w-1/4" placeholder="Name" value={inviteName} onChange={e => setInviteName(e.target.value)} />
            <input className="p-2 border rounded w-1/4" placeholder="Email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
            <input className="p-2 border rounded w-1/4" placeholder="Phone" value={invitePhone} onChange={e => setInvitePhone(e.target.value)} />
            <select className="p-2 border rounded w-40" value={inviteRole} onChange={e => setInviteRole(e.target.value as Role)}>
              <option value="visitor">Guest</option>
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="owner">Owner</option>
            </select>
            <button onClick={handleInvite} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Add User</button>
          </div>

          <div className="mt-4 p-3 border rounded bg-slate-50">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">自动平台同步</div>
                <div className="text-xs text-slate-500">启用后，创建/修改课程与课节会自动同步到已配置的线上教学平台（需在服务端配置平台密钥）。</div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={autoSync} onChange={e => toggleAutoSync(e.target.checked)} />
                  <span className="text-sm">启用</span>
                </label>
                <a className="text-xs text-indigo-600" href="#" onClick={(e) => { e.preventDefault(); alert('请在后端（例如 Supabase Edge Function）中配置平台密钥，并另行部署接口 /api/platform-sync'); }}>配置</a>
              </div>
            </div>
          </div>

        </div>
        <div className="text-sm text-slate-400">Note: Only creates user record and assigns role; does not automatically send email invitation.</div>
      </div>

      <div className="overflow-auto rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-3">Name</th>
              <th className="py-3">Email</th>              <th className="py-3">Phone</th>              <th className="py-3">Role</th>
              <th className="py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} className="align-top hover:bg-slate-50 transition-colors">
                <td className="py-3 pr-4">
                  <div className="font-medium text-slate-800">{u.name}</div>
                </td>
                <td className="py-3 pr-4">
                  <div className="text-xs text-slate-500 truncate max-w-xs" title={u.email}>{u.email}</div>
                </td>
                <td className="py-3 pr-4">
                  <div className="text-xs text-slate-500 truncate max-w-xs" title={u.phone || ''}>{u.phone || '-'}</div>
                </td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    {roleBadge(u.role as Role)}
                    {/* Inline role selector */}
                    <select value={u.role} onChange={(e) => handleChange(u.id, e.target.value as Role)} className={`ml-2 p-1 border rounded ${u.id === currentUser.id ? 'opacity-60 cursor-not-allowed' : ''}`} disabled={u.id === currentUser.id}>
                      <option value="owner">Owner</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                      <option value="visitor">Guest</option>
                    </select>
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    {u.id === currentUser.id ? <div className="text-xs text-slate-400">Current Owner</div> : <button onClick={() => handleChange(u.id, 'viewer')} className="px-3 py-1 border rounded text-xs hover:bg-slate-50">Set as Viewer</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 text-xs text-slate-400">Note: Owner has full permissions, please assign roles carefully.</div>
    </div>
  );
};

export default AdminPanel;
