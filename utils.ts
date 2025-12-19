
import { Person, Session, Course } from './types';
import { differenceInMinutes, format, areIntervalsOverlapping, endOfWeek, eachDayOfInterval, endOfMonth, isSameMonth, addDays, isValid, eachMonthOfInterval } from 'date-fns';

// --- Date Helpers ---

export const getStartOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
};

export const getStartOfWeek = (date: Date, options: { weekStartsOn: number } = { weekStartsOn: 0 }): Date => {
  const dest = new Date(date);
  const day = dest.getDay();
  const diff = (day < options.weekStartsOn ? 7 : 0) + day - options.weekStartsOn;
  dest.setDate(dest.getDate() - diff);
  dest.setHours(0, 0, 0, 0);
  return dest;
};

export const calculateDuration = (start: string, end: string): number => {
  if (!start || !end) return 0;
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  
  const startDate = new Date();
  startDate.setHours(startH, startM, 0, 0);
  
  const endDate = new Date();
  endDate.setHours(endH, endM, 0, 0);

  const diff = differenceInMinutes(endDate, startDate);
  return parseFloat((diff / 60).toFixed(2));
};

export const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  return format(new Date(dateStr), 'yyyy-MM-dd');
};

// --- Advanced Smart Fill Logic ---

const HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const CHINESE_NUMUMS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

export const predictValues = (sourceValues: any[], countToFill: number): any[] => {
  if (sourceValues.length === 0) return Array(countToFill).fill('');

  // Helper: Try to parse date
  const parseDate = (val: any) => {
    if (typeof val !== 'string') return null;
    // Simple ISO check YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        const d = new Date(val);
        return isValid(d) ? d : null;
    }
    return null;
  };

  // 1. Check Date Pattern
  const firstDate = parseDate(sourceValues[0]);
  const lastDate = parseDate(sourceValues[sourceValues.length - 1]);
  
  if (firstDate && lastDate && sourceValues.length >= 1) {
    const diffDays = sourceValues.length > 1 
        ? Math.round((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24) / (sourceValues.length - 1))
        : 1; // Default increment by 1 day if only single date selected
        
    const result = [];
    let currentDate = lastDate;
    for (let i = 0; i < countToFill; i++) {
        currentDate = addDays(currentDate, diffDays);
        result.push(format(currentDate, 'yyyy-MM-dd'));
    }
    return result;
  }

  // 2. Check Numeric Pattern
  const isAllNumbers = sourceValues.every(v => !isNaN(parseFloat(v)) && isFinite(v));
  if (isAllNumbers && sourceValues.length >= 1) {
    const numbers = sourceValues.map(v => parseFloat(v));
    const first = numbers[0];
    const last = numbers[numbers.length - 1];
    const step = sourceValues.length > 1 ? (last - first) / (sourceValues.length - 1) : 1;
    
    const result = [];
    let current = last;
    for (let i = 0; i < countToFill; i++) {
      current += step;
      result.push(parseFloat(current.toFixed(2))); 
    }
    return result;
  }

  // 3. Complex Alphanumeric & Chinese Pattern
  // Tokenize string: split by numbers, or specific char blocks
  const tokenize = (str: string) => {
      // Split into: Numbers, Chinese Chars, English Words, Other
      return str.split(/([0-9]+|[a-zA-Z]+|[\u4e00-\u9fa5])/).filter(t => t);
  };

  if (typeof sourceValues[0] === 'string') {
      const firstTokens = tokenize(sourceValues[0]);
      const lastTokens = tokenize(sourceValues[sourceValues.length - 1]);
      
      // Only proceed if token structure matches
      if (firstTokens.length === lastTokens.length) {
          const result = [];
          
          // Determine the "step" for each token position
          const steps = firstTokens.map((t, idx) => {
              const startT = t;
              const endT = lastTokens[idx];
              
              // Case A: Number
              if (/^[0-9]+$/.test(startT) && /^[0-9]+$/.test(endT)) {
                  const sNum = parseInt(startT);
                  const eNum = parseInt(endT);
                  const delta = sourceValues.length > 1 ? (eNum - sNum) / (sourceValues.length - 1) : 1;
                  return { type: 'number', val: eNum, step: delta, pad: startT.startsWith('0') ? startT.length : 0 };
              }
              // Case B: Single Letter (A-Z or a-z)
              if (/^[a-zA-Z]$/.test(startT) && /^[a-zA-Z]$/.test(endT)) {
                  const sCode = startT.charCodeAt(0);
                  const eCode = endT.charCodeAt(0);
                  const delta = sourceValues.length > 1 ? (eCode - sCode) / (sourceValues.length - 1) : 1;
                  return { type: 'char', val: eCode, step: delta };
              }
              // Case C: Heavenly Stems (Tiangan)
              if (HEAVENLY_STEMS.includes(startT) && HEAVENLY_STEMS.includes(endT)) {
                  const sIdx = HEAVENLY_STEMS.indexOf(startT);
                  const eIdx = HEAVENLY_STEMS.indexOf(endT);
                  const delta = sourceValues.length > 1 ? (eIdx - sIdx) / (sourceValues.length - 1) : 1;
                  return { type: 'stem', val: eIdx, step: delta };
              }
              // Case D: Chinese Numerals (Simple 1-10 mapping for demo)
              if (CHINESE_NUMUMS.includes(startT) && CHINESE_NUMUMS.includes(endT)) {
                  const sIdx = CHINESE_NUMUMS.indexOf(startT);
                  const eIdx = CHINESE_NUMUMS.indexOf(endT);
                  const delta = sourceValues.length > 1 ? (eIdx - sIdx) / (sourceValues.length - 1) : 1;
                  return { type: 'chn_num', val: eIdx, step: delta };
              }

              // Case Default: Constant
              return { type: 'constant', val: endT };
          });

          // Generate
          for (let i = 0; i < countToFill; i++) {
              let str = '';
              steps.forEach(s => {
                  if (s.type === 'constant') {
                      str += s.val;
                  } else if (s.type === 'number') {
                      const item = s as { val: number, step: number, pad?: number };
                      item.val += item.step;
                      const numStr = Math.round(item.val).toString();
                      str += item.pad ? numStr.padStart(item.pad, '0') : numStr;
                  } else if (s.type === 'char') {
                      const item = s as { val: number, step: number };
                      item.val += item.step;
                      // Wrap A-Z (65-90) or a-z (97-122)
                      // Simple implementation: just increment char code, no wrap logic for simplicity unless it overflows heavily
                      str += String.fromCharCode(Math.round(item.val));
                  } else if (s.type === 'stem') {
                      const item = s as { val: number, step: number };
                      item.val += item.step;
                      const idx = Math.round(item.val) % HEAVENLY_STEMS.length;
                      str += HEAVENLY_STEMS[idx >= 0 ? idx : HEAVENLY_STEMS.length + idx];
                  } else if (s.type === 'chn_num') {
                      const item = s as { val: number, step: number };
                      item.val += item.step;
                      const idx = Math.round(item.val) % CHINESE_NUMUMS.length;
                      str += CHINESE_NUMUMS[idx >= 0 ? idx : CHINESE_NUMUMS.length + idx];
                  }
              });
              result.push(str);
          }
          return result;
      }
  }

  // 4. Fallback: Pattern Repeat
  const result = [];
  for (let i = 0; i < countToFill; i++) {
    result.push(sourceValues[i % sourceValues.length]);
  }
  return result;
};

// --- Import/Export Helpers ---

export const parseCSV = (text: string): any[] => {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const result = [];

  for (let i = 1; i < lines.length; i++) {
    const currentLine = lines[i].split(',');
    // Basic handle for not enough columns
    if (currentLine.length >= headers.length) {
      const obj: any = {};
      headers.forEach((header, index) => {
        let val = currentLine[index]?.trim().replace(/^"|"$/g, '') || '';
        // Restore semi-colons to arrays for IDs if needed
        if (val.includes(';')) {
            obj[header] = val.split(';').map((v: string) => v.trim());
        } else {
            obj[header] = val;
        }
      });
      result.push(obj);
    }
  }
  return result;
};

export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(fieldName => {
      let val = (row as any)[fieldName];
      // Escape commas and quotes
      if (typeof val === 'string') {
        val = `"${val.replace(/"/g, '""')}"`;
      } else if (Array.isArray(val)) {
         val = `"${val.join(';')}"`; // Use semi-colon for arrays in CSV
      }
      return val;
    }).join(','))
  ].join('\n');

  // Add BOM for Excel UTF-8 compatibility
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// --- Conflict & Schedule Helpers (Existing) ---
export const checkConflicts = (
  newSession: Session,
  allSessions: Session[],
  people: Person[] 
): string[] => {
  const warnings: string[] = [];
  const newStart = new Date(`${newSession.date}T${newSession.startTime}`);
  const newEnd = new Date(`${newSession.date}T${newSession.endTime}`);
  
  const getIds = (ids: any) => Array.isArray(ids) ? ids : (ids ? [ids] : []);
  const involvedPeople = [...getIds(newSession.teacherIds), ...getIds(newSession.assistantIds)];

  allSessions.forEach(existing => {
    if (existing.id === newSession.id) return;
    const existStart = new Date(`${existing.date}T${existing.startTime}`);
    const existEnd = new Date(`${existing.date}T${existing.endTime}`);

    const isOverlapping = areIntervalsOverlapping(
      { start: newStart, end: newEnd },
      { start: existStart, end: existEnd }
    );

    if (isOverlapping) {
      const existingPeople = [...getIds(existing.teacherIds), ...getIds(existing.assistantIds)];
      const doubleBooked = involvedPeople.filter(id => existingPeople.includes(id));
      if (doubleBooked.length > 0) {
        const names = people.filter(p => doubleBooked.includes(p.id)).map(p => p.name).join(', ');
        warnings.push(`Conflict Detected: ${names} in session "${existing.topic}" (${existing.startTime}-${existing.endTime}).`);
      }
    }
  });
  return warnings;
};

export const exportScheduleToHTML = (
  person: Person | { name: string; type: string },
  sessions: Session[],
  courses: Course[],
  teachers: Person[], // Added teachers parameter to lookup names
  startMonthStr: string, // YYYY-MM
  endMonthStr: string,   // YYYY-MM
  colorMap: Record<string, string> = {}
) => {
  // Generate range of months
  const months = eachMonthOfInterval({
    start: new Date(startMonthStr + '-01'),
    end: new Date(endMonthStr + '-01')
  });

  // Map Tailwind colors to simple CSS inline styles for export
  const getColorStyle = (twClass: string) => {
    if (twClass.includes('red')) return 'background: #fee2e2; color: #991b1b; border-color: #fecaca;';
    if (twClass.includes('orange')) return 'background: #ffedd5; color: #9a3412; border-color: #fed7aa;';
    if (twClass.includes('amber')) return 'background: #fef3c7; color: #92400e; border-color: #fde68a;';
    if (twClass.includes('yellow')) return 'background: #fef9c3; color: #854d0e; border-color: #fef08a;';
    if (twClass.includes('lime')) return 'background: #ecfccb; color: #3f6212; border-color: #d9f99d;';
    if (twClass.includes('green')) return 'background: #dcfce7; color: #166534; border-color: #bbf7d0;';
    if (twClass.includes('emerald')) return 'background: #d1fae5; color: #065f46; border-color: #a7f3d0;';
    if (twClass.includes('teal')) return 'background: #ccfbf1; color: #115e59; border-color: #99f6e4;';
    if (twClass.includes('cyan')) return 'background: #cffafe; color: #155f75; border-color: #a5f3fc;';
    if (twClass.includes('sky')) return 'background: #e0f2fe; color: #075985; border-color: #bae6fd;';
    if (twClass.includes('blue')) return 'background: #dbeafe; color: #1e40af; border-color: #bfdbfe;';
    if (twClass.includes('indigo')) return 'background: #e0e7ff; color: #3730a3; border-color: #c7d2fe;';
    if (twClass.includes('violet')) return 'background: #ede9fe; color: #5b21b6; border-color: #ddd6fe;';
    if (twClass.includes('purple')) return 'background: #f3e8ff; color: #6b21a8; border-color: #e9d5ff;';
    if (twClass.includes('fuchsia')) return 'background: #fae8ff; color: #86198f; border-color: #f5d0fe;';
    if (twClass.includes('pink')) return 'background: #fce7f3; color: #9d174d; border-color: #fbcfe8;';
    if (twClass.includes('rose')) return 'background: #ffe4e6; color: #9f1239; border-color: #fecdd3;';
    return 'background: #e0f2fe; color: #0369a1; border-color: #bae6fd;'; // Default blue
  };

  let allTablesHtml = '';

  months.forEach(monthDate => {
      const monthStr = format(monthDate, 'yyyy-MM');
      const startMonth = monthDate;
      const endMonthDate = endOfMonth(startMonth);
      const startCal = getStartOfWeek(startMonth, { weekStartsOn: 1 });
      const endCal = endOfWeek(endMonthDate, { weekStartsOn: 1 });
      const days = eachDayOfInterval({ start: startCal, end: endCal });

      let gridHtml = '';
      let dayCount = 0;

      days.forEach(day => {
        if (dayCount % 7 === 0) gridHtml += '<tr>';
        
        const dateStr = format(day, 'yyyy-MM-dd');
        const isCurrentMonth = isSameMonth(day, startMonth);
        const daySessions = sessions.filter(s => s.date === dateStr).sort((a,b) => a.startTime.localeCompare(b.startTime));
        
        let cellContent = '';
        if (daySessions.length > 0) {
            daySessions.forEach(s => {
                const course = courses.find(c => c.id === s.courseId);
                const twClass = colorMap[s.courseId] || '';
                const style = getColorStyle(twClass);
                
                // Retrieve teachers
                const teacherIds = Array.isArray(s.teacherIds) ? s.teacherIds : [];
                const sessionTeachers = teachers
                    .filter(t => teacherIds.includes(t.id))
                    .map(t => t.name)
                    .join(', ');

                cellContent += `
                    <div class="session" style="${style}">
                        <div class="time">${s.startTime}-${s.endTime}</div>
                        <div class="topic">${s.topic}</div>
                        <div class="footer">
                            <span class="course">${course?.name || ''}</span>
                            <span class="teachers">${sessionTeachers}</span>
                        </div>
                    </div>
                `;
            });
        }

        gridHtml += `
          <td class="${isCurrentMonth ? '' : 'other-month'}">
            <div class="date-num">${format(day, 'd')}</div>
            ${cellContent}
          </td>
        `;
        
        if (dayCount % 7 === 6) gridHtml += '</tr>';
        dayCount++;
      });

      allTablesHtml += `
        <div class="month-block">
            <h2>${format(monthDate, 'MMMM yyyy')}</h2>
            <table>
                <thead>
                <tr>
                    <th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th><th>Sun</th>
                </tr>
                </thead>
                <tbody>
                ${gridHtml}
                </tbody>
            </table>
        </div>
      `;
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Schedule: ${person.name}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #333; }
        h1 { margin-bottom: 5px; }
        .meta { color: #666; margin-bottom: 20px; border-bottom: 1px solid #ddd; padding-bottom: 10px;}
        .month-block { margin-bottom: 40px; page-break-inside: avoid; }
        h2 { margin-bottom: 10px; color: #475569; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th { background: #f1f5f9; padding: 10px; border: 1px solid #e2e8f0; }
        td { vertical-align: top; height: 120px; padding: 5px; border: 1px solid #e2e8f0; background: #fff; }
        td.other-month { background: #f8fafc; color: #94a3b8; }
        .date-num { font-weight: bold; margin-bottom: 5px; text-align: right; }
        .session { padding: 4px; margin-bottom: 4px; font-size: 0.85em; border-radius: 2px; border-left: 3px solid; display: flex; flex-direction: column; }
        .time { font-weight: bold; }
        .topic { font-weight: 500; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .footer { display: flex; justify-content: space-between; font-size: 0.9em; opacity: 0.9; margin-top: 2px; }
        .course { opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60%; }
        .teachers { text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 40%; font-weight: 500; }
        @media print {
            .month-block { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <h1>Schedule: ${person.name}</h1>
      <div class="meta">${person.type} | Range: ${startMonthStr} to ${endMonthStr}</div>
      ${allTablesHtml}
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Schedule_${person.name}_${startMonthStr}_to_${endMonthStr}.html`;
  link.click();
};
