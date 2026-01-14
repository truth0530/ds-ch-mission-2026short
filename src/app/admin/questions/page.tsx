'use client';

import { useState, useEffect } from 'react';
import { getSbClient } from '@/lib/supabase';
import { INITIAL_QUESTIONS, Question, MISSION_TEAMS, TeamInfo } from '@/lib/surveyData';
import { QuestionType } from '@/types';
import { ENV_CONFIG, TABLES } from '@/lib/constants';
import { isValidEmail, generateId } from '@/lib/validators';
import { User } from '@supabase/supabase-js';

interface AdminUser {
    email: string;
    created_at: string;
    added_by: string;
}

export default function AdminQuestionsPage() {
    const [activeTab, setActiveTab] = useState<'questions' | 'admins' | 'teams'>('questions');
    const [questions, setQuestions] = useState<Question[]>([]);
    const [admins, setAdmins] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [authLoading, setAuthLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const [isAuthorized, setIsAuthorized] = useState(false);

    // Question Edit State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Question>>({});

    // Team State
    const [teams, setTeams] = useState<TeamInfo[]>([]);
    const [editingTeam, setEditingTeam] = useState<TeamInfo | null>(null);
    const [teamForm, setTeamForm] = useState<Partial<TeamInfo>>({});

    // Fetch Teams
    const fetchTeams = async () => {
        const client = getSbClient();
        if (!client) return;
        const { data, error } = await client
            .from(TABLES.TEAMS)
            .select('*')
            .order('country', { ascending: true });
        if (!error) setTeams(data || []);
    };

    const handleInitialTeamsLoad = () => {
        setConfirmModal({
            isOpen: true,
            title: '팀 데이터 초기화',
            message: '기본 팀 데이터를 DB에 로드하시겠습니까? (중복 시 추가됨)',
            onConfirm: async () => {
                const client = getSbClient();
                if (!client) return;

                const { error } = await client
                    .from(TABLES.TEAMS)
                    .insert(MISSION_TEAMS);

                if (error) showNotification('팀 데이터 로드 실패: ' + error.message, 'error');
                else {
                    fetchTeams();
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                    showNotification('팀 데이터가 로드되었습니다.', 'success');
                }
            }
        });
    };

    const handleSaveTeam = async () => {
        const client = getSbClient();
        if (!client) return;

        const teamData = {
            dept: teamForm.dept,
            leader: teamForm.leader,
            country: teamForm.country,
            missionary: teamForm.missionary,
            period: teamForm.period,
            members: teamForm.members,
            content: teamForm.content
        };

        let error;
        if (editingTeam?.id) {
            const { error: updateError } = await client
                .from(TABLES.TEAMS)
                .update(teamData)
                .eq('id', editingTeam.id);
            error = updateError;
        } else {
            const { error: insertError } = await client
                .from(TABLES.TEAMS)
                .insert([teamData]);
            error = insertError;
        }

        if (error) {
            showNotification('팀 저장 실패: ' + error.message, 'error');
        } else {
            setEditingTeam(null);
            setTeamForm({});
            fetchTeams();
            showNotification('팀이 저장되었습니다.', 'success');
        }
    };

    const handleDeleteTeam = async (id: string) => {
        if (!confirm('팀을 삭제하시겠습니까?')) return;
        const client = getSbClient();
        if (!client) return;

        const { error } = await client.from(TABLES.TEAMS).delete().eq('id', id);
        if (error) showNotification('삭제 실패: ' + error.message, 'error');
        else {
            fetchTeams();
            showNotification('팀이 삭제되었습니다.', 'success');
        }
    };

    // Admin Add State
    const [newAdminEmail, setNewAdminEmail] = useState('');

    useEffect(() => {
        const client = getSbClient();
        if (!client) {
            setAuthLoading(false);
            return;
        }

        const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                checkAuthorization(client, session.user);
            } else {
                setUser(null);
                setIsAuthorized(false);
                setAuthLoading(false);
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (isAuthorized) {
            // Fetch all data in parallel with error handling
            const fetchAllData = async () => {
                const results = await Promise.allSettled([
                    fetchQuestions(),
                    fetchAdmins(),
                    fetchTeams()
                ]);
                results.forEach((result, index) => {
                    if (result.status === 'rejected') {
                        const names = ['questions', 'admins', 'teams'];
                        console.error(`Failed to fetch ${names[index]}:`, result.reason);
                    }
                });
            };
            fetchAllData();
        }
    }, [isAuthorized]);

    const checkAuthorization = async (client: ReturnType<typeof getSbClient>, currentUser: User) => {
        if (!client) return;

        try {
            const { data } = await client
                .from(TABLES.ADMIN_USERS)
                .select('*')
                .eq('email', currentUser.email)
                .maybeSingle();

            if (data || currentUser.email === ENV_CONFIG.ADMIN_EMAIL) {
                setUser(currentUser);
                setIsAuthorized(true);
            } else {
                console.warn('Unauthorized email:', currentUser.email);
                setIsAuthorized(false);
                setUser(currentUser);
            }
        } catch (error) {
            console.error('Authorization check failed:', error);
            setIsAuthorized(false);
            setUser(currentUser);
        } finally {
            setAuthLoading(false);
        }
    };

    const handleLogin = async () => {
        const client = getSbClient();
        if (!client) return;
        const { error } = await client.auth.signInWithOAuth({
            provider: 'google',
            options: {
                queryParams: {
                    access_type: 'offline',
                    prompt: 'select_account'
                },
                redirectTo: window.location.origin + '/admin/questions'
            }
        });
        if (error) showNotification('로그인 중 오류: ' + error.message, 'error');
    };

    // Notification State
    const [notification, setNotification] = useState<{
        message: string;
        type: 'success' | 'error';
        isVisible: boolean;
    }>({ message: '', type: 'success', isVisible: false });

    const showNotification = (message: string, type: 'success' | 'error') => {
        setNotification({ message, type, isVisible: true });
        setTimeout(() => setNotification(prev => ({ ...prev, isVisible: false })), 3000);
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
            .from(TABLES.QUESTIONS)
            .select('*')
            .order('sort_order', { ascending: true });

        if (!error) {
            setQuestions(data || []);
        }
        setLoading(false);
    };

    const fetchAdmins = async () => {
        const client = getSbClient();
        if (!client) return;
        const { data, error } = await client
            .from(TABLES.ADMIN_USERS)
            .select('*')
            .order('created_at', { ascending: false });
        if (!error) setAdmins(data || []);
    };

    const handleSaveQuestion = async (id: string) => {
        const client = getSbClient();
        if (!client) {
            showNotification('서비스에 연결할 수 없습니다.', 'error');
            return;
        }
        try {
            const { error } = await client
                .from(TABLES.QUESTIONS)
                .update(editForm)
                .eq('id', id);

            if (error) {
                showNotification('저장 실패: ' + error.message, 'error');
            } else {
                setEditingId(null);
                fetchQuestions();
                showNotification('문항이 수정되었습니다.', 'success');
            }
        } catch (e) {
            showNotification('저장 중 오류가 발생했습니다.', 'error');
            console.error('Save question error:', e);
        }
    };

    const handleToggleHidden = async (q: Question) => {
        const client = getSbClient();
        if (!client) return;
        try {
            const { error } = await client
                .from(TABLES.QUESTIONS)
                .update({ is_hidden: !q.is_hidden })
                .eq('id', q.id);
            if (!error) fetchQuestions();
        } catch (e) {
            console.error('Toggle hidden error:', e);
        }
    };

    const handleAddQuestion = async () => {
        const client = getSbClient();
        if (!client) {
            showNotification('서비스에 연결할 수 없습니다.', 'error');
            return;
        }
        try {
            const newId = generateId('q');
            const { error } = await client
                .from(TABLES.QUESTIONS)
                .insert([{
                    id: newId,
                    role: 'common',
                    type: 'text',
                    question_text: '새로운 문항을 입력하세요',
                    sort_order: (questions.length > 0 ? Math.max(...questions.map(q => q.sort_order || 0)) : 0) + 10,
                    is_hidden: false
                }]);
            if (!error) {
                setEditingId(newId);
                setEditForm({ question_text: '새로운 문항을 입력하세요', role: 'common', type: 'text' });
                fetchQuestions();
                showNotification('새 문항이 추가되었습니다.', 'success');
            } else {
                showNotification('추가 실패: ' + error.message, 'error');
            }
        } catch (e) {
            showNotification('문항 추가 중 오류가 발생했습니다.', 'error');
            console.error('Add question error:', e);
        }
    };

    const handleDeleteQuestion = async (id: string) => {
        if (!confirm('문항을 삭제하시겠습니까?')) return;

        const client = getSbClient();
        if (!client) {
            showNotification('서비스에 연결할 수 없습니다.', 'error');
            return;
        }
        try {
            const { error } = await client.from(TABLES.QUESTIONS).delete().eq('id', id);
            if (!error) {
                fetchQuestions();
                showNotification('문항이 삭제되었습니다.', 'success');
            } else {
                showNotification('삭제 실패: ' + error.message, 'error');
            }
        } catch (e) {
            showNotification('삭제 중 오류가 발생했습니다.', 'error');
            console.error('Delete question error:', e);
        }
    };

    const handleAddAdmin = async () => {
        const client = getSbClient();
        if (!client || !newAdminEmail || !user) return;

        // Email validation
        if (!isValidEmail(newAdminEmail)) {
            showNotification('유효한 이메일 주소를 입력해주세요.', 'error');
            return;
        }

        const { error } = await client
            .from(TABLES.ADMIN_USERS)
            .insert([{ email: newAdminEmail.trim().toLowerCase(), added_by: user.email }]);

        if (error) showNotification('관리자 추가 실패: ' + error.message, 'error');
        else {
            setNewAdminEmail('');
            fetchAdmins();
            showNotification('관리자가 추가되었습니다.', 'success');
        }
    };

    const handleDeleteAdmin = async (email: string) => {
        const client = getSbClient();
        if (!client || !user) return;
        if (email === user.email) { showNotification('자기 자신은 삭제할 수 없습니다.', 'error'); return; }

        if (!confirm(`${email} 관리자를 권한 해제하시겠습니까?`)) return;

        const { error } = await client.from(TABLES.ADMIN_USERS).delete().eq('email', email);
        if (error) showNotification('삭제 실패: ' + error.message, 'error');
        else {
            fetchAdmins();
            showNotification('관리자 권한이 해제되었습니다.', 'success');
        }
    };

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    const handleLoadInitialData = () => {
        setConfirmModal({
            isOpen: true,
            title: '초기 데이터 로드',
            message: '초기 데이터를 불러오시겠습니까? 기존 데이터에 추가됩니다. (중복 방지됨)',
            onConfirm: async () => {
                const client = getSbClient();
                if (!client) return;

                const { error } = await client
                    .from(TABLES.QUESTIONS)
                    .upsert(INITIAL_QUESTIONS.map(q => ({ ...q, is_hidden: false })));

                if (error) {
                    showNotification('초기 데이터 로드 실패: ' + error.message, 'error');
                } else {
                    fetchQuestions();
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                    showNotification('초기 데이터가 성공적으로 로드되었습니다.', 'success');
                }
            }
        });
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
        <div className="min-h-screen bg-gray-50 font-sans relative">
            {/* Notification Toast */}
            {notification.isVisible && (
                <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-[70] px-6 py-3 rounded-2xl shadow-2xl font-bold text-white animate-in slide-in-from-top-4 duration-300 ${notification.type === 'success' ? 'bg-green-600' : 'bg-red-500'}`}>
                    {notification.message}
                </div>
            )}

            {/* Confirmation Modal */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} />
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl relative z-10 animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-black text-gray-900 mb-2">{confirmModal.title}</h3>
                        <p className="text-gray-500 font-medium mb-8 leading-relaxed">
                            {confirmModal.message}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                                className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={confirmModal.onConfirm}
                                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-colors"
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Nav */}
            <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 px-6 py-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <div className="flex flex-col">
                            <span className="text-sm font-black text-gray-900 leading-tight">ADMIN DASHBOARD</span>
                            <span className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">{activeTab} mode</span>
                        </div>
                        <div className="hidden md:flex items-center gap-1 bg-gray-50 p-1 rounded-xl">
                            <a
                                href="/admin/dashboard"
                                className="px-4 py-2 rounded-lg text-sm font-bold text-gray-400 hover:text-gray-600"
                            >
                                대시보드
                            </a>
                            <button
                                onClick={() => setActiveTab('questions')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'questions' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                문항 관리
                            </button>
                            <button
                                onClick={() => setActiveTab('teams')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'teams' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                팀 관리
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
                            <span className="text-xs font-bold text-gray-900">{user?.email}</span>
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
                            <div className="flex gap-2">
                                <button
                                    onClick={handleLoadInitialData}
                                    className="px-6 py-4 bg-green-600 text-white rounded-2xl font-black hover:bg-green-700 active:scale-95 transition-all shadow-xl shadow-green-100 flex items-center justify-center gap-2"
                                >
                                    초기 데이터 로드
                                </button>
                                <button
                                    onClick={handleAddQuestion}
                                    className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 active:scale-95 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                    Add New Question
                                </button>
                            </div>
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
                                                                    <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value as QuestionType })} className="bg-gray-50 border-none rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all">
                                                                        <option value="scale">Scale</option>
                                                                        <option value="text">Text</option>
                                                                        <option value="multi_select">Multi-Select</option>
                                                                    </select>
                                                                </div>
                                                                <input
                                                                    type="text"
                                                                    value={editForm.question_text}
                                                                    onChange={e => setEditForm({ ...editForm, question_text: e.target.value })}
                                                                    className="w-full bg-gray-50 border-none rounded-xl p-3 font-bold text-sm focus:ring-2 focus:ring-blue-500"
                                                                />

                                                                {/* Options Editor */}
                                                                {(editForm.type === 'multi_select' || (q.options && Array.isArray(q.options))) && (
                                                                    <div>
                                                                        <label className="block text-xs font-bold text-gray-400 mb-1">Options (한 줄에 하나씩 입력)</label>
                                                                        <textarea
                                                                            value={Array.isArray(editForm.options) ? editForm.options.join('\n') : ''}
                                                                            onChange={e => setEditForm({
                                                                                ...editForm,
                                                                                options: e.target.value.split('\n').filter(line => line.trim() !== '')
                                                                            })}
                                                                            className="w-full bg-gray-50 border-none rounded-xl p-3 font-bold text-sm h-32 focus:ring-2 focus:ring-blue-500"
                                                                            placeholder="옵션 1&#10;옵션 2"
                                                                        />
                                                                    </div>
                                                                )}

                                                                <div className="flex justify-end gap-2 pt-2">
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
                                                                    {q.options && q.options.length > 0 && (
                                                                        <div className="mt-2 text-xs text-gray-500">
                                                                            Options: {q.options.join(', ')}
                                                                        </div>
                                                                    )}
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
                ) : activeTab === 'teams' ? (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-200 pb-8">
                            <div>
                                <h1 className="text-4xl font-black text-gray-900">Mission Teams</h1>
                                <p className="text-gray-500 mt-2 font-medium">선교팀 정보를 관리합니다.</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleInitialTeamsLoad}
                                    className="px-6 py-4 bg-green-600 text-white rounded-2xl font-black hover:bg-green-700 active:scale-95 transition-all shadow-xl shadow-green-100 flex items-center justify-center gap-2"
                                >
                                    초기 팀 데이터 로드
                                </button>
                                <button
                                    onClick={() => { setEditingTeam(null); setTeamForm({}); }}
                                    className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 active:scale-95 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                    새 팀 추가
                                </button>
                            </div>
                        </div>

                        {editingTeam !== null || Object.keys(teamForm).length > 0 ? (
                            <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 animate-in zoom-in-95 duration-200">
                                <h2 className="text-2xl font-black text-gray-900 mb-4">{editingTeam ? '팀 수정' : '새 팀 추가'}</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <input type="text" placeholder="국가" value={teamForm.country || ''} onChange={e => setTeamForm({ ...teamForm, country: e.target.value })} className="bg-gray-50 border-none rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-blue-500" />
                                    <input type="text" placeholder="팀명 (Dept)" value={teamForm.dept || ''} onChange={e => setTeamForm({ ...teamForm, dept: e.target.value })} className="bg-gray-50 border-none rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-blue-500" />
                                    <input type="text" placeholder="선교사" value={teamForm.missionary || ''} onChange={e => setTeamForm({ ...teamForm, missionary: e.target.value })} className="bg-gray-50 border-none rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-blue-500" />
                                    <input type="text" placeholder="팀장" value={teamForm.leader || ''} onChange={e => setTeamForm({ ...teamForm, leader: e.target.value })} className="bg-gray-50 border-none rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-blue-500" />
                                    <input type="text" placeholder="기간 (예: 2024.07.01-07.10)" value={teamForm.period || ''} onChange={e => setTeamForm({ ...teamForm, period: e.target.value })} className="bg-gray-50 border-none rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-blue-500" />
                                    <input type="text" placeholder="멤버 (쉼표로 구분)" value={teamForm.members || ''} onChange={e => setTeamForm({ ...teamForm, members: e.target.value })} className="bg-gray-50 border-none rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-blue-500" />
                                    <textarea placeholder="내용" value={teamForm.content || ''} onChange={e => setTeamForm({ ...teamForm, content: e.target.value })} className="md:col-span-2 bg-gray-50 border-none rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 min-h-[100px]" />
                                </div>
                                <div className="flex justify-end gap-2 mt-4">
                                    <button onClick={() => { setEditingTeam(null); setTeamForm({}); }} className="px-4 py-2 text-sm font-bold text-gray-400 hover:text-gray-600">취소</button>
                                    <button onClick={handleSaveTeam} className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-black shadow-lg shadow-blue-100">저장</button>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-[40px] shadow-2xl shadow-gray-200/40 border border-gray-100 overflow-hidden">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100">
                                            <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">국가</th>
                                            <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">팀명</th>
                                            <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">선교사</th>
                                            <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">팀장</th>
                                            <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">기간</th>
                                            <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">멤버</th>
                                            <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">내용</th>
                                            <th className="px-8 py-6 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">액션</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {teams.map(team => (
                                            <tr key={team.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-8 py-6 text-sm font-bold text-gray-900">{team.country}</td>
                                                <td className="px-8 py-6 text-sm font-bold text-gray-900">{team.dept}</td>
                                                <td className="px-8 py-6 text-sm font-bold text-gray-900">{team.missionary}</td>
                                                <td className="px-8 py-6 text-sm font-bold text-gray-900">{team.leader}</td>
                                                <td className="px-8 py-6 text-sm font-bold text-gray-900">{team.period}</td>
                                                <td className="px-8 py-6 text-sm font-bold text-gray-900">{team.members}</td>
                                                <td className="px-8 py-6 text-sm font-bold text-gray-900">{team.content}</td>
                                                <td className="px-8 py-6 text-right">
                                                    <div className="flex items-center justify-end gap-3">
                                                        <button onClick={() => { setEditingTeam(team); setTeamForm(team); }} className="text-xs font-black text-gray-300 hover:text-blue-600 transition-colors uppercase tracking-widest">Edit</button>
                                                        <button onClick={() => team.id && handleDeleteTeam(team.id)} className={`text-xs font-black uppercase tracking-widest transition-colors ${team.id ? 'text-gray-200 hover:text-red-500' : 'text-gray-100 cursor-not-allowed'}`}>Del</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
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
                                                    {admin.email === user?.email && (
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
                                                    className={`text-xs font-black uppercase tracking-widest py-2 px-4 rounded-xl transition-all ${admin.email === user?.email ? 'text-gray-200 cursor-not-allowed' : 'text-red-300 hover:text-red-600 hover:bg-red-50'}`}
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
