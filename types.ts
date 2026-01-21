
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
  email: string;
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
  // 参课学生：存储学生 id 列表（可能较多）
  attendingStudentIds?: string[];

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
  // 参课学生（仅在课节层面可编辑）
  attendingStudentIds?: string[];
  notes: string;

  // 外部平台映射
  platformMeta?: Record<string, PlatformMetaEntry>;
}

// --- 新增实体：学生、客户与学校 ---
export interface Student {
  id: string;
  name: string;
  gender: 'Male' | 'Female' | 'Other';
  dob?: string;

  juniorPrimary?: string;
  juniorHigh?: string;
  seniorHigh?: string;

  primaryCoachIds?: string[]; // 物竞教练 -> 链接到客户 (顾问/老师) 的多条记录 (存 id 列表)

  undergraduate?: string; // 本科高校
  undergraduatePlan?: string; // 高校计划
  researchDirection?: string; // 本研方向 / 研究方向
  graduateUnit?: string; // 研究生单位

  employment?: string; // 就业情况
  awards?: string; // 物竞获奖情况
  highestAward?: string; // 物竞最高奖项
  learningGoals?: string;

  meetingPhone?: string; // 腾讯会议上课手机号

  // 参与的培训（课程 id 列表）
  participatingTraining?: string[];

  totalPayments?: number; // 缴费总数
  rewards?: string; // 奖励情况

  phone?: string;
  motherName?: string;
  motherPhone?: string;
  fatherName?: string;
  fatherPhone?: string;
  address?: string;
  mailingAddress?: string;
  notes?: string;
}

export interface Client {
  id: string;
  name: string;
  gender?: 'Male' | 'Female' | 'Other';
  dob?: string;
  phone?: string;
  demandRecords?: string;
  contactHistory?: string;
  unit?: string; // 工作单位
  // 链接到学校（单条）
  schoolId?: string;
  position?: string; // 职务
  pastUnits?: string[]; // 过往单位（多条、可链接学校表）
  currentTeachingSchool?: string; // 任教中学
  currentTeachingPosition?: string; // 中学职务
  cohorts?: string; // 带第几届学生
  studentIds?: string[]; // 所带学生（链接到 Student）
  projects?: string;
  revenueTotal?: number;
  rebateTotal?: number;
  remitMethod?: string;
  seniorHigh?: string;
  undergraduate?: string;
  admissionPlan?: string; // 升学计划
  masterUnit?: string;
  phdUnit?: string;
  postdocUnit?: string;
  researchDirection?: string;
  familyInfo?: string;
  hobbies?: string;
  address?: string;
  mailingAddress?: string;
  socialMedia?: string;
  notes?: string;
}

export interface School {
  id: string;
  country?: string;
  province?: string;
  city?: string;
  fullName?: string;
  shortName?: string;
  type?: string; // 小学/初中/高中/大学/科研院所/其他
  contactPerson?: string; // 合作代表
  contactPhone?: string;
  demandRecords?: string;
  contactHistory?: string;
  projects?: string;
  revenueTotal?: number;
  rebateTotal?: number;
  teacherIds?: string[]; // 链接到客户表（多条）
  studentIds?: string[]; // 链接到学生表（多条）
  formerLeaders?: string;
  seniorHighAdmission?: string; // 高中升学情况
  olympiadAwards?: string; // 物竞获奖情况
  universityRatings?: string; // 高校学科评级
  officialHomepage?: string;
  notes?: string;
}

export interface OwnerSchedule {
  id: string;
  user_id: string;
  start_datetime: string;
  end_datetime: string;
  type: string;
  title: string;
  location?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ScheduleParams {
  startMonth: string;
  endMonth: string;
  selectedPersonId: string;
  showOwnerSchedules?: boolean;
}

export interface AppState {
  teachers: Person[];
  assistants: Person[];
  courses: Course[];
  sessions: Session[];
  students?: Student[];
  clients?: Client[];
  schools?: School[];
  ownerSchedules?: OwnerSchedule[];
  scheduleParams: ScheduleParams;
}

export type Role = 'owner' | 'editor' | 'viewer' | 'visitor';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone?: string;
}
