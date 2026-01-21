import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { AppState, Course, Person, Session, ScheduleParams, UserRecord, Role, Student, Client, School, OwnerSchedule } from './types';

// --- 1. 定义数据库白名单 (DB Schema Definition) ---
// 只有在这里列出的字段才会被发送到 Supabase。
// 任何前端临时字段 (如 sessionCount, totalHours, excel里的额外列) 都会被自动过滤。
const DB_SCHEMA = {
  people: [
    'id', 'name', 'gender', 'dob', 
    'juniorHigh', 'seniorHigh', 'university', 'researchLab',
    'workHistory', 'currentUnit', 
    'difficultyRange', 'preferences', 
    'phone', 'wechat', 'address', 'bankAccount', 
    'type'
  ],
  courses: [
    'id', 'name', 'type', 'difficulty', 'module', 'semester', 
    'location', 'startDate', 'endDate', 
    'defaultStartTime', 'defaultEndTime', 
    'teacherIds', 'assistantIds', 'attendingStudentIds', 'notes'
    // 注意：sessionCount 和 totalHours 是前端计算属性，不存数据库，所以不写在这里
  ],
  sessions: [
    'id', 'courseId', 'sequence', 'topic', 
    'teacherIds', 'assistantIds', 'attendingStudentIds',
    'date', 'startTime', 'endTime', 'durationHours', 
    'notes'
  ],

  students: [
    'id','name','gender','dob','juniorPrimary','juniorHigh','seniorHigh','primaryCoachIds','undergraduate','undergraduatePlan','researchDirection','graduateUnit','employment','awards','highestAward','learningGoals','meetingPhone','participatingTraining','totalPayments','rewards','phone','motherName','motherPhone','fatherName','fatherPhone','address','mailingAddress','notes'
  ],

  clients: [
    'id','name','gender','dob','phone','demandRecords','contactHistory','unit','schoolId','position','pastUnits','currentTeachingSchool','currentTeachingPosition','cohorts','studentIds','projects','revenueTotal','rebateTotal','remitMethod','seniorHigh','undergraduate','admissionPlan','masterUnit','phdUnit','postdocUnit','researchDirection','familyInfo','hobbies','address','mailingAddress','socialMedia','notes'
  ],

  schools: [
    'id','country','province','city','fullName','shortName','type','contactPerson','contactPhone','demandRecords','contactHistory','projects','revenueTotal','rebateTotal','teacherIds','studentIds','formerLeaders','seniorHighAdmission','olympiadAwards','universityRatings','officialHomepage','notes'
  ],

  // 用户表：用于权限管理（与 Auth 整合）
  users: ['id', 'email', 'name', 'phone', 'role'],

  // 负责人日程表
  owner_schedules: [
    'id', 'user_id', 'start_datetime', 'end_datetime', 'type', 'title', 'location', 'notes', 'created_at', 'updated_at'
  ]
};

// --- 2. 数据清洗函数 (Sanitizer) ---
const sanitize = (data: any, table: keyof typeof DB_SCHEMA) => {
  const allowedFields = DB_SCHEMA[table];
  const cleanData: any = {};
  
  allowedFields.forEach(field => {
    if (data[field] !== undefined) {
      cleanData[field] = data[field];
    }
  });
  
  return cleanData;
};

