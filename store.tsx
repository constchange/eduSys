import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { AppState, Course, Person, Session, ScheduleParams, UserRecord, Role } from './types';

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
    'teacherIds', 'assistantIds', 'notes'
    // 注意：sessionCount 和 totalHours 是前端计算属性，不存数据库，所以不写在这里
  ],
  sessions: [
    'id', 'courseId', 'sequence', 'topic', 
    'teacherIds', 'assistantIds', 
    'date', 'startTime', 'endTime', 'durationHours', 
    'notes'
  ]
  ,
  // 用户表：用于权限管理（与 Auth 整合）
  users: ['id', 'email', 'name', 'phone', 'role']
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
  importData: (type: 'teachers' | 'assistants' | 'courses' | 'sessions', data: any[], mode: 'append' | 'replace') => void;
  updateScheduleParams: (params: Partial<ScheduleParams>) => void;
  isLoading: boolean;
  profileLoading: boolean;
  users: UserRecord[];
  currentUser: UserRecord | null;
  isEditor: boolean;
  updateUserRole: (userId: string, role: Role) => Promise<void>;
  inviteUser: (email: string, name: string, role?: Role, phone?: string) => Promise<boolean>;
  updateUser: (u: Partial<UserRecord> & { id: string }) => Promise<void>;
  // 新增：用于手动保存平台同步元信息
  setCoursePlatformMeta: (courseId: string, platformMeta: Record<string, any>) => void;
  setSessionPlatformMeta: (sessionId: string, platformMeta: Record<string, any>) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const initialState: AppState = {
  teachers: [],
  assistants: [],
  courses: [],
  sessions: [],
  scheduleParams: {
    startMonth: new Date().toISOString().slice(0, 7),
    endMonth: '',
    selectedPersonId: ''
  }
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(initialState);
  const [isLoading, setIsLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const isEditor = !!(currentUser && currentUser.role === 'editor');

  // --- 初始化加载数据 (READ) ---
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const peopleRes = await supabase.from('people').select('*');
        const usersRes = await supabase.from('users').select('*');
        const coursesRes = await supabase.from('courses').select('*');
        const sessionsRes = await supabase.from('sessions').select('*');

        const people = (peopleRes.data as Person[]) || [];
        const usersList = (usersRes.data as UserRecord[]) || [];
        const coursesRaw = (coursesRes.data as Course[]) || [];
        const sessions = (sessionsRes.data as Session[]) || [];

        // 前端计算统计数据
        const courses = coursesRaw.map(c => {
             const cSessions = sessions.filter(s => s.courseId === c.id);
             const totalHours = cSessions.reduce((sum, s) => sum + (Number(s.durationHours) || 0), 0);
             // normalize platform_meta (DB) to platformMeta (frontend)
             const platformMeta = (c as any).platform_meta ? (c as any).platform_meta : undefined;
             return {
                 ...c,
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
          sessions: sessions
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
    const setProfileFromAuth = async () => {
      setProfileLoading(true);
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
        setProfileLoading(false);
      }
    };

    setProfileFromAuth();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setProfileFromAuth();
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // --- 辅助函数：更新本地 Course 统计 ---
  const recalculateCourseStats = (courses: Course[], sessions: Session[], courseId: string): Course[] => {
    return courses.map(c => {
      if (c.id !== courseId) return c;
      const courseSessions = sessions.filter(s => s.courseId === courseId);
      const totalHours = courseSessions.reduce((sum, s) => sum + (Number(s.durationHours) || 0), 0);
      return {
        ...c,
        sessionCount: courseSessions.length,
        totalHours: parseFloat(totalHours.toFixed(2))
      };
    });
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
        const platformMeta: Record<string, any> = {};
        results.forEach(r => { platformMeta[r.platform] = r; });
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
        const platformMeta: Record<string, any> = {};
        results.forEach(r => { platformMeta[r.platform] = r; });
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

  // --- 课节管理 (Session) ---
  const addSession = async (s: Session) => {
    setState(prev => {
      const newSessions = [...prev.sessions, s];
      const updatedCourses = recalculateCourseStats(prev.courses, newSessions, s.courseId);
      return { ...prev, sessions: newSessions, courses: updatedCourses };
    });
    
    const payload = sanitize(s, 'sessions');
    const { data, error } = await supabase.from('sessions').insert([payload]).select('*');
    if (error) {
      console.error("Add Session Error:", error);
      return;
    }

    const created = Array.isArray(data) && data.length > 0 ? (data[0] as Session) : s;
    // Replace optimistic session with authoritative one
    setState(prev => ({ ...prev, sessions: prev.sessions.map(x => x.id === s.id ? created : x) }));

    // Trigger platform sync (non-blocking)
    try {
      const results = await import('./services/platformSync').then(m => m.syncSession('create', created));
      if (results && results.length) {
        const platformMeta: Record<string, any> = {};
        results.forEach(r => { platformMeta[r.platform] = r; });
        const { error: e2 } = await supabase.from('sessions').update({ platform_meta: platformMeta }).eq('id', created.id);
        if (e2) console.error('Save platform_meta failed:', e2);
        else setState(prev => ({ ...prev, sessions: prev.sessions.map(x => x.id === created.id ? { ...x, platformMeta } : x) }));
      }
    } catch (e) {
      console.error('Platform sync (create session) error:', e);
    }
  };

  const updateSession = async (s: Session) => {
    setState(prev => {
      const oldSession = prev.sessions.find(x => x.id === s.id);
      const newSessions = prev.sessions.map(x => x.id === s.id ? s : x);
      let updatedCourses = recalculateCourseStats(prev.courses, newSessions, s.courseId);
      if (oldSession && oldSession.courseId !== s.courseId) {
          updatedCourses = recalculateCourseStats(updatedCourses, newSessions, oldSession.courseId);
      }
      return { ...prev, sessions: newSessions, courses: updatedCourses };
    });
    
    const payload = sanitize(s, 'sessions');
    delete payload.id;
    const { data, error } = await supabase.from('sessions').update(payload).eq('id', s.id).select('*');
    if (error) {
      console.error("Update Session Error:", error);
      return;
    }

    const updated = Array.isArray(data) && data.length > 0 ? (data[0] as Session) : s;

    // Trigger platform sync (non-blocking)
    try {
      const results = await import('./services/platformSync').then(m => m.syncSession('update', updated));
      if (results && results.length) {
        const platformMeta: Record<string, any> = {};
        results.forEach(r => { platformMeta[r.platform] = r; });
        const { error: e2 } = await supabase.from('sessions').update({ platform_meta: platformMeta }).eq('id', updated.id);
        if (e2) console.error('Save platform_meta failed:', e2);
        else setState(prev => ({ ...prev, sessions: prev.sessions.map(x => x.id === updated.id ? { ...x, platformMeta } : x) }));
      }
    } catch (e) {
      console.error('Platform sync (update session) error:', e);
    }
  };

  const deleteSession = async (id: string) => {
    setState(prev => {
      const sessionToDelete = prev.sessions.find(s => s.id === id);
      const newSessions = prev.sessions.filter(x => x.id !== id);
      let updatedCourses = prev.courses;
      if (sessionToDelete) {
         updatedCourses = recalculateCourseStats(prev.courses, newSessions, sessionToDelete.courseId);
      }
      return { ...prev, sessions: newSessions, courses: updatedCourses };
    });
    const { error } = await supabase.from('sessions').delete().eq('id', id);
    if (error) console.error("Delete Session Error:", error);
  };

  const updateScheduleParams = (params: Partial<ScheduleParams>) => {
      setState(prev => ({
          ...prev,
          scheduleParams: { ...prev.scheduleParams, ...params }
      }));
  }

  // Persist platform_meta for a course (used by manual resync UI)
  const setCoursePlatformMeta = async (courseId: string, platformMeta: Record<string, any>) => {
    try {
      const { error } = await supabase.from('courses').update({ platform_meta: platformMeta }).eq('id', courseId);
      if (error) {
        console.error('setCoursePlatformMeta error:', error);
        return;
      }
      setState(prev => ({ ...prev, courses: prev.courses.map(c => c.id === courseId ? { ...c, platformMeta } : c) }));
    } catch (e) {
      console.error('setCoursePlatformMeta exception:', e);
    }
  };

  // Persist platform_meta for a session (used by manual resync UI)
  const setSessionPlatformMeta = async (sessionId: string, platformMeta: Record<string, any>) => {
    try {
      const { error } = await supabase.from('sessions').update({ platform_meta: platformMeta }).eq('id', sessionId);
      if (error) {
        console.error('setSessionPlatformMeta error:', error);
        return;
      }
      setState(prev => ({ ...prev, sessions: prev.sessions.map(s => s.id === sessionId ? { ...s, platformMeta } : s) }));
    } catch (e) {
      console.error('setSessionPlatformMeta exception:', e);
    }
  };


  // --- 数据导入 (Batch) ---
  const importData = async (type: 'teachers' | 'assistants' | 'courses' | 'sessions', data: any[], mode: 'append' | 'replace') => {
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
        }
        
        // 如果是导入 Sessions，重新计算 Course 统计
        if (type === 'sessions') {
             newState.courses = newState.courses.map(c => {
                 const cSessions = newState.sessions.filter(s => s.courseId === c.id);
                 const totalHours = cSessions.reduce((sum, s) => sum + (Number(s.durationHours) || 0), 0);
                 return { ...c, sessionCount: cSessions.length, totalHours: parseFloat(totalHours.toFixed(2)) };
             });
        }

        return newState;
    });

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

    try {
      const payload = sanitize({ role }, 'users');
      const { error } = await supabase.from('users').update(payload).eq('id', userId);
      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
      // 如果 we changed currentUser, update it too
      setCurrentUser(prev => prev && prev.id === userId ? { ...prev, role } : prev);
    } catch (err) {
      console.error('updateUserRole error:', err);
    }
  };

  // 通用更新用户（用于修改 phone / name / role）
  const updateUser = async (u: Partial<UserRecord> & { id: string }) => {
    if (!currentUser || currentUser.role !== 'owner') {
      console.warn('updateUser requires owner privileges');
      return;
    }

    try {
      const payload = sanitize(u, 'users');
      delete (payload as any).id;
      const { error } = await supabase.from('users').update(payload).eq('id', u.id);
      if (error) {
        console.error('updateUser error:', error);
        throw error;
      }
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, ...u } as UserRecord : x));
      if (currentUser && currentUser.id === u.id) {
        setCurrentUser(prev => prev ? { ...prev, ...u } as UserRecord : prev);
      }
    } catch (err) {
      console.error('updateUser exception', err);
      throw err;
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
      const usersFetch = await supabase.from('users').select('*');
      setUsers((usersFetch.data as UserRecord[]) || []);
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
      addPerson, updatePerson, deletePerson,
      addCourse, updateCourse, deleteCourse,
      addSession, updateSession, deleteSession,
      importData, updateScheduleParams,
      isLoading,
      profileLoading,
      setCoursePlatformMeta, setSessionPlatformMeta,
      inviteUser,
      updateUser
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