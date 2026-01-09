import React, { useState, useRef } from 'react';
import { Client } from '../types';
import { useAppStore } from '../store.tsx';
import { Plus, Edit, Trash2, Download, Search, X, Table, LayoutGrid, Save, Upload } from 'lucide-react';
import { exportToCSV, parseCSV } from '../utils';
import DataGrid, { GridColumn } from './DataGrid';
import ConfirmModal from './ConfirmModal';

const ClientManager: React.FC = () => {
  const { clients = [], schools = [], students = [], addClient, updateClient, deleteClient, importData, currentUser } = useAppStore();
  const isViewer = !!(currentUser && currentUser.role === 'viewer');
  const [viewMode, setViewMode] = useState<'card' | 'grid'>('card');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [confirmConfig, setConfirmConfig] = useState<any>(null);

  const initialForm: Client = { id: '', name: '' } as unknown as Client;
  const [formData, setFormData] = useState<Client>(initialForm);

  const handleOpenModal = (c?: Client) => { if (c) { setFormData(c); setEditingId(c.id); } else { setFormData({ ...initialForm, id: crypto.randomUUID() } as Client); setEditingId(null); } setIsModalOpen(true); };
  const saveClient = () => { editingId ? updateClient(formData) : addClient(formData); };
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); saveClient(); setIsModalOpen(false); };
  const handleDelete = (id: string) => setConfirmConfig({ isOpen: true, title: 'Delete Client?', message: 'Are you sure?', isDanger: true, onConfirm: () => { deleteClient(id); setConfirmConfig(null); } });

  const processImport = (file: File) => { const reader = new FileReader(); reader.onload = (evt) => { const data = parseCSV(evt.target?.result as string); importData('clients', data, 'replace'); alert(`Imported ${data.length} clients. Data replaced.`); if (fileInputRef.current) fileInputRef.current.value = ''; }; reader.readAsText(file); };
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { if (clients.length > 0) { setConfirmConfig({ isOpen: true, title: 'Replace Data?', message: 'Importing will REPLACE existing clients. Continue?', isDanger: true, onConfirm: () => { processImport(file); setConfirmConfig(null); } }); } else processImport(file); } };

  const filtered = clients.filter(s => s.name?.toLowerCase().includes(searchTerm.toLowerCase()));
  const gridColumns: GridColumn[] = [ { field: 'name', header: 'Name', type: 'text', width: '200px' }, { field: 'phone', header: 'Phone', type: 'text', width: '140px' }, { field: 'unit', header: 'Unit', type: 'text', width: '200px' } ];

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Client Management</h2>
        <div className="flex gap-2">
          <div className="flex bg-slate-100 p-1 rounded-lg mr-2">
            <button onClick={() => setViewMode('card')} className={`p-2 rounded ${viewMode === 'card' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><LayoutGrid size={18}/></button>
            { !isViewer && <button onClick={() => setViewMode('grid')} className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><Table size={18}/></button> }
          </div>
          { !isViewer && (
            <>
              <input type="file" ref={fileInputRef} hidden accept=".csv" onChange={handleImport} />
              <button onClick={() => fileInputRef.current?.click()} className="btn-secondary border px-4 rounded hover:bg-slate-50 flex items-center gap-2"><Upload size={18}/> Import</button>
              <button onClick={() => exportToCSV(filtered, 'Clients_Export')} className="btn-secondary flex items-center gap-2 px-4 py-2 border rounded hover:bg-slate-50"><Download size={18} /> Export</button>
              <button onClick={() => handleOpenModal()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"><Plus size={18} /> Add Client</button>
            </>
          )}
        </div>
      </div>

      <div className="mb-4 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} /><input className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search..." /></div>

      <div className="flex-1 overflow-auto rounded-lg border-slate-200">
        {viewMode === 'grid' ? (
          <DataGrid data={filtered} columns={gridColumns} onUpdate={(id, field, val) => updateClient({ ...(filtered.find(x => x.id === id) || {} as any), [field]: val })} onAddRow={() => addClient({ ...initialForm, id: crypto.randomUUID() })} onDeleteRows={(ids) => ids.forEach(id => deleteClient(id))} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
            {filtered.map(s => (
              <div key={s.id} className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-lg text-slate-800">{s.name}</h3>
                    <div className="text-xs text-slate-500">{s.unit || '-'} • {s.phone || '-'}</div>
                  </div>
                  {!isViewer && (
                  <div className="flex gap-1">
                    <button onClick={() => handleOpenModal(s)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit size={16}/></button>
                    <button onClick={() => handleDelete(s.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                  </div>
                  )}
                </div>
                <div className="space-y-1 text-sm text-slate-600">
                  <div className="flex justify-between"><span>Students:</span> <span className="font-medium">{(s.studentIds || []).length}</span></div>
                  <div className="flex justify-between"><span>Projects:</span> <span className="font-medium">{s.projects || '-'}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between sticky top-0 bg-white z-10"><h3 className="text-xl font-bold">{editingId ? 'Edit' : 'Add'} Client</h3><button onClick={() => setIsModalOpen(false)}><X size={24} /></button></div>
            <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <input required className="p-2 border rounded" placeholder="Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              <input className="p-2 border rounded" placeholder="Phone" value={formData.phone as any || ''} onChange={e => setFormData({...formData, phone: e.target.value})} />

              <div className="col-span-2 border p-4 rounded-lg"><label className="block font-semibold mb-2">Linked Students</label><div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">{students.map(st => (<button type="button" key={st.id} onClick={() => setFormData(prev => ({ ...prev, studentIds: Array.isArray(prev.studentIds) ? (prev.studentIds.includes(st.id) ? prev.studentIds.filter(x => x !== st.id) : [...prev.studentIds, st.id]) : [st.id] }))} className={`px-3 py-1 rounded-full text-sm border ${Array.isArray(formData.studentIds) && formData.studentIds.includes(st.id) ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-slate-50 border-slate-200'}`}>{st.name}</button>))}</div></div>

              <div className="col-span-2 pt-4 border-t flex justify-end gap-3 mt-4"><button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded">Cancel</button><button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded">Save</button></div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={!!confirmConfig}
        title={confirmConfig?.title || ''}
        message={confirmConfig?.message || ''}
        isDanger={confirmConfig?.isDanger}
        onConfirm={confirmConfig?.onConfirm || (() => {})}
        onCancel={() => setConfirmConfig(null)}
      />
    </div>
  );
};

export default ClientManager;