interface AppContextType extends AppState {
  addPerson: (p: Person) => void;
  updatePerson: (p: Person) => void;
  deletePerson: (id: string) => void;
  addCourse: (c: Course) => void;
  updateCourse: (c: Course) => void;
  deleteCourse: (id: string) => void;
  addSession: (s: Session) => void;
  updateSession: (s: Session) => void;
  deleteSession: (id: string) => void;
  // 新增实体 CRUD
  addStudent: (s: any) => void;
  updateStudent: (s: any) => void;
  deleteStudent: (id: string) => void;
  addClient: (c: any) => void;
  updateClient: (c: any) => void;
  deleteClient: (id: string) => void;
  addSchool: (s: any) => void;
  updateSchool: (s: any) => void;
  deleteSchool: (id: string) => void;
  loadOwnerSchedules: () => Promise<void>;
  addOwnerSchedule: (s: OwnerSchedule) => void;
  updateOwnerSchedule: (s: OwnerSchedule) => void;
  deleteOwnerSchedule: (id: string) => void;
  importData: (type: 'teachers' | 'assistants' | 'courses' | 'sessions' | 'students' | 'clients' | 'schools', data: any[], mode: 'append' | 'replace') => void;
  updateScheduleParams: (params: Partial<ScheduleParams>) => void;
  recalculateAllSequences: () => Promise<void>;
  isLoading: boolean;
  profileLoading: boolean;
  users: UserRecord[];
  currentUser: UserRecord | null;
  isEditor: boolean;
  updateUserRole: (userId: string, role: Role) => Promise<void>;
  refreshUsers: () => Promise<void>;
  inviteUser: (email: string, name: string, role?: Role, phone?: string) => Promise<boolean>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const initialState: AppState = {
  teachers: [],
  assistants: [],
  courses: [],
  sessions: [],
  students: [],
  clients: [],
  schools: [],
  ownerSchedules: [],
  scheduleParams: {
    startMonth: new Date().toISOString().slice(0, 7),
    endMonth: '',
    selectedPersonId: '',
    showOwnerSchedules: false
  }
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(initialState);
  const [isLoading, setIsLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const isEditor = !!(currentUser && currentUser.role === 'editor');

  // Function to manually refresh users list from DB
  const refreshUsers = async () => {
    try {
      const { data, error } = await supabase.from('users').select('*');
      if (error) throw error;
      setUsers((data as UserRecord[]) || []);
      console.log('[Store] Users list refreshed manually:', data?.length);
    } catch (e) {
      console.error('[Store] Failed to refresh users:', e);
    }
  };

  // --- 初始化加载数据 (READ) ---
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const peopleRes = await supabase.from('people').select('*');
        const usersRes = await supabase.from('users').select('*');
        const coursesRes = await supabase.from('courses').select('*');
        const sessionsRes = await supabase.from('sessions').select('*');
        const studentsRes = await supabase.from('students').select('*');
        const clientsRes = await supabase.from('clients').select('*');
        const schoolsRes = await supabase.from('schools').select('*');

        const people = (peopleRes.data as Person[]) || [];
        const usersList = (usersRes.data as UserRecord[]) || [];
        const coursesRaw = (coursesRes.data as Course[]) || [];
        const sessions = (sessionsRes.data as Session[]) || [];
        const students = (studentsRes.data as any[]) || [];
        const clients = (clientsRes.data as any[]) || [];
        const schools = (schoolsRes.data as any[]) || [];

        // 前端计算统计数据
        const courses = coursesRaw.map(c => {
             const cSessions = sessions.filter(s => s.courseId === c.id);
             const totalHours = cSessions.reduce((sum, s) => sum + (Number(s.durationHours) || 0), 0);
             
             // 自动计算开始和结束日期
             let startDate = c.startDate;
             let endDate = c.endDate;
             if (cSessions.length > 0) {
               const dates = cSessions.map(s => s.date).filter(Boolean).sort();
               startDate = dates[0];
               endDate = dates[dates.length - 1];
             }
             
             // normalize platform_meta (DB) to platformMeta (frontend)
             const platformMeta = (c as any).platform_meta ? (c as any).platform_meta : undefined;
             return {
                 ...c,
                 startDate,
                 endDate,
                 sessionCount: cSessions.length,
                 totalHours: parseFloat(totalHours.toFixed(2)),
                 platformMeta
             };
        });

        setState(prev => ({
          ...prev,
          teachers: people.filter(p => p.type === 'Teacher'),
          assistants: people.filter(p => p.type === 'TA'),
          courses: courses,
          sessions: sessions,
          students: students,
          clients: clients,
          schools: schools,
          ownerSchedules: [] // 延迟加载，不在初始化时加载
        }));

        setUsers(usersList);

        if (peopleRes.error) console.error("Fetch People Error:", peopleRes.error);
        
      } catch (error: any) {
        console.error("Critical Load Error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // 监听 auth 状态并设置 currentUser（根据 users 表的 email 匹配）
  useEffect(() => {
    // 使用 ref 来跟踪是否已经完成初始加载，避免重复显示 loading
    let isInitialLoad = true;
    
    const setProfileFromAuth = async (showLoading = true) => {
      // 只在初次加载或明确需要时才显示 loading
      if (showLoading && isInitialLoad) {
        setProfileLoading(true);
      }
      try {
        const { data } = await supabase.auth.getUser();
        const authUser = data.user;
        if (authUser && authUser.email) {
          const { data: u } = await supabase.from('users').select('*').eq('email', authUser.email).maybeSingle();
          if (u) {
            setCurrentUser(u as UserRecord);
          } else {
            // 如果 users 表中不存在记录，尝试通过 RPC (claim_or_create_user) 来创建或认领这条记录。
            // 这可以处理历史遗留的无 auth_id 行或在注册时未插入带 auth_id 的情况。
            const metaName = (authUser as any)?.user_metadata?.name || authUser.email;
            try {
              const rpcRes = await supabase.rpc('claim_or_create_user', { p_email: authUser.email, p_name: metaName });
              // rpc 返回 users 行
              if (rpcRes && rpcRes.data && rpcRes.data.length > 0) {
                const created = rpcRes.data[0] as UserRecord;
                setCurrentUser(created);
                const usersFetch = await supabase.from('users').select('*');
                setUsers((usersFetch.data as UserRecord[]) || []);
              } else {
                // fallback to simple fetch
                const { data: newU } = await supabase.from('users').select('*').eq('email', authUser.email).maybeSingle();
                if (newU) setCurrentUser(newU as UserRecord);
                else setCurrentUser(null);
              }
            } catch (e) {
              console.error('Failed to claim/create users row via RPC:', e);
              setCurrentUser(null);
            }
          }
        } else {
          setCurrentUser(null);
        }
      } catch (e) {
        console.error('Error setting current user from auth:', e);
      } finally {
        if (showLoading && isInitialLoad) {
          setProfileLoading(false);
          isInitialLoad = false;
        }
      }
    };

    // 初始加载时显示 loading
    setProfileFromAuth(true);

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Store] Auth state change event:', event);
      // 只在真正的登录/登出时重新加载用户配置
      // 移除 INITIAL_SESSION，避免在窗口焦点变化时重新加载
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        // 后续的认证状态变化不显示 loading 界面，静默更新
        setProfileFromAuth(false);
      }
      // 忽略 TOKEN_REFRESHED, USER_UPDATED, INITIAL_SESSION 等事件
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // Real-time updates: keep users list in sync when other admins or new registrations change the users table
  useEffect(() => {
    console.log('[Realtime] Setting up users table subscription...');
    const channel = supabase.channel('public:users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, (payload: any) => {
        try {
          console.log('[Realtime] Users table change detected:', payload.eventType, payload);
          // payload.eventType is 'INSERT'|'UPDATE'|'DELETE' and payload.new / payload.old contain rows
          if (payload.eventType === 'INSERT') {
            setUsers(prev => {
              // Avoid duplicates
              if (prev.some(u => u.id === payload.new.id)) {
                console.log('[Realtime] Duplicate user insert ignored:', payload.new.id);
                return prev;
              }
              console.log('[Realtime] Adding new user:', payload.new);
              return [...prev, payload.new];
            });
          } else if (payload.eventType === 'UPDATE') {
            console.log('[Realtime] Updating user:', payload.new.id);
            setUsers(prev => prev.map(u => u.id === payload.new.id ? payload.new : u));
            setCurrentUser(prev => prev && prev.id === payload.new.id ? payload.new : prev);
          } else if (payload.eventType === 'DELETE') {
            console.log('[Realtime] Deleting user:', payload.old.id);
            setUsers(prev => prev.filter(u => u.id !== payload.old.id));
            setCurrentUser(prev => prev && prev.id === payload.old.id ? null : prev);
          }
        } catch (e) {
          console.error('Realtime users handler error:', e);
        }
      })
      .subscribe((status: string) => {
        console.log('[Realtime] Subscription status:', status);
      });

    return () => {
      console.log('[Realtime] Cleaning up users subscription');
      try { channel.unsubscribe(); } catch (e) { console.error('[Realtime] Unsubscribe error:', e); }
    };
  }, []);

  // --- 辅助函数：更新本地 Course 统计 ---
  const recalculateCourseStats = (courses: Course[], sessions: Session[], courseId: string): Course[] => {
    return courses.map(c => {
      if (c.id !== courseId) return c;
      const courseSessions = sessions.filter(s => s.courseId === courseId);
      const totalHours = courseSessions.reduce((sum, s) => sum + (Number(s.durationHours) || 0), 0);
      
      // 自动计算开始和结束日期
      let startDate = c.startDate;
      let endDate = c.endDate;
      if (courseSessions.length > 0) {
        const dates = courseSessions.map(s => s.date).filter(Boolean).sort();
        startDate = dates[0];
        endDate = dates[dates.length - 1];
      }
      
      return {
        ...c,
        startDate,
        endDate,
        sessionCount: courseSessions.length,
        totalHours: parseFloat(totalHours.toFixed(2))
      };
    });
  };

  // --- 辅助函数：重新计算课节序号（按时间先后顺序）---
  const recalculateSequences = (sessions: Session[], courseId: string): Session[] => {
    // 先筛选出该课程的所有课节，按日期和时间排序
    const courseSessions = sessions
      .filter(s => s.courseId === courseId)
      .sort((a, b) => {
        const dateCompare = (a.date || '').localeCompare(b.date || '');
        if (dateCompare !== 0) return dateCompare;
        return (a.startTime || '').localeCompare(b.startTime || '');
      });
    
    // 创建一个映射，将id映射到新的序号
    const sequenceMap = new Map<string, number>();
    courseSessions.forEach((s, index) => {
      sequenceMap.set(s.id, index + 1);
    });
    
    // 更新所有课节的序号
    return sessions.map(s => {
      if (s.courseId !== courseId) return s;
      const newSequence = sequenceMap.get(s.id) || s.sequence;
      return { ...s, sequence: newSequence };
    });
  };

  // --- 辅助函数：同步某门课程的参课学生 ---
  const syncCourseAttendees = async (courseId: string, sessionsSnapshot?: Session[]) => {
    // Compute union of attendingStudentIds from all sessions for this course
    const allSessions = sessionsSnapshot || (state.sessions || []);
    const courseSessions = allSessions.filter(s => s.courseId === courseId);
    const union = Array.from(new Set(courseSessions.flatMap(s => Array.isArray((s as any).attendingStudentIds) ? (s as any).attendingStudentIds : [])));

    // Update local state optimistically
    setState(prev => ({ ...prev, courses: prev.courses.map(c => c.id === courseId ? { ...c, attendingStudentIds: union } : c) }));

    // Update course in DB
    try {
      const payload: any = { attendingStudentIds: union };
      const { error } = await supabase.from('courses').update(payload).eq('id', courseId);
      if (error) console.error('Update course attendingStudentIds failed:', error);
    } catch (e) {
      console.error('DB error updating course attendees:', e);
    }

    // Update students' participatingTraining field: add courseId to students in union, remove from students not in union
    try {
      const studentsList = state.students || [];
      // IDs currently containing the course
      const hadCourse = studentsList.filter(s => Array.isArray((s as any).participatingTraining) && (s as any).participatingTraining.includes(courseId)).map(s => s.id);

      const toAdd = union.filter(id => !hadCourse.includes(id));
      const toRemove = hadCourse.filter(id => !union.includes(id));

      // Add courseId to students in 'toAdd'
      for (const sid of toAdd) {
        const stud = studentsList.find(s => s.id === sid);
        if (!stud) continue;
        const newTraining = Array.isArray((stud as any).participatingTraining) ? [...(stud as any).participatingTraining, courseId] : [courseId];
        // Update local state
        setState(prev => ({ ...prev, students: prev.students?.map(s => s.id === sid ? { ...s, participatingTraining: newTraining } : s) }));
        // Update DB
        const { error } = await supabase.from('students').update({ participatingTraining: newTraining }).eq('id', sid);
        if (error) console.error('Failed to add participatingTraining for student', sid, error);
      }

      // Remove courseId from students in 'toRemove'
      for (const sid of toRemove) {
        const stud = studentsList.find(s => s.id === sid);
        if (!stud) continue;
        const newTraining = (stud as any).participatingTraining ? (stud as any).participatingTraining.filter((x: string) => x !== courseId) : [];
        setState(prev => ({ ...prev, students: prev.students?.map(s => s.id === sid ? { ...s, participatingTraining: newTraining } : s) }));
        const { error } = await supabase.from('students').update({ participatingTraining: newTraining }).eq('id', sid);
        if (error) console.error('Failed to remove participatingTraining for student', sid, error);
      }
    } catch (e) {
      console.error('Error syncing student participatingTraining:', e);
    }
  };

  // --- 人员管理 (Person) ---
  const addPerson = async (p: Person) => {
    // Optimistic Update
    if (p.type === 'Teacher') setState(prev => ({ ...prev, teachers: [...prev.teachers, p] }));
    else setState(prev => ({ ...prev, assistants: [...prev.assistants, p] }));
    
    // Cloud Update (Sanitized)
    const payload = sanitize(p, 'people');
    const { error } = await supabase.from('people').insert([payload]);
    if (error) console.error("Add Person Error:", error);
  };

  const updatePerson = async (p: Person) => {
    if (p.type === 'Teacher') setState(prev => ({ ...prev, teachers: prev.teachers.map(t => t.id === p.id ? p : t) }));
    else setState(prev => ({ ...prev, assistants: prev.assistants.map(a => a.id === p.id ? p : a) }));
    
    // Cloud Update (Sanitized)
    const payload = sanitize(p, 'people');
    const { id } = p; 
    // Delete ID from payload for update if Supabase dislikes updating PK (usually fine, but cleaner to remove)
    delete payload.id; 
    
    const { error } = await supabase.from('people').update(payload).eq('id', id);
    if (error) console.error("Update Person Error:", error);
  };

  const deletePerson = async (id: string) => {
    setState(prev => ({
      ...prev,
      teachers: prev.teachers.filter(t => t.id !== id),
      assistants: prev.assistants.filter(a => a.id !== id)
    }));
    const { error } = await supabase.from('people').delete().eq('id', id);
    if (error) console.error("Delete Person Error:", error);
  };

  // --- 学生管理 ---
  const addStudent = async (s: any) => {
    setState(prev => ({ ...prev, students: [...(prev.students || []), s] }));
    const payload = sanitize(s, 'students');
    const { error } = await supabase.from('students').insert([payload]);
    if (error) console.error('Add Student Error:', error);
  };

  const updateStudent = async (s: any) => {
    setState(prev => ({ ...prev, students: (prev.students || []).map(x => x.id === s.id ? s : x) }));
    const payload = sanitize(s, 'students');
    delete payload.id;
    const { error } = await supabase.from('students').update(payload).eq('id', s.id);
    if (error) console.error('Update Student Error:', error);
  };

  const deleteStudent = async (id: string) => {
    // Remove student id from any session / course attending lists
    setState(prev => ({
      ...prev,
      students: (prev.students || []).filter(x => x.id !== id),
      sessions: prev.sessions.map(s => ({ ...s, attendingStudentIds: Array.isArray((s as any).attendingStudentIds) ? (s as any).attendingStudentIds.filter((sid: string) => sid !== id) : [] })),
      courses: prev.courses.map(c => ({ ...c, attendingStudentIds: Array.isArray((c as any).attendingStudentIds) ? (c as any).attendingStudentIds.filter((sid: string) => sid !== id) : [] }))
    }));

    // DB update: delete student row
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) console.error('Delete Student Error:', error);
  };

  // --- 客户管理 ---
  const addClient = async (c: any) => {
    setState(prev => ({ ...prev, clients: [...(prev.clients || []), c] }));
    const payload = sanitize(c, 'clients');
    const { error } = await supabase.from('clients').insert([payload]);
    if (error) console.error('Add Client Error:', error);
  };

  const updateClient = async (c: any) => {
    setState(prev => ({ ...prev, clients: (prev.clients || []).map(x => x.id === c.id ? c : x) }));
    const payload = sanitize(c, 'clients');
    delete payload.id;
    const { error } = await supabase.from('clients').update(payload).eq('id', c.id);
    if (error) console.error('Update Client Error:', error);
  };

  const deleteClient = async (id: string) => {
    setState(prev => ({ ...prev, clients: (prev.clients || []).filter(x => x.id !== id) }));
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) console.error('Delete Client Error:', error);
  };

