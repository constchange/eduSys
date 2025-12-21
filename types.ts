
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

export type Platform = 'tencent' | 'classin';

export interface PlatformMetaEntry {
  platform: Platform;
  courseId?: string;
  sessionId?: string;
  lastSyncedAt?: string; // ISO
  status?: 'ok' | 'error';
  message?: string;
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

  // Optional mapping to external platform IDs/status
  platformMeta?: Record<string, PlatformMetaEntry>;
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

  // 外部平台映射
  platformMeta?: Record<string, PlatformMetaEntry>;
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

export type Role = 'owner' | 'editor' | 'viewer' | 'visitor';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: Role;
}
