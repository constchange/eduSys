import React, { useState, useEffect, useRef } from 'react';
import { Session, Course } from '../types';
import { useAppStore } from '../store.tsx';
import { Plus, Edit, Trash2, AlertTriangle, Download, X, CalendarRange, Table, LayoutGrid, Upload, List } from 'lucide-react';
import { calculateDuration, checkConflicts, exportToCSV, parseCSV } from '../utils';
import DataGrid, { GridColumn } from './DataGrid';
import ConfirmModal from './ConfirmModal';

const SessionManager: React.FC = () => {
  const { sessions, courses, teachers, assistants, addSession, updateSession, deleteSession, importData } = useAppStore();
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list'); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [warnings, setWarnings] = useState<string[]>([]);

  // Custom Modal State
  const [confirmConfig, setConfirmConfig] = useState<{
      isOpen: boolean;
      title: string;
      message: React.ReactNode;
      onConfirm: () => void;
      isDanger?: boolean;
  } | null>(null);

  const initialForm: Session = {
    id: '', courseId: '', sequence: 1, topic: '', teacherIds: [], assistantIds: [],
    date: '', startTime: '09:00', endTime: '10:30', durationHours: 1.5, notes: ''
  };

  const [formData, setFormData] = useState<Session>(initialForm);

  // Batch Form State
  const [batchForm, setBatchForm] = useState({
    courseId: '', startDate: '', endDate: '', weekdays: [] as number[],
    startTime: '19:00', endTime: '21:00', topicBase: 'Class Session', useCourseStaff: true
  });

  const activeCourse = courses.find(c => c.id === formData.courseId);
  const availableTeachers = teachers.filter(t => activeCourse?.teacherIds.includes(t.id));
  const availableAssistants = assistants.filter(a => activeCourse?.assistantIds.includes(a.id));

  useEffect(() => {
    const dur = calculateDuration(formData.startTime, formData.endTime);
    setFormData(prev => ({ ...prev, durationHours: dur }));
  }, [formData.startTime, formData.endTime]);

  useEffect(() => {
    if (isModalOpen && formData.date && formData.startTime && formData.endTime) {
      const allPeople = [...teachers, ...assistants];
      const foundWarnings = checkConflicts(formData, sessions, allPeople);
      setWarnings(foundWarnings);
    } else {
      setWarnings([]);
    }
  }, [formData, sessions, isModalOpen]);

  const handleOpenModal = (session?: Session) => {
    if (session) {
      setFormData(session);
      setEditingId(session.id);
    } else {
      setFormData({ ...initialForm, id: crypto.randomUUID(), courseId: selectedCourseId || (courses[0]?.id || '') });
      setEditingId(null);
    }
    setWarnings([]);
    setIsModalOpen(true);
  };

  const performSave = () => {
      editingId ? updateSession(formData) : addSession(formData);
      setIsModalOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (warnings.length > 0) {
        setConfirmConfig({
            isOpen: true,
            title: "Conflicts Detected",
            message: (
                <div>
                    <p className="mb-2">The following conflicts were detected:</p>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-red-600 bg-red-50 p-2 rounded">
                        {warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                    <p className="mt-4">Do you want to save anyway?</p>
                </div>
            ),
            isDanger: true,
            onConfirm: () => {
                performSave();
                setConfirmConfig(null);
            }
        });
        return;
    }
    performSave();
  };

  const handleBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchForm.courseId || !batchForm.startDate) return;
    const course = courses.find(c => c.id === batchForm.courseId);
    if (!course) return;

    let current = new Date(batchForm.startDate);
    const end = new Date(batchForm.endDate);
    const sessionsToAdd: Session[] = [];
    let seq = 1;

    const existingSessions = sessions.filter(s => s.courseId === batchForm.courseId);
    if (existingSessions.length > 0) seq = Math.max(...existingSessions.map(s => s.sequence)) + 1;

    while (current <= end) {
      if (batchForm.weekdays.includes(current.getDay())) {
        const dateStr = current.toISOString().split('T')[0];
        sessionsToAdd.push({
          id: crypto.randomUUID(),
          courseId: batchForm.courseId,
          sequence: seq++,
          topic: `${batchForm.topicBase} ${seq}`,
          date: dateStr,
          startTime: batchForm.startTime,
          endTime: batchForm.endTime,
          durationHours: calculateDuration(batchForm.startTime, batchForm.endTime),
          teacherIds: batchForm.useCourseStaff ? course.teacherIds : [],
          assistantIds: batchForm.useCourseStaff ? course.assistantIds : [],
          notes: ''
        });
      }
      current.setDate(current.getDate() + 1);
    }
    sessionsToAdd.forEach(s => addSession(s));
    setIsBatchModalOpen(false);
  };

  const handleDelete = (id: string) => {
    setConfirmConfig({
        isOpen: true,
        title: "Delete Session?",
        message: "Are you sure you want to delete this session? This cannot be undone.",
        isDanger: true,
        onConfirm: () => {
            deleteSession(id);
            setConfirmConfig(null);
        }
    });
  };

  const handleGridUpdate = (id: string, field: string, value: any) => {
    const session = sessions.find(s => s.id === id);
    if (session) {
      let updates = { [field]: value };
      if (field === 'startTime' || field === 'endTime') {
        const start = field === 'startTime' ? value : session.startTime;
        const end = field === 'endTime' ? value : session.endTime;
        updates = { ...updates, durationHours: calculateDuration(start, end) };
      }
      updateSession({ ...session, ...updates });
    }
  };

  const handleAddRow = () => {
      const defaultCourseId = selectedCourseId || (courses.length > 0 ? courses[0].id : '');
      const newSession: Session = {
          ...initialForm,
          id: crypto.randomUUID(),
          courseId: defaultCourseId,
          sequence: (filteredSessions.length > 0 ? Math.max(...filteredSessions.map(s => s.sequence)) : 0) + 1
      };
      addSession(newSession);
  };

  const handleDeleteRows = (ids: string[]) => {
      ids.forEach(id => deleteSession(id));
  };

  const processImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
        const text = evt.target?.result as string;
        const rawData = parseCSV(text);
        const data = rawData.map((d: any) => ({
          ...d,
          teacherIds: Array.isArray(d.teacherIds) ? d.teacherIds : (d.teacherIds ? [d.teacherIds] : []),
          assistantIds: Array.isArray(d.assistantIds) ? d.assistantIds : (d.assistantIds ? [d.assistantIds] : []),
          sequence: d.sequence ? parseInt(d.sequence) : 0,
          durationHours: d.durationHours ? parseFloat(d.durationHours) : 0
        }));
        importData('sessions', data, 'replace');
        alert(`Imported ${data.length} records. Data replaced.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          if (sessions.length > 0) {
            setConfirmConfig({
                isOpen: true,
                title: "Replace Data?",
                message: "Warning: Importing data will REPLACE all existing session data. Continue?",
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

  const getNames = (ids: string[] | undefined, type: 'T' | 'A') => {
    const list = type === 'T' ? teachers : assistants;
    if (!Array.isArray(ids)) return [];
    return ids.map(id => list.find(p => p.id === id)?.name).filter((n): n is string => !!n);
  };

  const filteredSessions = selectedCourseId ? sessions.filter(s => s.courseId === selectedCourseId) : sessions;

  const gridColumns: GridColumn[] = [
    { field: 'sequence', header: 'Seq', type: 'number', width: '50px' },
    ...(selectedCourseId ? [] : [{ 
        field: 'courseId', 
        header: 'Course', 
        type: 'select' as const, 
        options: courses.map(c => ({label: c.name, value: c.id})),
        width: '150px' 
    }]),
    { field: 'date', header: 'Date', type: 'date', width: '130px' },
    { field: 'startTime', header: 'Start', type: 'text', width: '80px' },
    { field: 'endTime', header: 'End', type: 'text', width: '80px' },
    { field: 'topic', header: 'Topic', type: 'text', width: '200px' },
    { 
        field: 'teacherIds', 
        header: 'Teachers', 
        type: 'multi-select', 
        options: teachers.map(t => ({label: t.name, value: t.id})),
        width: '150px' 
    },
    { 
        field: 'assistantIds', 
        header: 'TAs', 
        type: 'multi-select', 
        options: assistants.map(t => ({label: t.name, value: t.id})),
        width: '150px' 
    },
    { field: 'notes', header: 'Notes', type: 'text', width: '150px' },
  ];

  return (
    <>
    <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Session Management</h2>
        <div className="flex gap-2">
           <select className="border p-2 rounded-lg bg-slate-50 min-w-[150px]" value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)}>
            <option value="">All Courses</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex bg-slate-100 p-1 rounded-lg mr-2">
             <button onClick={() => setViewMode('list')} className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><List size={18}/></button>
             <button onClick={() => setViewMode('grid')} className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><Table size={18}/></button>
          </div>
          
          <input type="file" ref={fileInputRef} hidden accept=".csv" onChange={handleImport} />
          <button onClick={() => fileInputRef.current?.click()} className="btn-secondary border px-4 rounded hover:bg-slate-50 flex items-center gap-2"><Upload size={18}/> Import</button>
          <button onClick={() => exportToCSV(filteredSessions, 'Sessions_Export')} className="btn-secondary border px-4 rounded hover:bg-slate-50"><Download size={18}/></button>
          
          <button onClick={() => setIsBatchModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            <CalendarRange size={18} /> Batch
          </button>
          <button onClick={() => handleOpenModal()} className="bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-orange-700">
            <Plus size={18} /> Add
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto rounded-lg border-slate-200 bg-white">
        {viewMode === 'grid' ? (
          <DataGrid 
            data={filteredSessions.sort((a,b) => a.sequence - b.sequence)} 
            columns={gridColumns} 
            onUpdate={handleGridUpdate}
            onAddRow={handleAddRow}
            onDeleteRows={handleDeleteRows}
          />
        ) : (
          <div className="min-w-full">
             <div className="bg-slate-50 border-b p-3 font-semibold text-slate-500 text-sm flex gap-4">
                 <div className="w-12 text-center">Seq</div>
                 <div className="w-32">Date</div>
                 <div className="w-32">Time</div>
                 <div className="flex-1">Course & Topic</div>
                 <div className="flex-1">Staff</div>
                 <div className="w-20 text-right">Actions</div>
             </div>
             {filteredSessions.sort((a,b) => a.sequence - b.sequence).map(s => {
                 const c = courses.find(x => x.id === s.courseId);
                 const tNames = getNames(s.teacherIds, 'T');
                 const aNames = getNames(s.assistantIds, 'A');
                 return (
                  <div key={s.id} className="border-b p-3 hover:bg-slate-50 flex gap-4 items-center group">
                      <div className="w-12 text-center font-bold text-slate-400">#{s.sequence}</div>
                      <div className="w-32 font-medium">{s.date}</div>
                      <div className="w-32 text-sm text-slate-600">{s.startTime} - {s.endTime}</div>
                      <div className="flex-1 min-w-0">
                          <div className="font-bold text-slate-800 truncate" title={s.topic}>{s.topic}</div>
                          <div className="text-xs text-slate-500 truncate">{c?.name}</div>
                      </div>
                      <div className="flex-1 text-xs space-y-1">
                          {tNames.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {tNames.map((n, i) => <span key={i} className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">{n}</span>)}
                            </div>
                          )}
                          {aNames.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {aNames.map((n, i) => <span key={i} className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-100">{n}</span>)}
                            </div>
                          )}
                      </div>
                      <div className="w-20 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleOpenModal(s)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded"><Edit size={16} /></button>
                        <button onClick={() => handleDelete(s.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded"><Trash2 size={16} /></button>
                      </div>
                  </div>
                );
              })}
              {filteredSessions.length === 0 && <div className="p-8 text-center text-slate-400">No sessions found.</div>}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between">
              <h3 className="text-xl font-bold">{editingId ? 'Edit' : 'Add'} Session</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Course</label>
                <select required className="w-full p-2 border rounded mt-1" value={formData.courseId} onChange={e => setFormData({...formData, courseId: e.target.value, teacherIds: [], assistantIds: []})}>
                  <option value="" disabled>Select Course</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div><label className="text-xs font-bold text-slate-500 uppercase">Sequence #</label><input type="number" required className="w-full p-2 border rounded mt-1" value={formData.sequence} onChange={e => setFormData({...formData, sequence: parseInt(e.target.value)})} /></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase">Date</label><input type="date" required className="w-full p-2 border rounded mt-1" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase">Start Time</label><input type="time" required className="w-full p-2 border rounded mt-1" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} /></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase">End Time</label><input type="time" required className="w-full p-2 border rounded mt-1" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} /></div>
              <div className="col-span-2"><label className="text-xs font-bold text-slate-500 uppercase">Topic</label><input required className="w-full p-2 border rounded mt-1" value={formData.topic} onChange={e => setFormData({...formData, topic: e.target.value})} /></div>
              <div className="col-span-2"><label className="block text-sm font-semibold mb-2">Teachers</label><div className="flex flex-wrap gap-2">{availableTeachers.map(t => (<button type="button" key={t.id} onClick={() => toggleSelection(t.id, 'teacherIds')} className={`px-3 py-1 rounded text-sm border ${formData.teacherIds.includes(t.id) ? 'bg-blue-600 text-white' : 'bg-slate-50'}`}>{t.name}</button>))}</div></div>
              <div className="col-span-2"><label className="block text-sm font-semibold mb-2">TAs</label><div className="flex flex-wrap gap-2">{availableAssistants.map(t => (<button type="button" key={t.id} onClick={() => toggleSelection(t.id, 'assistantIds')} className={`px-3 py-1 rounded text-sm border ${formData.assistantIds.includes(t.id) ? 'bg-green-600 text-white' : 'bg-slate-50'}`}>{t.name}</button>))}</div></div>
              <div className="col-span-2 flex justify-end gap-3 pt-4 border-t"><button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded">Cancel</button><button type="submit" className="px-6 py-2 bg-orange-600 text-white rounded shadow">Save</button></div>
            </form>
          </div>
        </div>
      )}
      {isBatchModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b flex justify-between"><h3 className="text-xl font-bold">Batch Add</h3><button onClick={() => setIsBatchModalOpen(false)}><X size={24} /></button></div>
            <form onSubmit={handleBatchSubmit} className="p-6 space-y-4">
              <select className="w-full p-2 border rounded" value={batchForm.courseId} onChange={e => setBatchForm({...batchForm, courseId: e.target.value})}><option value="">Select Course</option>{courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <div className="grid grid-cols-2 gap-4"><input type="date" className="w-full p-2 border rounded" value={batchForm.startDate} onChange={e => setBatchForm({...batchForm, startDate: e.target.value})} /><input type="date" className="w-full p-2 border rounded" value={batchForm.endDate} onChange={e => setBatchForm({...batchForm, endDate: e.target.value})} /></div>
              <div className="flex gap-2 justify-between">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (<button type="button" key={d} onClick={() => { const newDays = batchForm.weekdays.includes(i) ? batchForm.weekdays.filter(d => d !== i) : [...batchForm.weekdays, i]; setBatchForm({...batchForm, weekdays: newDays}); }} className={`w-10 h-10 rounded-full text-xs font-bold ${batchForm.weekdays.includes(i) ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{d}</button>))}</div>
              <div className="grid grid-cols-2 gap-4"><input type="time" className="w-full p-2 border rounded" value={batchForm.startTime} onChange={e => setBatchForm({...batchForm, startTime: e.target.value})} /><input type="time" className="w-full p-2 border rounded" value={batchForm.endTime} onChange={e => setBatchForm({...batchForm, endTime: e.target.value})} /></div>
              <input className="w-full p-2 border rounded" value={batchForm.topicBase} onChange={e => setBatchForm({...batchForm, topicBase: e.target.value})} />
              <button type="submit" className="w-full py-2 bg-purple-600 text-white rounded font-bold hover:bg-purple-700">Generate</button>
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

export default SessionManager;