  // --- 学校管理 ---
  const addSchool = async (s: any) => {
    setState(prev => ({ ...prev, schools: [...(prev.schools || []), s] }));
    const payload = sanitize(s, 'schools');
    const { error } = await supabase.from('schools').insert([payload]);
    if (error) console.error('Add School Error:', error);
  };

  const updateSchool = async (s: any) => {
    setState(prev => ({ ...prev, schools: (prev.schools || []).map(x => x.id === s.id ? s : x) }));
    const payload = sanitize(s, 'schools');
    delete payload.id;
    const { error } = await supabase.from('schools').update(payload).eq('id', s.id);
    if (error) console.error('Update School Error:', error);
  };

  const deleteSchool = async (id: string) => {
    setState(prev => ({ ...prev, schools: (prev.schools || []).filter(x => x.id !== id) }));
    const { error } = await supabase.from('schools').delete().eq('id', id);
    if (error) console.error('Delete School Error:', error);
  };

  // --- 负责人日程管理 ---
  const loadOwnerSchedules = async () => {
    try {
      const { data, error } = await supabase.from('owner_schedules').select('*');
      if (!error && data) {
        setState(prev => ({ ...prev, ownerSchedules: data as OwnerSchedule[] }));
        console.log('[loadOwnerSchedules] Loaded schedules:', data.length);
      } else if (error) {
        console.error('[loadOwnerSchedules] Error:', error);
      }
    } catch (err) {
      console.error('[loadOwnerSchedules] Exception:', err);
    }
  };

