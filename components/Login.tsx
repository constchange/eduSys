import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { LogIn, Loader2, AlertTriangle } from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!isSupabaseConfigured) {
        setMessage({ text: 'Configuration Missing: Cannot connect to Supabase.', type: 'error' });
        setLoading(false);
        return;
    }

    try {
      if (mode === 'signup') {
        if (!name || name.trim().length === 0) {
          setMessage({ text: '请填写姓名', type: 'error' });
          setLoading(false);
          return;
        }
        if (!phone || phone.trim().length === 0) {
          setMessage({ text: '请填写手机号', type: 'error' });
          setLoading(false);
          return;
        }

        // 检查姓名唯一性（users 表）
        const nameCheck = await supabase.from('users').select('id').eq('name', name).maybeSingle();
        if (nameCheck && nameCheck.data) {
          setMessage({ text: '该姓名已被使用，请更换姓名', type: 'error' });
          setLoading(false);
          return;
        }

        // 检查手机号唯一性（users 表）
        const phoneCheck = await supabase.from('users').select('id').eq('phone', phone).maybeSingle();
        if (phoneCheck && phoneCheck.data) {
          setMessage({ text: '该手机号已被使用，请使用其他手机号', type: 'error' });
          setLoading(false);
          return;
        }
        // 获取当前页面的完整基础路径（去除 search 和 hash）
        // 例如：https://user.github.io/repo-name/
        // 修复：之前只用 origin 会导致跳回 https://user.github.io 根目录从而 404
        const redirectTo = window.location.origin + window.location.pathname;

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // 关键：告诉 Supabase 验证邮件后跳回当前网页，并把 name / phone 写入 auth metadata
            emailRedirectTo: redirectTo,
            data: { name, phone }
          }
        });
        if (error) throw error;

        // 如果 signUp 同时返回 session（自动确认或即时登录），我们可以写入 users.auth_id
        const role = name === '负责人' ? 'owner' : 'visitor';
        try {
          const authId = data?.user?.id ?? null;
          // 仅在存在 session 时写入带 auth_id 的用户记录；否则在用户验证并首次登录后由 store 同步插入
          if (authId && data?.session) {
            await supabase.from('users').insert([{ email, name, phone, role, auth_id: authId }]);
          }
        } catch (e) {
          // 可能由于 RLS 拒绝匿名插入，这里仅记录错误，后续 auth 完成后会同步
          console.error('Create users record failed (might be RLS):', e);
        }

        setMessage({ text: '注册确认邮件已发送！请前往邮箱（包括垃圾箱）查收，点击链接后刷新此页面或登录以完成资料同步。', type: 'success' });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        // 登录成功后，确保 users 表中该邮箱的记录包含当前 auth id（用于 RLS 匹配）
        try {
          const authUser = data?.user ?? (await supabase.auth.getUser()).data.user;
          const authId = authUser?.id;
          const metaName = (authUser as any)?.user_metadata?.name || email;
          const metaPhone = (authUser as any)?.user_metadata?.phone || null;
          if (authId) {
            // Use RPC to claim or create the users row (handles historical rows without auth_id), include phone metadata if available
            const rpc = await supabase.rpc('claim_or_create_user', { p_email: email, p_name: metaName, p_phone: metaPhone });
            // rpc returns an array of rows; we don't strictly need the returned value here
            // but we attempt a final fetch to confirm
            const { data: existing } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
            if (!existing) {
              // unexpected, but try direct insert (may be blocked by RLS)
              await supabase.from('users').insert([{ email, name: metaName, phone: metaPhone, role: 'visitor', auth_id: authId }]);
            }
          }
        } catch (e) {
          console.error('Ensure users.auth_id failed:', e);
        }
      }
    } catch (error: any) {
      let msg = error.message;
      if (msg === 'User already registered') msg = '该邮箱已被注册，请直接登录';
      if (msg === 'Invalid login credentials') msg = '邮箱或密码错误';
      setMessage({ text: msg || '发生错误', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative z-10">
        <div className="bg-indigo-600 p-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">启慧研习院</h1>
          <p className="text-indigo-100">EduSys Lite</p>
        </div>
        
        <div className="p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">
            {mode === 'signin' ? '账号登录' : '注册新账号'}
          </h2>

          {message && (
            <div className={`mb-4 p-3 rounded text-sm ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
              {message.text}
            </div>
          )}

          {!isSupabaseConfigured && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3 text-sm text-amber-800">
                <AlertTriangle className="shrink-0 mt-0.5" size={16} />
                <div>
                    <strong>Supabase 未配置</strong>
                    <p className="mt-1 opacity-90">请在环境变量中配置 <code>VITE_SUPABASE_URL</code> 和 <code>VITE_SUPABASE_KEY</code> 以使用系统。</p>
                </div>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">邮箱地址</label>
              <input 
                type="email" 
                required
                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {mode === 'signup' && (
              <>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">姓名（必须唯一）</label>
                <input
                  type="text"
                  required
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">手机号（必须唯一）</label>
                <input
                  type="tel"
                  required
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <div className="text-xs text-slate-400 mt-1">手机号仅用于与线上平台关联，不会进行短信验证。</div>
              </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">密码</label>
              <input 
                type="password" 
                required
                minLength={6}
                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            
            <button 
              type="submit" 
              disabled={loading || !isSupabaseConfigured}
              className={`w-full text-white py-2 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 ${
                  !isSupabaseConfigured ? 'bg-slate-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={20} />}
              {mode === 'signin' ? '登录' : '注册'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500 pb-4">
            {mode === 'signin' ? (
              <p>还没有账号？ <button onClick={() => setMode('signup')} className="text-indigo-600 font-bold hover:underline">去注册</button></p>
            ) : (
              <p>已有账号？ <button onClick={() => setMode('signin')} className="text-indigo-600 font-bold hover:underline">去登录</button></p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;