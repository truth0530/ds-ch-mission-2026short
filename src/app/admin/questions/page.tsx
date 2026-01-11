'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Lazy client initialization to prevent build-time crashes
let sbClientInstance: any = null;
const getSbClient = () => {
    if (!sbClientInstance && SB_URL && SB_KEY) {
        sbClientInstance = createClient(SB_URL, SB_KEY);
    }
    return sbClientInstance;
};

interface Question {
    id: string;
    role: string;
    type: 'scale' | 'text' | 'multi_select';
    question_text: string;
    options: string[] | null;
    sort_order: number;
    is_hidden: boolean;
}

interface AdminUser {
    email: string;
    created_at: string;
    added_by: string;
}

export default function AdminQuestionsPage() {
    const [activeTab, setActiveTab] = useState<'questions' | 'admins'>('questions');
    const [questions, setQuestions] = useState<Question[]>([]);
    const [admins, setAdmins] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [authLoading, setAuthLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [isAuthorized, setIsAuthorized] = useState(false);

    // Question Edit State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Question>>({});

    // Admin Add State
    const [newAdminEmail, setNewAdminEmail] = useState('');

    useEffect(() => {
        const client = getSbClient();
        if (!client) {
            setAuthLoading(false);
            return;
        }

        checkUser(client);
        const { data: authListener } = client.auth.onAuthStateChange((_event: any, session: any) => {
            if (session?.user) checkAuthorization(client, session.user);
            else { setUser(null); setIsAuthorized(false); }
        });
        return () => { authListener.subscription.unsubscribe(); };
    }, []);

    const checkUser = async (client: any) => {
        setAuthLoading(true);
        const { data: { session } } = await client.auth.getSession();
        if (session?.user) {
            await checkAuthorization(client, session.user);
        } else {
            setAuthLoading(false);
        }
    };

    const checkAuthorization = async (client: any, currentUser: any) => {
        const { data, error } = await client
            .from('admin_users')
            .select('*')
            .eq('email', currentUser.email)
            .single();

        if (data || currentUser.email === 'truth0530@gmail.com') {
            setUser(currentUser);
            setIsAuthorized(true);
            fetchQuestions();
            fetchAdmins();
        } else {
            console.warn('Unauthorized email:', currentUser.email);
            setIsAuthorized(false);
            setUser(currentUser);
        }
        setAuthLoading(false);
    };

    const handleLogin = async () => {
        const client = getSbClient();
        if (!client) return;
        const { error } = await client.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/admin/questions`
            }
        });
        if (error) alert('로그인 중 오류: ' + error.message);
    };

    const handleLogout = async () => {
        const client = getSbClient();
        if (!client) return;
        await client.auth.signOut();
        window.location.reload();
    };

    const fetchQuestions = async () => {
        const client = getSbClient();
        if (!client) return;
        setLoading(true);
        const { data, error } = await client
            .from('survey_questions')
            .select('*')
            .order('sort_order', { ascending: true });

        if (!error) setQuestions(data || []);
        setLoading(false);
    };

    const fetchAdmins = async () => {
        const client = getSbClient();
        if (!client) return;
        const { data, error } = await client
            .from('admin_users')
            .select('*')
            .order('created_at', { ascending: false });
        if (!error) setAdmins(data || []);
    };

    const handleSaveQuestion = async (id: string) => {
        const client = getSbClient();
        if (!client) return;
        const { error } = await client
            .from('survey_questions')
            .update(editForm)
            .eq('id', id);

        if (error) alert('저장 실패: ' + error.message);
        else { setEditingId(null); fetchQuestions(); }
    };

    const handleToggleHidden = async (q: Question) => {
        const client = getSbClient();
        if (!client) return;
        const { error } = await client
            .from('survey_questions')
            .update({ is_hidden: !q.is_hidden })
            .eq('id', q.id);
        if (!error) fetchQuestions();
    };

    const handleAddQuestion = async () => {
        const client = getSbClient();
        if (!client) return;
        const newId = `new_${Date.now()}`;
        const { error } = await client
            .from('survey_questions')
            .insert([{
                id: newId,
                role: 'common',
                type: 'text',
                question_text: '새로운 문항을 입력하세요',
                sort_order: (questions.length > 0 ? Math.max(...questions.map(q => q.sort_order)) : 0) + 10,
                is_hidden: false
            }]);
        if (!error) { setEditingId(newId); setEditForm({ question_text: '새로운 문항을 입력하세요', role: 'common', type: 'text' }); fetchQuestions(); }
    };

    const handleDeleteQuestion = async (id: string) => {
        const client = getSbClient();
        if (!client) return;
        if (!confirm('문항을 삭제하시겠습니까?')) return;
        const { error } = await client.from('survey_questions').delete().eq('id', id);
        if (!error) fetchQuestions();
    };

    const handleAddAdmin = async () => {
        const client = getSbClient();
        if (!client || !newAdminEmail) return;
        const { error } = await client
            .from('admin_users')
            .insert([{ email: newAdminEmail, added_by: user.email }]);

        if (error) alert('관리자 추가 실패: ' + error.message);
        else { setNewAdminEmail(''); fetchAdmins(); }
    };

    const handleDeleteAdmin = async (email: string) => {
        const client = getSbClient();
        if (!client) return;
        if (email === user.email) { alert('자기 자신은 삭제할 수 없습니다.'); return; }
        if (!confirm(`${email} 관리자를 권한 해제하시겠습니까?`)) return;
        const { error } = await client.from('admin_users').delete().eq('email', email);
        if (error) alert('삭제 실패: ' + error.message);
        else fetchAdmins();
    };

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-white">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!isAuthorized) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
                <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-sm text-center border border-gray-100">
                    <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-black mb-2 text-gray-900">ADMIN ACCESS</h1>
                    <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                        {user ? `${user.email}은 승인되지 않은 계정입니다.` : '관리자 권한이 있는 구글 계정으로 로그인해 주세요.'}
                    </p>

                    {!user ? (
                        <button
                            onClick={handleLogin}
                            className="w-full py-4 bg-white border-2 border-gray-100 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-gray-50 hover:border-gray-200 active:scale-95 transition-all shadow-sm group"
                        >
                            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="" />
                            <span className="text-gray-700">Sign in with Google</span>
                        </button>
                    ) : (
                        <button
                            onClick={handleLogout}
                            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black active:scale-95 transition-all"
                        >
                            다른 계정으로 로그인
                        </button>
                    )}
                    <p className="mt-8 text-xs text-gray-400 font-medium">© 2026 DS Mission Survey System</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            {/* Nav */}
            <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 px-6 py-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <div className="flex flex-col">
                            <span className="text-sm font-black text-gray-900 leading-tight">ADMIN DASHBOARD</span>
                            <span className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">{activeTab} mode</span>
                        </div>
                        <div className="hidden md:flex items-center gap-1 bg-gray-50 p-1 rounded-xl">
                            <button
                                onClick={() => setActiveTab('questions')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'questions' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                문항 관리
                            </button>
                            <button
                                onClick={() => setActiveTab('admins')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'admins' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                관리자 설정
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex flex-col items-end mr-2">
                            <span className="text-xs font-bold text-gray-900">{user.email}</span>
                            <span className="text-[10px] text-gray-400">Authorized Admin</span>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:text-red-500 hover:bg-red-50 transition-all border border-gray-100"
                            title="로그아웃"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        </button>
                    </div>
                </div>
            </nav>

            <div className="max-w-6xl mx-auto p-6 lg:p-10">
                {activeTab === 'questions' ? (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-200 pb-8">
                            <div>
                                <h1 className="text-4xl font-black text-gray-900">Survey Questions</h1>
                                <p className="text-gray-500 mt-2 font-medium">관리자 전용 설문 문항 제어 센터입니다.</p>
                            </div>
                            <button
                                onClick={handleAddQuestion}
                                className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 active:scale-95 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                Add New Question
                            </button>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center py-40">
                                <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-10">
                                {['missionary', 'leader', 'team_member', 'common'].map(role => {
                                    const roleQs = questions.filter(q => q.role === role);
                                    if (roleQs.length === 0 && role !== 'common') return null;

                                    return (
                                        <div key={role} className="group">
                                            <div className="flex items-center gap-4 mb-6">
                                                <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">
                                                    {role === 'missionary' ? 'Missionary' : role === 'leader' ? 'Leader' : role === 'team_member' ? 'Team' : 'Common'}
                                                </h2>
                                                <div className="h-px flex-1 bg-gray-100 group-hover:bg-blue-100 transition-colors"></div>
                                                <span className="text-xs font-bold text-gray-300 group-hover:text-blue-400 transition-colors">{roleQs.length} items</span>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {roleQs.map(q => (
                                                    <div key={q.id} className={`bg-white rounded-3xl p-6 border-2 transition-all ${q.is_hidden ? 'opacity-40 grayscale' : 'hover:border-blue-500/10 hover:shadow-2xl hover:shadow-blue-500/5'}`}>
                                                        {editingId === q.id ? (
                                                            <div className="space-y-5 animate-in zoom-in-95 duration-200">
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} className="bg-gray-50 border-none rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all">
                                                                        <option value="missionary">Missionary</option>
                                                                        <option value="leader">Leader</option>
                                                                        <option value="team_member">Team</option>
                                                                        <option value="common">Common</option>
                                                                    </select>
                                                                    <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value as any })} className="bg-gray-50 border-none rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all">
                                                                        <option value="scale">Scale</option>
                                                                        <option value="text">Text</option>
                                                                        <option value="multi_select">Multi-Select</option>
                                                                    </select>
                                                                </div>
                                                                <textarea value={editForm.question_text} onChange={e => setEditForm({ ...editForm, question_text: e.target.value })} className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-blue-500 min-h-[100px]" />
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <button onClick={() => setEditingId(null)} className="px-4 py-2 text-sm font-bold text-gray-400 hover:text-gray-600">취소</button>
                                                                    <button onClick={() => handleSaveQuestion(q.id)} className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-black shadow-lg shadow-blue-100">저장</button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col h-full justify-between gap-6">
                                                                <div>
                                                                    <div className="flex items-center gap-2 mb-4">
                                                                        <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md tracking-widest ${q.type === 'scale' ? 'bg-amber-100 text-amber-700' : q.type === 'text' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                                                            {q.type}
                                                                        </span>
                                                                        <span className="text-[9px] font-mono font-bold text-gray-300">#{q.id}</span>
                                                                    </div>
                                                                    <p className="text-gray-800 font-bold leading-relaxed">{q.question_text}</p>
                                                                </div>
                                                                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                                                                    <button onClick={() => handleToggleHidden(q)} className={`text-xs font-black uppercase tracking-widest ${q.is_hidden ? 'text-blue-500' : 'text-gray-300 hover:text-gray-500'}`}>
                                                                        {q.is_hidden ? 'Show' : 'Hide'}
                                                                    </button>
                                                                    <div className="flex items-center gap-3">
                                                                        <button onClick={() => { setEditingId(q.id); setEditForm(q); }} className="text-xs font-black text-gray-300 hover:text-blue-600 transition-colors uppercase tracking-widest">Edit</button>
                                                                        <button onClick={() => handleDeleteQuestion(q.id)} className="text-xs font-black text-gray-200 hover:text-red-500 transition-colors uppercase tracking-widest">Del</button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                            <div>
                                <h1 className="text-4xl font-black text-gray-900 tracking-tighter uppercase">Authorized Admins</h1>
                                <p className="text-gray-500 mt-2 font-medium">관리자 자격이 있는 구글 계정을 관리합니다.</p>
                            </div>
                            <div className="flex items-center gap-2 bg-white p-2 rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100">
                                <input
                                    type="email"
                                    placeholder="Add Gmail Address"
                                    className="border-none bg-transparent px-4 py-2 font-bold text-sm focus:ring-0 w-60"
                                    value={newAdminEmail}
                                    onChange={e => setNewAdminEmail(e.target.value)}
                                />
                                <button
                                    onClick={handleAddAdmin}
                                    className="bg-gray-900 text-white p-2.5 rounded-xl hover:bg-black transition-all"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                </button>
                            </div>
                        </div>

                        <div className="bg-white rounded-[40px] shadow-2xl shadow-gray-200/40 border border-gray-100 overflow-hidden">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Email Address</th>
                                        <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Added When</th>
                                        <th className="px-8 py-6 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {admins.map(admin => (
                                        <tr key={admin.email} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 font-black text-xs">
                                                        {admin.email[0].toUpperCase()}
                                                    </div>
                                                    <span className="font-bold text-gray-900">{admin.email}</span>
                                                    {admin.email === user.email && (
                                                        <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-black uppercase">You</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className="text-xs font-bold text-gray-400">{new Date(admin.created_at).toLocaleDateString()}</span>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <button
                                                    onClick={() => handleDeleteAdmin(admin.email)}
                                                    className={`text-xs font-black uppercase tracking-widest py-2 px-4 rounded-xl transition-all ${admin.email === user.email ? 'text-gray-200 cursor-not-allowed' : 'text-red-300 hover:text-red-600 hover:bg-red-50'}`}
                                                >
                                                    Revoke
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