  const addOwnerSchedule = async (s: OwnerSchedule) => {
    console.log('[addOwnerSchedule] Adding schedule:', s);
    
    // 乐观更新本地状态
    setState(prev => ({ ...prev, ownerSchedules: [...(prev.ownerSchedules || []), s] }));
    
    // 后台保存到数据库
    try {
      const payload = sanitize(s, 'owner_schedules');
      console.log('[addOwnerSchedule] Sanitized payload:', payload);
      const { data, error } = await supabase.from('owner_schedules').insert([payload]).select();
      if (error) {
        console.error('Add Owner Schedule Error:', error);
        alert('保存日程失败: ' + error.message);
        // 失败时回滚
        setState(prev => ({ ...prev, ownerSchedules: (prev.ownerSchedules || []).filter(x => x.id !== s.id) }));
      } else {
        console.log('[addOwnerSchedule] Successfully saved:', data);
      }
    } catch (err: any) {
      console.error('[addOwnerSchedule] Exception:', err);
      alert('保存日程失败: ' + (err.message || '未知错误'));
      // 失败时回滚
      setState(prev => ({ ...prev, ownerSchedules: (prev.ownerSchedules || []).filter(x => x.id !== s.id) }));
    }
  };

  const updateOwnerSchedule = async (s: OwnerSchedule) => {
    console.log('[updateOwnerSchedule] Updating schedule:', s);
    setState(prev => ({ ...prev, ownerSchedules: (prev.ownerSchedules || []).map(x => x.id === s.id ? s : x) }));
    const payload = sanitize(s, 'owner_schedules');
    delete payload.id;
    const { data, error } = await supabase.from('owner_schedules').update(payload).eq('id', s.id).select();
    if (error) {
      console.error('Update Owner Schedule Error:', error);
      alert('更新日程失败: ' + error.message);
    } else {
      console.log('[updateOwnerSchedule] Successfully updated:', data);
    }
  };

