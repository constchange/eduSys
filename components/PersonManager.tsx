import React, { useState, useRef } from 'react';
import { Person } from '../types';
import { useAppStore } from '../store.tsx';
import { Plus, Edit, Trash2, Download, Search, X, Table, LayoutGrid, Save, Upload } from 'lucide-react';
import { exportToCSV, parseCSV } from '../utils';
import DataGrid, { GridColumn } from './DataGrid';
import ConfirmModal from './ConfirmModal';

interface Props {
  type: 'Teacher' | 'TA';
}

const PersonManager: React.FC<Props> = ({ type }) => {
  const { teachers, assistants, addPerson, updatePerson, deletePerson, importData } = useAppStore();
  const list = type === 'Teacher' ? teachers : assistants;
  const [viewMode, setViewMode] = useState<'card' | 'grid'>('card'); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal State
  const [confirmConfig, setConfirmConfig] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      onConfirm: () => void;
      isDanger?: boolean;
  } | null>(null);

  const initialForm: Person = {
    id: '', name: '', gender: 'Male', dob: '', 
    juniorHigh: '', seniorHigh: '', university: '', researchLab: '',
    workHistory: '', currentUnit: '',
    difficultyRange: '', preferences: '', 
    phone: '', wechat: '', address: '', bankAccount: '', 
    type: type
  };

  const [formData, setFormData] = useState<Person>(initialForm);

  const handleOpenModal = (person?: Person) => {
    if (person) {
      setFormData(person);
      setEditingId(person.id);
    } else {
      setFormData({ ...initialForm, id: crypto.randomUUID(), type });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const savePerson = () => {
     editingId ? updatePerson(formData) : addPerson(formData);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    savePerson();
    setIsModalOpen(false);
  };

  const handleSaveAndContinue = (e: React.MouseEvent) => {
    e.preventDefault();
    savePerson();
    setFormData({ ...initialForm, id: crypto.randomUUID(), type });
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    setConfirmConfig({
        isOpen: true,
        title: "Delete Profile?",
        message: "Are you sure you want to delete this profile? This action cannot be undone.",
        isDanger: true,
        onConfirm: () => {
            deletePerson(id);
            setConfirmConfig(null);
        }
    });
  };

  const handleGridUpdate = (id: string, field: string, value: any) => {
    const person = list.find(p => p.id === id);
    if (person) updatePerson({ ...person, [field]: value });
  };

  const handleAddRow = () => {
    addPerson({ ...initialForm, id: crypto.randomUUID(), type });
  };

  const handleDeleteRows = (ids: string[]) => {
    ids.forEach(id => deletePerson(id));
  };

  const processImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
        const data = parseCSV(evt.target?.result as string);
        const typedData = data.map(d => ({ ...d, type }));
        importData(type === 'Teacher' ? 'teachers' : 'assistants', typedData, 'replace');
        alert(`Imported ${data.length} records. Data replaced.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        if (list.length > 0) {
            setConfirmConfig({
                isOpen: true,
                title: "Replace Data?",
                message: `Warning: Importing data will REPLACE all existing ${type} data. This cannot be undone. Continue?`,
                isDanger: true,
                onConfirm: () => {
                    processImport(file);
                    setConfirmConfig(null);
                }
            });
        } else {
            processImport(file);
        }
    }
  };

  const gridColumns: GridColumn[] = [
    { field: 'name', header: 'Name', type: 'text', width: '120px' },
    { field: 'gender', header: 'Gender', type: 'select', options: [{label: 'Male', value:'Male'}, {label: 'Female', value:'Female'}], width: '80px' },
    { field: 'dob', header: 'DOB', type: 'date', width: '110px' },
    { field: 'phone', header: 'Phone', type: 'text', width: '120px' },
    { field: 'wechat', header: 'WeChat', type: 'text', width: '120px' },
    { field: 'university', header: 'University (Dept/Plan)', type: 'text', width: '200px' },
    { field: 'currentUnit', header: 'Current Unit', type: 'text', width: '150px' },
    { field: 'workHistory', header: 'Work History', type: 'text', width: '200px' },
    { field: 'difficultyRange', header: 'Diff. Range', type: 'text', width: '120px' },
    { field: 'preferences', header: 'Preference', type: 'text', width: '150px' },
    { field: 'juniorHigh', header: 'Jr. High', type: 'text', width: '150px' },
    { field: 'seniorHigh', header: 'Sr. High', type: 'text', width: '150px' },
    { field: 'researchLab', header: 'Research Inst.', type: 'text', width: '150px' },
    { field: 'address', header: 'Address', type: 'text', width: '200px' },
    { field: 'bankAccount', header: 'Bank Account', type: 'text', width: '180px' },
  ];

  const filteredList = list.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <>
    <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">{type === 'Teacher' ? 'Teacher Management' : 'TA Management'}</h2>
        <div className="flex gap-2">
           <div className="flex bg-slate-100 p-1 rounded-lg mr-2">
             <button onClick={() => setViewMode('card')} className={`p-2 rounded ${viewMode === 'card' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><LayoutGrid size={18}/></button>
             <button onClick={() => setViewMode('grid')} className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><Table size={18}/></button>
           </div>
          
          <input type="file" ref={fileInputRef} hidden accept=".csv" onChange={handleImport} />
          <button onClick={() => fileInputRef.current?.click()} className="btn-secondary border px-4 rounded hover:bg-slate-50 flex items-center gap-2"><Upload size={18}/> Import</button>
          <button onClick={() => exportToCSV(list, `${type}_Export`)} className="btn-secondary flex items-center gap-2 px-4 py-2 border rounded hover:bg-slate-50"><Download size={18} /> Export</button>
          
          <button onClick={() => handleOpenModal()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"><Plus size={18} /> Add {type}</button>
        </div>
      </div>
      <div className="mb-4 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} /><input className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search..." /></div>
      <div className="flex-1 overflow-auto rounded-lg border-slate-200">
        {viewMode === 'grid' ? (
          <DataGrid data={filteredList} columns={gridColumns} onUpdate={handleGridUpdate} onAddRow={handleAddRow} onDeleteRows={handleDeleteRows} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
            {filteredList.map(p => (
              <div key={p.id} className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-lg text-slate-800">{p.name}</h3>
                    <div className="text-xs text-slate-500">{p.gender} • {p.currentUnit}</div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleOpenModal(p)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit size={16}/></button>
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                  </div>
                </div>
                <div className="space-y-1 text-sm text-slate-600">
                  <div className="flex justify-between"><span>Phone:</span> <span className="font-medium">{p.phone}</span></div>
                  <div className="flex justify-between"><span>Diff:</span> <span className="font-medium">{p.difficultyRange || '-'}</span></div>
                  {p.wechat && <div className="flex justify-between"><span>WeChat:</span> <span className="font-medium">{p.wechat}</span></div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between sticky top-0 bg-white z-10"><h3 className="text-xl font-bold">{editingId ? 'Edit' : 'Add'} Profile</h3><button onClick={() => setIsModalOpen(false)}><X size={24} /></button></div>
            <form onSubmit={handleSubmit} className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2 text-sm font-bold text-slate-500 uppercase tracking-wider mt-2 border-b pb-1">Basic Information</div>
              <input required className="p-2 border rounded" placeholder="Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              <select className="p-2 border rounded" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value as any})}><option value="Male">Male</option><option value="Female">Female</option></select>
              <div className="flex flex-col"><label className="text-xs text-slate-500">Date of Birth</label><input type="date" className="p-2 border rounded" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} /></div>
              <input className="p-2 border rounded mt-auto" placeholder="Current Work/Study Unit" value={formData.currentUnit} onChange={e => setFormData({...formData, currentUnit: e.target.value})} />
              
              <div className="col-span-2 text-sm font-bold text-slate-500 uppercase tracking-wider mt-4 border-b pb-1">Education</div>
              <input className="p-2 border rounded" placeholder="Junior High School" value={formData.juniorHigh} onChange={e => setFormData({...formData, juniorHigh: e.target.value})} />
              <input className="p-2 border rounded" placeholder="Senior High School" value={formData.seniorHigh} onChange={e => setFormData({...formData, seniorHigh: e.target.value})} />
              <input className="col-span-2 p-2 border rounded" placeholder="University (Dept / Plan)" value={formData.university} onChange={e => setFormData({...formData, university: e.target.value})} />
              <input className="col-span-2 p-2 border rounded" placeholder="Research Institute" value={formData.researchLab} onChange={e => setFormData({...formData, researchLab: e.target.value})} />
              
              <div className="col-span-2 text-sm font-bold text-slate-500 uppercase tracking-wider mt-4 border-b pb-1">Professional</div>
              <input className="p-2 border rounded" placeholder="Difficulty Range (e.g. L1-L5)" value={formData.difficultyRange} onChange={e => setFormData({...formData, difficultyRange: e.target.value})} />
              <input className="p-2 border rounded" placeholder="Preferences" value={formData.preferences} onChange={e => setFormData({...formData, preferences: e.target.value})} />
              <textarea className="col-span-2 p-2 border rounded h-20" placeholder="Work/Teaching Experience..." value={formData.workHistory} onChange={e => setFormData({...formData, workHistory: e.target.value})} />

              <div className="col-span-2 text-sm font-bold text-slate-500 uppercase tracking-wider mt-4 border-b pb-1">Contact & Finance</div>
              <input className="p-2 border rounded" placeholder="Phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              <input className="p-2 border rounded" placeholder="WeChat" value={formData.wechat} onChange={e => setFormData({...formData, wechat: e.target.value})} />
              <input className="col-span-2 p-2 border rounded" placeholder="Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
              <input className="col-span-2 p-2 border rounded" placeholder="Bank Account" value={formData.bankAccount} onChange={e => setFormData({...formData, bankAccount: e.target.value})} />

              <div className="col-span-2 pt-4 border-t flex justify-end gap-3 mt-4">
                 <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded">Cancel</button>
                 <button type="button" onClick={handleSaveAndContinue} className="px-4 py-2 bg-blue-100 text-blue-700 rounded flex items-center gap-2"><Save size={16}/> Save & Add Another</button>
                 <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded">Save</button>
              </div>
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
    </>
  );
};

export default PersonManager;