import React, { useMemo, useEffect } from 'react';
import { useAppStore } from '../store.tsx';
import { Download, Calendar, BarChart2, Upload } from 'lucide-react';
import { exportScheduleToHTML, getStartOfWeek, exportToCSV } from '../utils';
import { endOfMonth, endOfWeek, eachDayOfInterval, format, isSameMonth, eachMonthOfInterval } from 'date-fns';

const COURSE_COLORS = [
  'bg-red-100 text-red-800 border-red-200', 'bg-orange-100 text-orange-800 border-orange-200',
  'bg-amber-100 text-amber-800 border-amber-200', 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'bg-lime-100 text-lime-800 border-lime-200', 'bg-green-100 text-green-800 border-green-200',
  'bg-emerald-100 text-emerald-800 border-emerald-200', 'bg-teal-100 text-teal-800 border-teal-200',
  'bg-cyan-100 text-cyan-800 border-cyan-200', 'bg-sky-100 text-sky-800 border-sky-200',
  'bg-blue-100 text-blue-800 border-blue-200', 'bg-indigo-100 text-indigo-800 border-indigo-200',
  'bg-violet-100 text-violet-800 border-violet-200', 'bg-purple-100 text-purple-800 border-purple-200',
  'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200', 'bg-pink-100 text-pink-800 border-pink-200',
  'bg-rose-100 text-rose-800 border-rose-200',
];

interface MonthlyStats {
  total: number;
  courses: Record<string, number>;
}