  const deleteOwnerSchedule = async (id: string) => {
    console.log('[deleteOwnerSchedule] Deleting schedule:', id);
    setState(prev => ({ ...prev, ownerSchedules: (prev.ownerSchedules || []).filter(x => x.id !== id) }));
    const { error } = await supabase.from('owner_schedules').delete().eq('id', id);
    if (error) {
      console.error('Delete Owner Schedule Error:', error);
      alert('删除日程失败: ' + error.message);
    } else {
      console.log('[deleteOwnerSchedule] Successfully deleted');
    }
  };

  // --- 课程管理 (Course) ---
  const addCourse = async (c: Course) => {
    // Optimistic local add
    setState(prev => ({ ...prev, courses: [...prev.courses, c] }));
    
    const payload = sanitize(c, 'courses');
    // Insert and request returned row to capture server defaults
    const { data, error } = await supabase.from('courses').insert([payload]).select('*');
    if (error) {
      console.error("Add Course Error:", error);
      return;
    }

    const created = Array.isArray(data) && data.length > 0 ? (data[0] as Course) : c;
    // Replace optimistic row with authoritative row
    setState(prev => ({ ...prev, courses: prev.courses.map(x => x.id === c.id ? created : x) }));

    // Trigger platform sync (non-blocking)
    try {
      const results = await import('./services/platformSync').then(m => m.syncCourse('create', created));
      if (results && results.length) {
        const now = new Date().toISOString();
        const platformMeta: Record<string, any> = {};
        results.forEach(r => { platformMeta[r.platform] = { ...r, lastSyncedAt: now }; });
        const { error: e2 } = await supabase.from('courses').update({ platform_meta: platformMeta }).eq('id', created.id);
        if (e2) console.error('Save platform_meta failed:', e2);
        else setState(prev => ({ ...prev, courses: prev.courses.map(x => x.id === created.id ? { ...x, platformMeta } : x) }));
      }
    } catch (e) {
      console.error('Platform sync (create course) error:', e);
    }
  };

  const updateCourse = async (c: Course) => {
    setState(prev => ({ ...prev, courses: prev.courses.map(x => x.id === c.id ? c : x) }));
    
    const payload = sanitize(c, 'courses');
    delete payload.id;
    const { data, error } = await supabase.from('courses').update(payload).eq('id', c.id).select('*');
    if (error) {
      console.error("Update Course Error:", error);
      return;
    }

    const updated = Array.isArray(data) && data.length > 0 ? (data[0] as Course) : c;

    // Trigger platform sync (non-blocking)
    try {
      const results = await import('./services/platformSync').then(m => m.syncCourse('update', updated));
      if (results && results.length) {
        const now = new Date().toISOString();
        const platformMeta: Record<string, any> = {};
        results.forEach(r => { platformMeta[r.platform] = { ...r, lastSyncedAt: now }; });
        const { error: e2 } = await supabase.from('courses').update({ platform_meta: platformMeta }).eq('id', updated.id);
        if (e2) console.error('Save platform_meta failed:', e2);
        else setState(prev => ({ ...prev, courses: prev.courses.map(x => x.id === updated.id ? { ...x, platformMeta } : x) }));
      }
    } catch (e) {
      console.error('Platform sync (update course) error:', e);
    }
  };
  
  const deleteCourse = async (id: string) => {
    setState(prev => ({ 
      ...prev, 
      courses: prev.courses.filter(x => x.id !== id),
      sessions: prev.sessions.filter(s => s.courseId !== id) 
    }));
    await supabase.from('sessions').delete().eq('courseId', id);
    const { error } = await supabase.from('courses').delete().eq('id', id);
    if (error) console.error("Delete Course Error:", error);
  };

  // --- 辅助函数：批量更新课程的所有课节序号到数据库 ---
  const syncSequencesToDB = async (courseId: string, sessions: Session[]) => {
    const courseSessions = sessions.filter(s => s.courseId === courseId);
    
    // 批量更新所有课节的序号
    for (const session of courseSessions) {
      const { error } = await supabase
        .from('sessions')
        .update({ sequence: session.sequence })
        .eq('id', session.id);
      
      if (error) {
        console.error(`Failed to update sequence for session ${session.id}:`, error);
      }
    }
  };

