import React, { useState, useRef } from 'react';
import { Course } from '../types';
import { useAppStore } from '../store.tsx';
import { Plus, Edit, Trash2, Download, Search, X, Table, LayoutGrid, Save, Upload } from 'lucide-react';
import { exportToCSV, parseCSV } from '../utils';
import DataGrid, { GridColumn } from './DataGrid';
import ConfirmModal from './ConfirmModal';

const CourseManager: React.FC = () => {
  const { courses, teachers, assistants, addCourse, updateCourse, deleteCourse, importData } = useAppStore();
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

  const initialForm: Course = {
    id: '', name: '', type: '', difficulty: '', module: '', semester: '', 
    location: '', startDate: '', endDate: '', defaultStartTime: '', defaultEndTime: '', 
    teacherIds: [], assistantIds: [], notes: '', sessionCount: 0, totalHours: 0
  };

  const [formData, setFormData] = useState<Course>(initialForm);

  const handleOpenModal = (course?: Course) => {
    if (course) {
      setFormData(course);
      setEditingId(course.id);
    } else {
      setFormData({ ...initialForm, id: crypto.randomUUID() });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const saveCourse = () => {
    editingId ? updateCourse(formData) : addCourse(formData);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveCourse();
    setIsModalOpen(false);
  };

  const handleSaveAndContinue = (e: React.MouseEvent) => {
    e.preventDefault();
    saveCourse();
    setFormData({ ...initialForm, id: crypto.randomUUID() });
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    setConfirmConfig({
        isOpen: true,
        title: "Delete Course?",
        message: "Are you sure you want to delete this course and all its sessions? This action cannot be undone.",
        isDanger: true,
        onConfirm: () => {
            deleteCourse(id);
            setConfirmConfig(null);
        }
    });
  };

  const handleGridUpdate = (id: string, field: string, value: any) => {
    const course = courses.find(c => c.id === id);
    if (course) updateCourse({ ...course, [field]: value });
  };

  const handleAddRow = () => {
      addCourse({ ...initialForm, id: crypto.randomUUID() });
  };

  const handleDeleteRows = (ids: string[]) => {
      ids.forEach(id => deleteCourse(id));
  };

  const processImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
        const rawData = parseCSV(evt.target?.result as string);
        const data = rawData.map((d: any) => ({
            ...d,
            teacherIds: Array.isArray(d.teacherIds) ? d.teacherIds : (d.teacherIds ? [d.teacherIds] : []),
            assistantIds: Array.isArray(d.assistantIds) ? d.assistantIds : (d.assistantIds ? [d.assistantIds] : [])
        }));
        importData('courses', data, 'replace');
        alert(`Imported ${data.length} courses. Data replaced.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        if (courses.length > 0) {
            setConfirmConfig({
                isOpen: true,
                title: "Replace Data?",
                message: "Warning: Importing data will REPLACE all existing course data. Continue?",
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

  const toggleSelection = (id: string, field: 'teacherIds' | 'assistantIds') => {
    setFormData(prev => {
      const current = prev[field];
      const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
      return { ...prev, [field]: next };
    });
  };

  const gridColumns: GridColumn[] = [
    { field: 'name', header: 'Course Name', type: 'text', width: '200px' },
    { field: 'type', header: 'Type', type: 'text', width: '100px' },
    { field: 'difficulty', header: 'Difficulty', type: 'text', width: '100px' },
    { field: 'module', header: 'Module', type: 'text', width: '100px' },
    { field: 'semester', header: 'Semester', type: 'text', width: '100px' },
    { field: 'location', header: 'Location', type: 'text', width: '150px' },
    { field: 'startDate', header: 'Start Date', type: 'date', width: '120px' },
    { field: 'endDate', header: 'End Date', type: 'date', width: '120px' },
    { field: 'sessionCount', header: 'Sessions', type: 'number', width: '90px', editable: false },
    { field: 'totalHours', header: 'Hours', type: 'number', width: '90px', editable: false },
    { field: 'defaultStartTime', header: 'Def. Start', type: 'text', width: '90px' },
    { field: 'defaultEndTime', header: 'Def. End', type: 'text', width: '90px' },
  ];

  const filteredCourses = courses.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <>
    <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Course Management</h2>
        <div className="flex gap-2">
          <div className="flex bg-slate-100 p-1 rounded-lg mr-2">
             <button onClick={() => setViewMode('card')} className={`p-2 rounded ${viewMode === 'card' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><LayoutGrid size={18}/></button>
             <button onClick={() => setViewMode('grid')} className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><Table size={18}/></button>
          </div>
          
          <input type="file" ref={fileInputRef} hidden accept=".csv" onChange={handleImport} />
          <button onClick={() => fileInputRef.current?.click()} className="btn-secondary border px-4 rounded hover:bg-slate-50 flex items-center gap-2"><Upload size={18}/> Import</button>
          <button onClick={() => exportToCSV(courses, 'Courses_Export')} className="btn-secondary flex gap-2 items-center px-4 py-2 border rounded hover:bg-slate-50"><Download size={18} /> Export</button>
          
          <button onClick={() => handleOpenModal()} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700">
            <Plus size={18} /> Add Course
          </button>
        </div>
      </div>

      <div className="mb-4 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} /><input className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg" placeholder="Search courses..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>

      <div className="flex-1 overflow-auto rounded-lg border-slate-200">
        {viewMode === 'grid' ? (
           <DataGrid data={filteredCourses} columns={gridColumns} onUpdate={handleGridUpdate} onAddRow={handleAddRow} onDeleteRows={handleDeleteRows} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
             {filteredCourses.map(c => (
              <div key={c.id} className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-slate-800 line-clamp-1" title={c.name}>{c.name}</h3>
                    <div className="text-xs text-slate-500">{c.type} • {c.semester}</div>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button onClick={() => handleOpenModal(c)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit size={16}/></button>
                    <button onClick={() => handleDelete(c.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                  </div>
                </div>
                <div className="flex-1 space-y-2 text-sm text-slate-600 mt-2">
                  <div className="flex justify-between text-xs bg-slate-50 p-2 rounded">
                      <div className="text-center">
                          <div className="font-bold text-lg text-indigo-600">{c.sessionCount || 0}</div>
                          <div className="text-slate-400">Sessions</div>
                      </div>
                      <div className="text-center">
                          <div className="font-bold text-lg text-indigo-600">{c.totalHours || 0}</div>
                          <div className="text-slate-400">Hours</div>
                      </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                     <div className="bg-slate-50 p-1 rounded">Diff: {c.difficulty || '-'}</div>
                     <div className="bg-slate-50 p-1 rounded">Mod: {c.module || '-'}</div>
                  </div>
                  <div className="text-xs flex gap-2 mt-2">
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{c.teacherIds.length} Teachers</span>
                    <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{c.assistantIds.length} TAs</span>
                  </div>
                  {c.startDate && <div className="text-xs text-slate-400 mt-2 text-right">{c.startDate} to {c.endDate}</div>}
                </div>
              </div>
             ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between sticky top-0 bg-white z-10"><h3 className="text-xl font-bold">{editingId ? 'Edit' : 'Add'} Course</h3><button onClick={() => setIsModalOpen(false)}><X size={24} /></button></div>
            <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <input required placeholder="Course Name" className="p-2 border rounded" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              <input placeholder="Type (e.g. Math)" className="p-2 border rounded" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} />
              <input placeholder="Difficulty" className="p-2 border rounded" value={formData.difficulty} onChange={e => setFormData({...formData, difficulty: e.target.value})} />
              <input placeholder="Module" className="p-2 border rounded" value={formData.module} onChange={e => setFormData({...formData, module: e.target.value})} />
              <input placeholder="Semester" className="p-2 border rounded" value={formData.semester} onChange={e => setFormData({...formData, semester: e.target.value})} />
              <input placeholder="Location" className="p-2 border rounded" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
              <div className="flex gap-2 items-center"><label>Start:</label><input type="date" className="p-2 border rounded w-full" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} /></div>
              <div className="flex gap-2 items-center"><label>End:</label><input type="date" className="p-2 border rounded w-full" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} /></div>
              <div className="flex gap-2 items-center"><label>Def. Session Start:</label><input type="time" className="p-2 border rounded w-full" value={formData.defaultStartTime} onChange={e => setFormData({...formData, defaultStartTime: e.target.value})} /></div>
              <div className="flex gap-2 items-center"><label>Def. Session End:</label><input type="time" className="p-2 border rounded w-full" value={formData.defaultEndTime} onChange={e => setFormData({...formData, defaultEndTime: e.target.value})} /></div>
              
              <div className="col-span-2 border p-4 rounded-lg"><label className="block font-semibold mb-2">Assign Teachers</label><div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">{teachers.map(t => (<button type="button" key={t.id} onClick={() => toggleSelection(t.id, 'teacherIds')} className={`px-3 py-1 rounded-full text-sm border ${formData.teacherIds.includes(t.id) ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-slate-50 border-slate-200'}`}>{t.name}</button>))}</div></div>
              <div className="col-span-2 border p-4 rounded-lg"><label className="block font-semibold mb-2">Assign TAs</label><div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">{assistants.map(t => (<button type="button" key={t.id} onClick={() => toggleSelection(t.id, 'assistantIds')} className={`px-3 py-1 rounded-full text-sm border ${formData.assistantIds.includes(t.id) ? 'bg-green-100 border-green-300 text-green-800' : 'bg-slate-50 border-slate-200'}`}>{t.name}</button>))}</div></div>
              <div className="col-span-2"><textarea placeholder="Notes..." className="w-full p-2 border rounded h-20" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} /></div>
              <div className="col-span-2 flex justify-end gap-3 pt-4 border-t"><button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded">Cancel</button><button type="button" onClick={handleSaveAndContinue} className="px-4 py-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded flex items-center gap-2"><Save size={16} /> Save & Add Another</button><button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded shadow">Save Course</button></div>
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

export default CourseManager;