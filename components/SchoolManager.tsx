import React, { useState, useRef } from 'react';
import { School } from '../types';
import { useAppStore } from '../store.tsx';
import { Plus, Edit, Trash2, Download, Search, X, Table, LayoutGrid, Save, Upload } from 'lucide-react';
import { exportToCSV, parseCSV } from '../utils';
import DataGrid, { GridColumn } from './DataGrid';
import ConfirmModal from './ConfirmModal';

const SchoolManager: React.FC = () => {
  const { schools = [], addSchool, updateSchool, deleteSchool, importData, currentUser } = useAppStore();
  const isViewer = !!(currentUser && currentUser.role === 'viewer');
  const [viewMode, setViewMode] = useState<'card' | 'grid'>('card');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [confirmConfig, setConfirmConfig] = useState<any>(null);

  const initialForm: School = { id: '', fullName: '' } as unknown as School;
  const [formData, setFormData] = useState<School>(initialForm);

  const handleOpenModal = (s?: School) => { if (s) { setFormData(s); setEditingId(s.id); } else { setFormData({ ...initialForm, id: crypto.randomUUID() } as School); setEditingId(null); } setIsModalOpen(true); };
  const saveSchool = () => { editingId ? updateSchool(formData) : addSchool(formData); };
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); saveSchool(); setIsModalOpen(false); };
  const handleDelete = (id: string) => setConfirmConfig({ isOpen: true, title: 'Delete School?', message: 'Are you sure?', isDanger: true, onConfirm: () => { deleteSchool(id); setConfirmConfig(null); } });

  const processImport = (file: File) => { const reader = new FileReader(); reader.onload = (evt) => { const data = parseCSV(evt.target?.result as string); importData('schools', data, 'replace'); alert(`Imported ${data.length} schools. Data replaced.`); if (fileInputRef.current) fileInputRef.current.value = ''; }; reader.readAsText(file); };
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { if (schools.length > 0) { setConfirmConfig({ isOpen: true, title: 'Replace Data?', message: 'Importing will REPLACE existing schools. Continue?', isDanger: true, onConfirm: () => { processImport(file); setConfirmConfig(null); } }); } else processImport(file); } };

  const filtered = schools.filter(s => (s.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) || (s.shortName || '').toLowerCase().includes(searchTerm.toLowerCase()));
  const gridColumns: GridColumn[] = [ { field: 'fullName', header: 'Full Name', type: 'text', width: '220px' }, { field: 'shortName', header: 'Short', type: 'text', width: '140px' }, { field: 'city', header: 'City', type: 'text', width: '140px' } ];

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">School Management</h2>
        <div className="flex gap-2">
          <div className="flex bg-slate-100 p-1 rounded-lg mr-2">
            <button onClick={() => setViewMode('card')} className={`p-2 rounded ${viewMode === 'card' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><LayoutGrid size={18}/></button>
            { !isViewer && <button onClick={() => setViewMode('grid')} className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><Table size={18}/></button> }
          </div>
          { !isViewer && (
            <>
              <input type="file" ref={fileInputRef} hidden accept=".csv" onChange={handleImport} />
              <button onClick={() => fileInputRef.current?.click()} className="btn-secondary border px-4 rounded hover:bg-slate-50 flex items-center gap-2"><Upload size={18}/> Import</button>
              <button onClick={() => exportToCSV(filtered, 'Schools_Export')} className="btn-secondary flex items-center gap-2 px-4 py-2 border rounded hover:bg-slate-50"><Download size={18} /> Export</button>
              <button onClick={() => handleOpenModal()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"><Plus size={18} /> Add School</button>
            </>
          )}
        </div>
      </div>

      <div className="mb-4 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} /><input className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search..." /></div>

      <div className="flex-1 overflow-auto rounded-lg border-slate-200">
        {viewMode === 'grid' ? (
          <DataGrid data={filtered} columns={gridColumns} onUpdate={(id, field, val) => updateSchool({ ...(filtered.find(x => x.id === id) || {} as any), [field]: val })} onAddRow={() => addSchool({ ...initialForm, id: crypto.randomUUID() })} onDeleteRows={(ids) => ids.forEach(id => deleteSchool(id))} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
            {filtered.map(s => (
              <div key={s.id} className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-lg text-slate-800">{s.fullName}</h3>
                    <div className="text-xs text-slate-500">{s.shortName || '-'} • {s.city || '-'}</div>
                  </div>
                  {!isViewer && (
                  <div className="flex gap-1">
                    <button onClick={() => handleOpenModal(s)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit size={16}/></button>
                    <button onClick={() => handleDelete(s.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                  </div>
                  )}
                </div>
                <div className="space-y-1 text-sm text-slate-600">
                  <div className="flex justify-between"><span>Teachers:</span> <span className="font-medium">{(s.teacherIds || []).length}</span></div>
                  <div className="flex justify-between"><span>Students:</span> <span className="font-medium">{(s.studentIds || []).length}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between sticky top-0 bg-white z-10"><h3 className="text-xl font-bold">{editingId ? 'Edit' : 'Add'} School</h3><button onClick={() => setIsModalOpen(false)}><X size={24} /></button></div>
            <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <input required className="p-2 border rounded" placeholder="Full Name" value={formData.fullName as any || ''} onChange={e => setFormData({...formData, fullName: e.target.value})} />
              <input className="p-2 border rounded" placeholder="Short Name" value={formData.shortName as any || ''} onChange={e => setFormData({...formData, shortName: e.target.value})} />

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

export default SchoolManager;