  // --- 辅助函数：重新计算所有课程的所有课节序号 ---
  const recalculateAllSequences = async () => {
    console.log('开始重新计算所有课节序号...');
    
    setState(prev => {
      let newSessions = [...prev.sessions];
      
      // 获取所有课程ID
      const allCourseIds = Array.from(new Set(prev.courses.map(c => c.id)));
      
      // 对每个课程重新计算序号
      allCourseIds.forEach(courseId => {
        newSessions = recalculateSequences(newSessions, courseId);
      });
      
      // 重新计算所有课程的统计信息
      const updatedCourses = prev.courses.map(c => {
        const courseSessions = newSessions.filter(s => s.courseId === c.id);
        const totalHours = courseSessions.reduce((sum, s) => sum + (Number(s.durationHours) || 0), 0);
        
        let startDate = c.startDate;
        let endDate = c.endDate;
        if (courseSessions.length > 0) {
          const dates = courseSessions.map(s => s.date).filter(Boolean).sort();
          startDate = dates[0];
          endDate = dates[dates.length - 1];
        }
        
        return {
          ...c,
          startDate,
          endDate,
          sessionCount: courseSessions.length,
          totalHours: parseFloat(totalHours.toFixed(2))
        };
      });
      
      return { ...prev, sessions: newSessions, courses: updatedCourses };
    });
    
    // 同步所有课节到数据库
    const allCourseIds = Array.from(new Set(state.courses.map(c => c.id)));
    for (const courseId of allCourseIds) {
      await syncSequencesToDB(courseId, state.sessions);
    }
    
    console.log('所有课节序号重新计算完成！');
  };

  // --- 课节管理 (Session) ---
  const addSession = async (s: Session) => {
    let updatedSession = s;
    
    setState(prev => {
      let newSessions = [...prev.sessions, s];
      // 重新计算该课程的所有课节序号
      newSessions = recalculateSequences(newSessions, s.courseId);
      // 在setState内部获取更新后的session
      updatedSession = newSessions.find(x => x.id === s.id) || s;
      const updatedCourses = recalculateCourseStats(prev.courses, newSessions, s.courseId);
      return { ...prev, sessions: newSessions, courses: updatedCourses };
    });
    
    const payload = sanitize(updatedSession, 'sessions');
    const { data, error } = await supabase.from('sessions').insert([payload]).select('*');
    if (error) {
      console.error("Add Session Error:", error);
      return;
    }

    const created = Array.isArray(data) && data.length > 0 ? (data[0] as Session) : updatedSession;
    // Replace optimistic session with authoritative one
    setState(prev => ({ ...prev, sessions: prev.sessions.map(x => x.id === s.id ? created : x) }));

    // Trigger platform sync (non-blocking)
    try {
      const results = await import('./services/platformSync').then(m => m.syncSession('create', created));
      if (results && results.length) {
        const now = new Date().toISOString();
        const platformMeta: Record<string, any> = {};
        results.forEach(r => { platformMeta[r.platform] = { ...r, lastSyncedAt: now }; });
        const { error: e2 } = await supabase.from('sessions').update({ platform_meta: platformMeta }).eq('id', created.id);
        if (e2) console.error('Save platform_meta failed:', e2);
        else setState(prev => ({ ...prev, sessions: prev.sessions.map(x => x.id === created.id ? { ...x, platformMeta } : x) }));
      }
    } catch (e) {
      console.error('Platform sync (create session) error:', e);
    }

    // 同步参课学生到课程与学生的参与字段
    await syncCourseAttendees(created.courseId);
    
    // 同步该课程所有课节的序号到数据库
    await syncSequencesToDB(created.courseId, state.sessions);

  };

  const updateSession = async (s: Session) => {
    // Capture previous session before state update so we can sync old course if needed
    const oldSession = state.sessions.find(x => x.id === s.id);
    let updatedSession = s;

    setState(prev => {
      let newSessions = prev.sessions.map(x => x.id === s.id ? s : x);
      // 重新计算该课程的所有课节序号
      newSessions = recalculateSequences(newSessions, s.courseId);
      // 如果课程ID改变了，也要重新计算旧课程的序号
      if (oldSession && oldSession.courseId !== s.courseId) {
        newSessions = recalculateSequences(newSessions, oldSession.courseId);
      }
      
      // 在setState内部获取更新后的session
      updatedSession = newSessions.find(x => x.id === s.id) || s;
      
      let updatedCourses = recalculateCourseStats(prev.courses, newSessions, s.courseId);
      if (oldSession && oldSession.courseId !== s.courseId) {
          updatedCourses = recalculateCourseStats(updatedCourses, newSessions, oldSession.courseId);
      }
      return { ...prev, sessions: newSessions, courses: updatedCourses };
    });
    
    const payload = sanitize(updatedSession, 'sessions');
    delete payload.id;
    const { data, error } = await supabase.from('sessions').update(payload).eq('id', s.id).select('*');
    if (error) {
      console.error("Update Session Error:", error);
      return;
    }

    const updated = Array.isArray(data) && data.length > 0 ? (data[0] as Session) : updatedSession;

    // Trigger platform sync (non-blocking)
    try {
      const results = await import('./services/platformSync').then(m => m.syncSession('update', updated));
      if (results && results.length) {
        const now = new Date().toISOString();
        const platformMeta: Record<string, any> = {};
        results.forEach(r => { platformMeta[r.platform] = { ...r, lastSyncedAt: now }; });
        const { error: e2 } = await supabase.from('sessions').update({ platform_meta: platformMeta }).eq('id', updated.id);
        if (e2) console.error('Save platform_meta failed:', e2);
        else setState(prev => ({ ...prev, sessions: prev.sessions.map(x => x.id === updated.id ? { ...x, platformMeta } : x) }));
      }
    } catch (e) {
      console.error('Platform sync (update session) error:', e);
    }

    // 同步参课学生到课程与学生的参与字段
    await syncCourseAttendees(updated.courseId || '');
    // 如果课程发生变更，也同步旧课程的参课学生
    if (oldSession && oldSession.courseId && oldSession.courseId !== updated.courseId) {
      await syncCourseAttendees(oldSession.courseId);
    }
    
    // 同步该课程所有课节的序号到数据库
    await syncSequencesToDB(updated.courseId, state.sessions);
    if (oldSession && oldSession.courseId && oldSession.courseId !== updated.courseId) {
      await syncSequencesToDB(oldSession.courseId, state.sessions);
    }
  };