const ScheduleStats: React.FC = () => {
  const { teachers, assistants, sessions, courses, scheduleParams, updateScheduleParams, currentUser } = useAppStore();
  const isViewer = !!(currentUser && currentUser.role === 'viewer');
  const [viewMode, setViewMode] = React.useState<'calendar' | 'stats'>('calendar');

  // Load state from store
  const { startMonth, endMonth, selectedPersonId } = scheduleParams;

  // Set default End Month to the last session's month if not set
  useEffect(() => {
      if (sessions.length > 0) {
          // Find the absolute last date in ALL sessions to set a safe default range
          const sorted = [...sessions].sort((a,b) => b.date.localeCompare(a.date));
          const lastSessionDate = sorted[0]?.date;
          
          if (!endMonth && lastSessionDate) {
               const lastMonthStr = lastSessionDate.slice(0, 7);
               // Only set if it's after start month, else default to start month + 3
               if (lastMonthStr >= startMonth) {
                   updateScheduleParams({ endMonth: lastMonthStr });
               } else {
                   // Fallback: Current + 3
                   const d = new Date();
                   d.setMonth(d.getMonth() + 3);
                   updateScheduleParams({ endMonth: d.toISOString().slice(0, 7) });
               }
          }
      } else if (!endMonth) {
           const d = new Date();
           d.setMonth(d.getMonth() + 3);
           updateScheduleParams({ endMonth: d.toISOString().slice(0, 7) });
      }
  }, [sessions, startMonth, endMonth, updateScheduleParams]);

  // For viewers, compute separate lists for teachers and assistants to avoid duplicates
  const viewerTeachers = isViewer ? teachers.filter(t => t.name === currentUser?.name) : [];
  const viewerAssistants = isViewer ? assistants.filter(a => a.name === currentUser?.name) : [];
  const people = isViewer ? [...viewerTeachers, ...viewerAssistants] : [...teachers, ...assistants];

  const selectedPerson = selectedPersonId === 'ALL'
    ? { id: 'ALL', name: 'ALL STAFF (Overview)', type: 'Overview' } as any
    : (teachers.find(p => p.id === selectedPersonId) || assistants.find(p => p.id === selectedPersonId));

  // If viewer, ensure selectedPersonId is set to their own person id (prefer teacher, else assistant)
  React.useEffect(() => {
    if (!isViewer) return;
    const mine = viewerTeachers[0] ?? viewerAssistants[0];
    if (mine && selectedPersonId !== mine.id) updateScheduleParams({ selectedPersonId: mine.id });
  }, [isViewer, viewerTeachers, viewerAssistants, selectedPersonId, updateScheduleParams]);

  const courseColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    courses.forEach((c, idx) => map[c.id] = COURSE_COLORS[idx % COURSE_COLORS.length]);
    return map;
  }, [courses]);

  const personSessions = useMemo(() => {
    if (!selectedPersonId) return [];
    if (selectedPersonId === 'ALL') return isViewer ? sessions.filter(s => {
      // Viewer shouldn't see ALL; but if somehow selected, restrict to matching name
      const teacherNames = teachers.filter(t => s.teacherIds.includes(t.id)).map(t => t.name);
      const assistantNames = assistants.filter(a => s.assistantIds.includes(a.id)).map(a => a.name);
      return teacherNames.includes(currentUser?.name || '') || assistantNames.includes(currentUser?.name || '');
    }) : sessions;
    return sessions.filter(s => s.teacherIds.includes(selectedPersonId) || s.assistantIds.includes(selectedPersonId));
  }, [selectedPersonId, sessions, isViewer, teachers, assistants, currentUser]);

  const monthsToDisplay = useMemo(() => {
      if (!startMonth || !endMonth || startMonth > endMonth) return [];
      try {
        const start = new Date(startMonth + '-01');
        const end = new Date(endMonth + '-01');
        return eachMonthOfInterval({ start, end });
      } catch (e) {
          return [];
      }
  }, [startMonth, endMonth]);

  // Nested Stats: Teacher -> Month -> Course -> Hours
  const stats = useMemo(() => {
    const data: Record<string, Record<string, MonthlyStats>> = {}; 
    
    teachers.forEach(t => {
      data[t.id] = {};
      const tSessions = sessions.filter(s => s.teacherIds.includes(t.id));
      tSessions.forEach(s => {
        const monthKey = s.date.substring(0, 7);
        if (!data[t.id][monthKey]) data[t.id][monthKey] = { total: 0, courses: {} };
        
        const entry = data[t.id][monthKey];
        entry.total += s.durationHours;
        entry.courses[s.courseId] = (entry.courses[s.courseId] || 0) + s.durationHours;
      });
    });
    return data;
  }, [sessions, teachers]);

  const statMonths = useMemo(() => {
      const set = new Set<string>();
      Object.values(stats).forEach(mMap => Object.keys(mMap).forEach(k => set.add(k)));
      return Array.from(set).sort();
  }, [stats]);

  const exportDetailedStats = () => {
      const rows: any[] = [];
      teachers.forEach(t => {
          const tStats = stats[t.id];
          if (tStats) {
              Object.entries(tStats).forEach(([month, data]) => {
                  const statEntry = data as MonthlyStats;
                  Object.entries(statEntry.courses).forEach(([courseId, hours]) => {
                       const h = hours as number;
                       const cName = courses.find(c => c.id === courseId)?.name || 'Unknown';
                       rows.push({
                           Teacher: t.name,
                           Month: month,
                           Course: cName,
                           Hours: h.toFixed(2),
                       });
                  });
              });
          }
      });
      if (rows.length === 0) return window.alert("No data to export");
      exportToCSV(rows, 'Detailed_Workload_Stats');
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          {viewMode === 'calendar' ? <Calendar /> : <BarChart2 />}
          {viewMode === 'calendar' ? 'Schedule Generator' : 'Workload Statistics'}
        </h2>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button onClick={() => setViewMode('calendar')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'calendar' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Calendar</button>
          <button onClick={() => setViewMode('stats')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'stats' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Statistics</button>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex flex-wrap gap-4 mb-4 items-end bg-slate-50 p-4 rounded-lg border border-slate-100">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-semibold text-slate-600 mb-1">Select Staff</label>
              <select className="w-full border p-2 rounded-lg" value={selectedPersonId} onChange={e => updateScheduleParams({ selectedPersonId: e.target.value })}>
                <option value="">-- Select --</option>
                {!isViewer && <option value="ALL" className="font-bold">ALL STAFF (Overview)</option>}
                <optgroup label="Teachers">{(isViewer ? viewerTeachers : teachers).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>
                <optgroup label="Assistants">{(isViewer ? viewerAssistants : assistants).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup>
              </select>
            </div>
            <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">From</label>
                <input type="month" className="border p-2 rounded-lg" value={startMonth} onChange={e => updateScheduleParams({ startMonth: e.target.value })} />
            </div>
            <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">To</label>
                <input type="month" className="border p-2 rounded-lg" value={endMonth} onChange={e => updateScheduleParams({ endMonth: e.target.value })} />
            </div>
            {/* Export HTML -> Download Icon */}
            <button 
                disabled={!selectedPersonId} 
                onClick={() => selectedPerson && exportScheduleToHTML(selectedPerson, personSessions, courses, teachers, startMonth, endMonth, courseColorMap)} 
                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 h-[42px]"
            >
                <Download size={18} /> Export HTML
            </button>
          </div>

          <div className="flex-1 overflow-auto border rounded-lg bg-slate-50 p-4 space-y-8">
            {selectedPersonId && monthsToDisplay.length > 0 ? (
                monthsToDisplay.map(monthDate => {
                    const monthStr = format(monthDate, 'yyyy-MM');
                    const startM = monthDate;
                    const endM = endOfMonth(startM);
                    const startCal = getStartOfWeek(startM, { weekStartsOn: 1 });
                    const endCal = endOfWeek(endM, { weekStartsOn: 1 });
                    const days = eachDayOfInterval({ start: startCal, end: endCal });

                    return (
                        <div key={monthStr} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="text-lg font-bold text-slate-700 mb-3 ml-1">{format(monthDate, 'MMMM yyyy')}</h3>
                            <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <div key={day} className="bg-slate-100 p-2 text-center font-bold text-slate-600 text-sm">{day}</div>)}
                                {days.map(date => {
                                const dateStr = format(date, 'yyyy-MM-dd');
                                const isCurrent = isSameMonth(date, monthDate);
                                // Use explicit string matching for safety
                                const daysSessions = personSessions.filter(s => s.date === dateStr).sort((a,b) => a.startTime.localeCompare(b.startTime));
                                
                                return (
                                    <div key={dateStr} className={`min-h-[120px] bg-white p-2 ${!isCurrent ? 'bg-slate-50 opacity-60' : ''}`}>
                                        <div className={`text-right text-sm font-medium mb-1 ${!isCurrent ? 'text-slate-400' : 'text-slate-700'}`}>{format(date, 'd')}</div>
                                        <div className="space-y-1">{daysSessions.map(s => {
                                            const courseName = courses.find(c => c.id === s.courseId)?.name;
                                            const colorClass = courseColorMap[s.courseId] || 'bg-slate-100 text-slate-800 border-slate-200';
                                            const teacherNames = teachers.filter(t => s.teacherIds.includes(t.id)).map(t => t.name).join(', ');
                                            
                                            return (
                                                <div key={s.id} className={`text-xs p-1.5 rounded border-l-2 overflow-hidden ${colorClass}`}>
                                                    <div className="font-bold truncate">{s.startTime}-{s.endTime}</div>
                                                    <div className="truncate font-medium" title={s.topic}>{s.topic}</div>
                                                    <div className="flex justify-between items-center opacity-75 text-[10px] mt-0.5 gap-2">
                                                        <span className="truncate flex-1" title={courseName}>{courseName}</span>
                                                        <span className="truncate text-right shrink-0 max-w-[50%] font-medium" title={teacherNames}>{teacherNames}</span>
                                                    </div>
                                                </div>
                                            );
                                            })}</div>
                                    </div>
                                );
                                })}
                            </div>
                        </div>
                    );
                })
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">Select staff and date range to view the calendar.</div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
           <div className="flex justify-end mb-4">
              {/* Export Excel -> Download Icon */}
              <button onClick={exportDetailedStats} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"><Download size={18}/> Export Details to Excel</button>
           </div>
           <div className="flex-1 overflow-auto border rounded-lg bg-white">
            {statMonths.length === 0 ? <div className="p-8 text-center text-slate-500">No data available.</div> : (
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                    <tr>
                        <th className="p-3 border-b font-semibold text-slate-700 w-48 bg-slate-50">Teacher</th>
                        {statMonths.map(m => <th key={m} className="p-3 border-b font-semibold text-slate-700 min-w-[200px] bg-slate-50">{m}</th>)}
                    </tr>
                    </thead>
                    <tbody>
                    {(isViewer ? teachers.filter(t => t.name === currentUser?.name) : teachers).map(t => (
                        <tr key={t.id} className="hover:bg-slate-50">
                        <td className="p-3 border-b font-medium bg-slate-50/30">{t.name}</td>
                        {statMonths.map(m => {
                            const entry = stats[t.id][m] as MonthlyStats | undefined;
                            if (!entry) return <td key={m} className="p-3 border-b text-slate-300 text-center">-</td>;
                            return (
                                <td key={m} className="p-3 border-b align-top">
                                    <div className="flex items-baseline gap-2 mb-2">
                                        <div className="font-bold text-lg text-blue-700">{entry.total.toFixed(1)}</div>
                                        <div className="text-xs text-slate-500">hours</div>
                                    </div>
                                    <div className="space-y-1">
                                        {Object.entries(entry.courses).map(([cId, hrs]) => {
                                            const cName = courses.find(c => c.id === cId)?.name || 'Unknown';
                                            const hours = hrs as number;
                                            return (
                                                <div key={cId} className="flex justify-between items-center text-xs text-slate-600 bg-slate-100 p-1.5 rounded">
                                                    <span className="truncate mr-2 max-w-[120px]" title={cName}>{cName}</span>
                                                    <span className="font-bold">{hours.toFixed(1)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </td>
                            );
                        })}
                        </tr>
                    ))}
                    </tbody>
                </table>
            )}
            </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleStats;