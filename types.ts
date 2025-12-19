
export interface Person {
  id: string;
  name: string;
  gender: 'Male' | 'Female' | 'Other';
  dob: string; // Date of Birth
  
  // Education History
  juniorHigh: string;
  seniorHigh: string;
  university: string; // Institute - Dept - Plan
  researchLab: string;

  // Work & Experience
  workHistory: string;
  currentUnit: string; // Current Study/Work Unit
  
  // Teaching Profile
  difficultyRange: string;
  preferences: string; // Teaching/TA preferences
  
  // Contact & Finance
  phone: string;
  wechat: string;
  address: string;
  bankAccount: string;
  
  type: 'Teacher' | 'TA';
}

export interface Course {
  id: string;
  name: string;
  type: string;
  difficulty: string;
  module: string;
  semester: string;
  location: string;
  startDate: string;
  endDate: string;
  
  // Stats (Auto-calculated)
  sessionCount: number;
  totalHours: number;

  // Optional default session times
  defaultStartTime?: string; 
  defaultEndTime?: string;

  teacherIds: string[];
  assistantIds: string[];
  notes: string;
}

export interface Session {
  id: string;
  courseId: string;
  sequence: number;
  topic: string;
  teacherIds: string[];
  assistantIds: string[];
  date: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  durationHours: number;
  notes: string;
}

export interface ScheduleParams {
  startMonth: string;
  endMonth: string;
  selectedPersonId: string;
}

export interface AppState {
  teachers: Person[];
  assistants: Person[];
  courses: Course[];
  sessions: Session[];
  scheduleParams: ScheduleParams;
}