  const deleteSession = async (id: string) => {
    // Find the session to delete before mutating state
    const sessionToDelete = state.sessions.find(s => s.id === id);

    setState(prev => {
      let newSessions = prev.sessions.filter(x => x.id !== id);
      let updatedCourses = prev.courses;
      if (sessionToDelete) {
         // 重新计算该课程的所有课节序号
         newSessions = recalculateSequences(newSessions, sessionToDelete.courseId);
         updatedCourses = recalculateCourseStats(prev.courses, newSessions, sessionToDelete.courseId);
      }
      return { ...prev, sessions: newSessions, courses: updatedCourses };
    });
    const { error } = await supabase.from('sessions').delete().eq('id', id);
    if (error) console.error("Delete Session Error:", error);

    // 同步参课学生
    if (sessionToDelete && sessionToDelete.courseId) {
      await syncCourseAttendees(sessionToDelete.courseId);
      // 同步该课程所有课节的序号到数据库
      await syncSequencesToDB(sessionToDelete.courseId, state.sessions);
    }
  };

  const updateScheduleParams = (params: Partial<ScheduleParams>) => {
      setState(prev => ({
          ...prev,
          scheduleParams: { ...prev.scheduleParams, ...params }
      }));
  }

  // --- 数据导入 (Batch) ---
  const importData = async (type: 'teachers' | 'assistants' | 'courses' | 'sessions' | 'students' | 'clients' | 'schools', data: any[], mode: 'append' | 'replace') => {
    // 1. 标准化数据结构
    const processedData = data.map(item => {
        const newItem: any = {
            ...item,
            id: item.id || crypto.randomUUID(),
        };

        // 处理数组字段，防止 CSV 导入时为空或格式错误
        if (type === 'courses' || type === 'sessions') {
            newItem.teacherIds = Array.isArray(item.teacherIds) ? item.teacherIds : (item.teacherIds ? [item.teacherIds] : []);
            newItem.assistantIds = Array.isArray(item.assistantIds) ? item.assistantIds : (item.assistantIds ? [item.assistantIds] : []);
        }

        // 确保特定字段类型正确
        if (type === 'sessions') {
             newItem.sequence = item.sequence ? Number(item.sequence) : 0;
             newItem.durationHours = item.durationHours ? Number(item.durationHours) : 0;
        }

        // 确保人员类型正确
        if (type === 'teachers') newItem.type = 'Teacher';
        if (type === 'assistants') newItem.type = 'TA';

        // Course 初始化统计字段 (仅用于本地显示，sanitize 会在发送前移除它们)
        if (type === 'courses') {
            newItem.sessionCount = 0;
            newItem.totalHours = 0;
        }

        return newItem;
    });

    let tableName = '';
    let schemaType: keyof typeof DB_SCHEMA;

    if (type === 'teachers' || type === 'assistants') {
        tableName = 'people';
        schemaType = 'people';
    } else if (type === 'courses') {
        tableName = 'courses';
        schemaType = 'courses';
    } else if (type === 'sessions') {
        tableName = 'sessions';
        schemaType = 'sessions';
    } else if (type === 'students') {
        tableName = 'students';
        schemaType = 'students';
    } else if (type === 'clients') {
        tableName = 'clients';
        schemaType = 'clients';
    } else if (type === 'schools') {
        tableName = 'schools';
        schemaType = 'schools';
    } else {
        tableName = 'sessions';
        schemaType = 'sessions';
    }

    // 2. 清洗数据：只保留白名单字段
    const sanitizedData = processedData.map(item => sanitize(item, schemaType));

    // 3. 更新本地 State (Optimistic)
    setState(prev => {
        let newState = { ...prev };
        
        if (type === 'teachers') {
             const newItems = processedData as Person[];
             if (mode === 'replace') newState.teachers = newItems;
             else newState.teachers = [...prev.teachers, ...newItems];
        } else if (type === 'assistants') {
             const newItems = processedData as Person[];
             if (mode === 'replace') newState.assistants = newItems;
             else newState.assistants = [...prev.assistants, ...newItems];
        } else if (type === 'courses') {
             const newItems = processedData as Course[];
             if (mode === 'replace') newState.courses = newItems;
             else newState.courses = [...prev.courses, ...newItems];
        } else if (type === 'sessions') {
             const newItems = processedData as Session[];
             if (mode === 'replace') newState.sessions = newItems;
             else newState.sessions = [...prev.sessions, ...newItems];
        } else if (type === 'students') {
             const newItems = processedData as any[];
             if (mode === 'replace') newState.students = newItems;
             else newState.students = [...(prev.students || []), ...newItems];
        } else if (type === 'clients') {
             const newItems = processedData as any[];
             if (mode === 'replace') newState.clients = newItems;
             else newState.clients = [...(prev.clients || []), ...newItems];
        } else if (type === 'schools') {
             const newItems = processedData as any[];
             if (mode === 'replace') newState.schools = newItems;
             else newState.schools = [...(prev.schools || []), ...newItems];
        }
        
        // 如果是导入 Sessions，重新计算 Course 统计和序号
        if (type === 'sessions') {
             // 重新计算所有涉及课程的序号
             const affectedCourseIds = Array.from(new Set(newState.sessions.map(s => s.courseId).filter(Boolean)));
             affectedCourseIds.forEach(courseId => {
               newState.sessions = recalculateSequences(newState.sessions, courseId);
             });
             
             newState.courses = newState.courses.map(c => {
                 const cSessions = newState.sessions.filter(s => s.courseId === c.id);
                 const totalHours = cSessions.reduce((sum, s) => sum + (Number(s.durationHours) || 0), 0);
                 
                 // 自动计算开始和结束日期
                 let startDate = c.startDate;
                 let endDate = c.endDate;
                 if (cSessions.length > 0) {
                   const dates = cSessions.map(s => s.date).filter(Boolean).sort();
                   startDate = dates[0];
                   endDate = dates[dates.length - 1];
                 }
                 
                 return { 
                   ...c, 
                   startDate,
                   endDate,
                   sessionCount: cSessions.length, 
                   totalHours: parseFloat(totalHours.toFixed(2)) 
                 };
             });
        }

        return newState;
    });

    // 如果是导入 Sessions，需要同步课程的参课学生信息
    if (type === 'sessions') {
        const affectedCourseIds = Array.from(new Set(processedData.map(p => p.courseId).filter(Boolean)));
        for (const cid of affectedCourseIds) {
            // call without waiting to avoid blocking large imports
            syncCourseAttendees(cid);
        }
    }

    // 4. 同步到云端
    try {
        if (mode === 'replace') {
            if (tableName === 'people') {
                const pType = type === 'teachers' ? 'Teacher' : 'TA';
                await supabase.from('people').delete().eq('type', pType);
            } else {
                // 删除所有记录 (不推荐在生产环境这样做，但符合当前需求)
                await supabase.from(tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000');
            }
        }

        // 分批插入防止请求体过大
        const BATCH_SIZE = 100;
        for (let i = 0; i < sanitizedData.length; i += BATCH_SIZE) {
            const batch = sanitizedData.slice(i, i + BATCH_SIZE);
            const { error } = await supabase.from(tableName).insert(batch);
            if (error) throw error;
        }
        
    } catch (error: any) {
        console.error("Cloud Sync Error (Import):", error);
        
        let msg = 'Unknown Error';
        if (typeof error === 'string') msg = error;
        else if (error instanceof Error) msg = error.message;
        else if (typeof error === 'object') msg = JSON.stringify(error);

        setTimeout(() => {
            alert(`已导入到本地视图，但云端同步失败 (可能是权限或网络问题): ${msg}`);
        }, 100);
    }
  };

  // 更新用户角色（仅供前端调用，实际权限依赖 Supabase RLS/后端）
  const updateUserRole = async (userId: string, role: Role) => {
    // Guard: only owner can change roles; prevent accidental calls from editors
    if (!currentUser || currentUser.role !== 'owner') {
      console.warn('updateUserRole requires owner privileges');
      return;
    }

    // Prevent owner from changing their own role (owner can change any other user including other owners)
    if (userId === currentUser.id) {
      console.warn('Owner cannot change their own role');
      alert('不能更改自己的角色。如需降级，请先让其他负责人修改。');
      return;
    }

    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) {
      console.warn('Target user not found for updateUserRole');
      return;
    }

    try {
      console.log('[updateUserRole] ===== START =====');
      console.log('[updateUserRole] User ID:', userId);
      console.log('[updateUserRole] New role:', role);
      console.log('[updateUserRole] Role type:', typeof role);
      console.log('[updateUserRole] Role value (JSON):', JSON.stringify(role));
      
      const inputPayload = { role };
      console.log('[updateUserRole] Input payload:', inputPayload);
      
      const payload = sanitize(inputPayload, 'users');
      console.log('[updateUserRole] Sanitized payload:', payload);
      console.log('[updateUserRole] Sanitized payload (JSON):', JSON.stringify(payload));
      
      // Return updated row to keep local cache consistent with DB
      console.log('[updateUserRole] Executing Supabase update...');
      const { data, error } = await supabase.from('users').update(payload).eq('id', userId).select('*').maybeSingle();
      
      if (error) {
        console.error('[updateUserRole] Supabase error:', error);
        console.error('[updateUserRole] Error details:', JSON.stringify(error, null, 2));
        throw error;
      }
      
      console.log('[updateUserRole] Update successful, returned data:', data);
      const updatedUser = (data as any) || { ...targetUser, role };
      setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
      // 如果 we changed currentUser (edge-case), update it too
      setCurrentUser(prev => prev && prev.id === userId ? updatedUser : prev);
      // Refresh users list to ensure consistency
      await refreshUsers();
    } catch (err) {
      console.error('updateUserRole error:', err);
      alert('修改用户权限失败: ' + (err as any).message);
    }
  };
  // Invite / create a user (owner-only)
  const inviteUser = async (email: string, name: string, role: Role = 'visitor', phone?: string) => {
    if (!currentUser || currentUser.role !== 'owner') {
      throw new Error('Only owner can invite users');
    }
    try {
      const payload = sanitize({ email, name, role, phone }, 'users');
      const { error } = await supabase.from('users').insert([payload]);
      if (error) throw error;
      // Refresh users list to ensure new user appears immediately
      await refreshUsers();
      return true;
    } catch (err: any) {
      console.error('inviteUser error:', err);
      throw err;
    }
  };
  return (
    <AppContext.Provider value={{
      ...state,
      users,
      currentUser,
      isEditor,
      updateUserRole,
      refreshUsers,
      addPerson, updatePerson, deletePerson,
      addCourse, updateCourse, deleteCourse,
      addSession, updateSession, deleteSession,
      addStudent, updateStudent, deleteStudent,
      addClient, updateClient, deleteClient,
      addSchool, updateSchool, deleteSchool,
      loadOwnerSchedules, addOwnerSchedule, updateOwnerSchedule, deleteOwnerSchedule,
      importData, updateScheduleParams,
      recalculateAllSequences,
      isLoading,
      profileLoading,
      inviteUser
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppStore = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppStore must be used within AppProvider");
  return context;
};