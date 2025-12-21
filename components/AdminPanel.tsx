import React, { useMemo, useState } from 'react';
import { useAppStore } from '../store';
import { Role } from '../types';
import { Search, Download } from 'lucide-react';

const roleBadge = (r: Role) => {
  const baseClass = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset";
  switch (r) {
    case 'owner': return <span className={`${baseClass} bg-indigo-50 text-indigo-700 ring-indigo-600/20`}>Owner</span>;
    case 'editor': return <span className={`${baseClass} bg-blue-50 text-blue-700 ring-blue-600/20`}>Editor</span>;
    case 'viewer': return <span className={`${baseClass} bg-green-50 text-green-700 ring-green-600/20`}>Viewer</span>;
    default: return <span className={`${baseClass} bg-slate-50 text-slate-600 ring-slate-500/10`}>Guest</span>;
  }
};

const AdminPanel: React.FC = () => {
  const { users, currentUser, updateUserRole, inviteUser, updateUser } = useAppStore();
  const [q, setQ] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('visitor');
  const [invitePhone, setInvitePhone] = useState('');

  const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null);
  const [editingPhoneValue, setEditingPhoneValue] = useState('');

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
    return (
      <div className="flex items-center justify-center h-64 bg-slate-50 rounded-xl border border-dashed border-slate-300">
        <div className="text-slate-500">Only the owner can access this page.</div>
      </div>
    );
  }

  const handleChange = async (id: string, role: Role) => {
    if (id === currentUser.id && role !== 'owner') {
      alert('不能更改自己的负责人角色。如需降级，请先委任其他负责人。');
      return;
    }
    await updateUserRole(id, role);
  };

  const handleInvite = async () => {
    try {
      if (!inviteName.trim() || !inviteEmail.trim()) return alert('Please input name and email');
      if (users.some(u => u.name === inviteName)) return alert('Name already exists！');
      if (users.some(u => u.email === inviteEmail)) return alert('Email already exists!');
      if (invitePhone.trim() && users.some(u => u.phone === invitePhone.trim())) return alert('Phone already exists!');
      await inviteUser(inviteEmail, inviteName, inviteRole, invitePhone ? invitePhone.trim() : undefined);
      alert('User successfully added.');
      setInviteName(''); setInviteEmail(''); setInviteRole('visitor'); setInvitePhone('');
    } catch (e: any) {
      alert('Invitation failed.' + (e.message || JSON.stringify(e)));
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">User Management</h2>
          <p className="text-sm text-slate-500 mt-1">Manage team members and permissions</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
            <input 
              value={q} 
              onChange={e => setQ(e.target.value)} 
              placeholder="Search users..." 
              className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm" 
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all text-sm font-medium shadow-sm">
            <Download size={16}/> 
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Action Area: Invite & Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Invite Card */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-800">Invite New User</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-3">
              <input className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-shadow" placeholder="Name" value={inviteName} onChange={e => setInviteName(e.target.value)} />
            </div>
            <div className="sm:col-span-3">
              <input className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-shadow" placeholder="Email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
            </div>
            <div className="sm:col-span-3">
              <input className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-shadow" placeholder="Phone (optional)" value={invitePhone} onChange={e => setInvitePhone(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <select className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white" value={inviteRole} onChange={e => setInviteRole(e.target.value as Role)}>
                <option value="visitor">Guest</option>
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            <div className="sm:col-span-1">
              <button onClick={handleInvite} className="w-full h-full flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm text-sm font-medium px-2 py-2">
                Add
              </button>
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-400">
            Note: Only creates user record and assigns role; does not automatically send email invitation.
          </div>
        </div>

        {/* Sync Settings Card */}
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200/60 flex flex-col justify-center">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-800">自动平台同步</div>
              <div className="text-xs text-slate-500 mt-1 leading-relaxed">
                启用后，创建/修改课程与课节会自动同步到已配置的线上教学平台。
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 ml-4">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={autoSync} onChange={e => toggleAutoSync(e.target.checked)} />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
              <a className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline" href="#" onClick={(e) => { e.preventDefault(); alert('请在后端（例如 Supabase Edge Function）中配置平台密钥，并另行部署接口 /api/platform-sync'); }}>
                配置密钥
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{u.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-500 truncate max-w-xs" title={u.email}>{u.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    {editingPhoneId === u.id ? (
                      <div className="flex items-center gap-2">
                        <input 
                          autoFocus
                          className="w-32 px-2 py-1 text-sm border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500/20" 
                          value={editingPhoneValue} 
                          onChange={e => setEditingPhoneValue(e.target.value)} 
                        />
                        <button className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors" onClick={async () => {
                          const val = editingPhoneValue.trim();
                          if (val && users.some(x => x.phone === val && x.id !== u.id)) return alert('Phone already used by another user');
                          try {
                            // FIX: Changed null to undefined here
                            await updateUser({ id: u.id, phone: val || undefined });
                            setEditingPhoneId(null); setEditingPhoneValue('');
                            alert('Phone updated');
                          } catch (err: any) {
                            alert('Update failed: ' + (err.message || JSON.stringify(err)));
                          }
                        }}>Save</button>
                        <button className="px-2 py-1 border border-slate-300 bg-white text-slate-600 rounded text-xs hover:bg-slate-50" onClick={() => { setEditingPhoneId(null); setEditingPhoneValue(''); }}>Cancel</button>
                      </div>
                    ) : (
                      <div className="group flex items-center gap-2">
                        <span className={`truncate max-w-xs block ${u.phone ? 'text-slate-700' : 'text-slate-400 italic'}`}>{u.phone || '—'}</span>
                        <button className="opacity-0 group-hover:opacity-100 text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-opacity" onClick={() => { setEditingPhoneId(u.id); setEditingPhoneValue(u.phone || ''); }}>Edit</button>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {roleBadge(u.role as Role)}
                      <select 
                        value={u.role} 
                        onChange={(e) => handleChange(u.id, e.target.value as Role)} 
                        className={`
                          text-xs border-none bg-transparent text-slate-500 focus:ring-0 cursor-pointer hover:text-indigo-600 transition-colors p-0
                          ${u.id === currentUser.id ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                        disabled={u.id === currentUser.id}
                      >
                        <option value="owner">Change to Owner</option>
                        <option value="editor">Change to Editor</option>
                        <option value="viewer">Change to Viewer</option>
                        <option value="visitor">Change to Guest</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {u.id === currentUser.id ? (
                        <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded">You</span>
                      ) : (
                        <button onClick={() => handleChange(u.id, 'viewer')} className="text-xs text-slate-500 hover:text-indigo-600 font-medium transition-colors">
                          Reset to Viewer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    No users found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-center text-xs text-slate-400 pb-4">
        Note: Owner has full permissions, please assign roles carefully.
      </div>
    </div>
  );
};

export default AdminPanel;