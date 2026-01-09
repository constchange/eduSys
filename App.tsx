import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { AppProvider, useAppStore } from './store.tsx';
import Login from './components/Login';
import PersonManager from './components/PersonManager';
import CourseManager from './components/CourseManager';
import SessionManager from './components/SessionManager';
import ScheduleStats from './components/ScheduleStats';
import AdminPanel from './components/AdminPanel';
import StudentManager from './components/StudentManager';
import ClientManager from './components/ClientManager';
import SchoolManager from './components/SchoolManager';
import { Users, GraduationCap, BookOpen, Clock, Calendar, LogOut, Loader2, User, MapPin } from 'lucide-react';

type Tab = 'teachers' | 'assistants' | 'courses' | 'sessions' | 'schedule' | 'admin' | 'students' | 'clients' | 'schools';

// 内部组件：主界面
const Dashboard: React.FC<{ session: any; onLogout: () => void }> = ({ session, onLogout }) => {
  const [activeTab, setActiveTab] = useState<Tab>('teachers');
  const { isLoading, profileLoading, currentUser } = useAppStore();

  if (profileLoading) {
    return (
      <div className="h-screen w-screen bg-slate-900 flex flex-col gap-4 items-center justify-center text-white">
        <Loader2 className="animate-spin text-indigo-500" size={48} />
        <div className="text-slate-400 text-sm font-medium">加载权限信息…</div>
      </div>
    );
  }

  const navItems = [
    { id: 'teachers', label: 'Teachers', icon: Users },
    { id: 'assistants', label: 'Teaching Assistants', icon: GraduationCap },
    { id: 'courses', label: 'Courses', icon: BookOpen },
    { id: 'sessions', label: 'Sessions', icon: Clock },
    { id: 'schedule', label: 'Schedule & Stats', icon: Calendar },
    // New pages
    { id: 'students', label: 'Students', icon: Users },
    { id: 'clients', label: 'Clients', icon: User },
    { id: 'schools', label: 'Schools', icon: MapPin }
  ];

  // 如果是负责人，允许访问用户管理
  const showAdmin = currentUser && currentUser.role === 'owner';
  const isEditor = currentUser && currentUser.role === 'editor';

  return (
      // 如果当前用户未设置 profile 或为游客，显示无权限提示
      <div className="flex h-screen bg-slate-100 text-slate-800 font-sans">
        {(!currentUser || currentUser.role === 'visitor') ? (
          <div className="m-auto text-center">
            <div className="text-2xl font-bold mb-2">无访问权限</div>
            <div className="text-sm text-slate-600 mb-6">您的账号当前是游客或尚未完成资料，无法查看应用内容。</div>
            <div className="flex items-center justify-center gap-3">
              <button onClick={onLogout} className="px-4 py-2 bg-indigo-600 text-white rounded">登出</button>
            </div>
          </div>
        ) : (
        <div className="flex h-screen bg-slate-100 text-slate-800 font-sans">
        {/* Sidebar */}
        <aside className="w-64 bg-slate-900 text-white flex flex-col flex-shrink-0 transition-all">
          <div className="p-6 border-b border-slate-800">
            <h1 className="text-xl font-bold tracking-tight">EduSys Lite</h1>
            <p className="text-xs text-slate-400 mt-1">Cloud Edition</p>
          </div>
          
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as Tab)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeTab === item.id 
                      ? 'bg-indigo-600 text-white shadow-lg' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
            {showAdmin && (
              <button
                onClick={() => setActiveTab('admin' as Tab)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'admin' 
                    ? 'bg-indigo-600 text-white shadow-lg' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Users size={20} />
                <span className="font-medium">User Management</span>
              </button>
            )}
            {isEditor && (
              <div className="p-3 text-xs text-slate-400">您是编辑人，除用户管理外拥有全部权限</div>
            )}
          </nav>
          
          <div className="p-4 border-t border-slate-800">
             <div className="text-xs text-slate-500 mb-2 truncate" title={session.user.email}>{session.user.email}</div>
             <button onClick={onLogout} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm w-full transition-colors">
                <LogOut size={16} /> Sign Out
             </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8 overflow-hidden h-full relative">
          {isLoading && (
              <div className="absolute top-4 right-8 z-50 bg-white/80 backdrop-blur px-3 py-1 rounded-full shadow-sm text-xs text-indigo-600 flex items-center gap-2 border border-indigo-100">
                  <Loader2 className="animate-spin" size={12} /> Syncing Data...
              </div>
          )}
          <div className="h-full max-w-7xl mx-auto">
            {activeTab === 'teachers' && <PersonManager type="Teacher" />}
            {activeTab === 'assistants' && <PersonManager type="TA" />}
            {activeTab === 'courses' && <CourseManager />}
            {activeTab === 'sessions' && <SessionManager />}
            {activeTab === 'schedule' && <ScheduleStats />}
            {activeTab === 'students' && <StudentManager />}
            {activeTab === 'clients' && <ClientManager />}
            {activeTab === 'schools' && <SchoolManager />}
            {activeTab === 'admin' && <AdminPanel />}
          </div>
        </main>
        </div>
        )}
      </div>
  );
};

// 根组件：处理 Auth 状态
const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    // 1. 检查当前是否已登录
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setCheckingAuth(false);
    }).catch((err) => {
        // Handle initialization error (e.g. network error if config is missing)
        console.warn("Auth initialization failed:", err);
        setCheckingAuth(false);
    });

    // 2. 监听登录/登出变化
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (checkingAuth) {
      return (
        <div className="h-screen w-screen bg-slate-900 flex flex-col gap-4 items-center justify-center text-white">
            <Loader2 className="animate-spin text-indigo-500" size={48} />
            <div className="text-slate-400 text-sm font-medium">Initializing EduTrack...</div>
        </div>
      );
  }

  // 如果没有 session，强制显示登录页
  if (!session) {
    return <Login />;
  }

  return (
    <AppProvider>
      <Dashboard 
        session={session} 
        onLogout={handleLogout}
      />
    </AppProvider>
  );
};

export default App;