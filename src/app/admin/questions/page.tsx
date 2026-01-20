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

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Question>>({});

    const [teams, setTeams] = useState<TeamInfo[]>([]);
    const [editingTeam, setEditingTeam] = useState<TeamInfo | null>(null);
    const [teamForm, setTeamForm] = useState<Partial<TeamInfo>>({});

    const [newAdminEmail, setNewAdminEmail] = useState('');

    const [questionRoleFilter, setQuestionRoleFilter] = useState<string>('all');
    const [questionTypeFilter, setQuestionTypeFilter] = useState<string>('all');
    const [questionSearch, setQuestionSearch] = useState<string>('');

    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({ message: '', type: 'success', isVisible: false });
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

    const showNotification = (message: string, type: 'success' | 'error') => {
        setNotification({ message, type, isVisible: true });
        setTimeout(() => setNotification(prev => ({ ...prev, isVisible: false })), 3000);
    };

    const fetchTeams = async () => {
        const client = getSbClient();
        if (!client) return;
        const { data, error } = await client.from(TABLES.TEAMS).select('*').order('country', { ascending: true });
        if (!error) setTeams(data || []);
    };

    const fetchQuestions = async () => {
        const client = getSbClient();
        if (!client) return;
        setLoading(true);
        const { data, error } = await client.from(TABLES.QUESTIONS).select('*').order('sort_order', { ascending: true });
        if (!error) setQuestions(data || []);
        setLoading(false);
    };

    const fetchAdmins = async () => {
        const client = getSbClient();
        if (!client) return;
        const { data, error } = await client.from(TABLES.ADMIN_USERS).select('*').order('created_at', { ascending: false });
        if (!error) setAdmins(data || []);
    };

    useEffect(() => {
        const client = getSbClient();
        if (!client) { setAuthLoading(false); return; }
        const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
            if (session?.user) checkAuthorization(client, session.user);
            else { setUser(null); setIsAuthorized(false); setAuthLoading(false); }
        });
        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (isAuthorized) {
            Promise.allSettled([fetchQuestions(), fetchAdmins(), fetchTeams()]);
        }
    }, [isAuthorized]);

    const checkAuthorization = async (client: ReturnType<typeof getSbClient>, currentUser: User) => {
        if (!client) return;
        const { data } = await client.from(TABLES.ADMIN_USERS).select('*').eq('email', currentUser.email).maybeSingle();
        if (data || currentUser.email === ENV_CONFIG.ADMIN_EMAIL) {
            setUser(currentUser);
            setIsAuthorized(true);
        } else {
            setIsAuthorized(false);
            setUser(currentUser);
        }
        setAuthLoading(false);
    };

    const handleLogin = async () => {
        const client = getSbClient();
        if (!client) return;
        const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/admin/questions' } });
        if (error) showNotification('로그인 오류: ' + error.message, 'error');
    };

    const handleLogout = async () => {
        const client = getSbClient();
        if (!client) return;
        await client.auth.signOut();
        window.location.reload();
    };

    const handleSaveQuestion = async (id: string) => {
        const client = getSbClient();
        if (!client) return;
        const { error } = await client.from(TABLES.QUESTIONS).update(editForm).eq('id', id);
        if (error) showNotification('저장 실패: ' + error.message, 'error');
        else { setEditingId(null); fetchQuestions(); showNotification('저장되었습니다.', 'success'); }
    };

    const handleToggleHidden = async (q: Question) => {
        const client = getSbClient();
        if (!client) return;
        const { error } = await client.from(TABLES.QUESTIONS).update({ is_hidden: !q.is_hidden }).eq('id', q.id);
        if (!error) fetchQuestions();
    };

    const handleAddQuestion = async () => {
        const client = getSbClient();
        if (!client) return;
        const newId = generateId('q');
        const { error } = await client.from(TABLES.QUESTIONS).insert([{ id: newId, role: 'common', type: 'text', question_text: '새 문항', sort_order: (questions.length > 0 ? Math.max(...questions.map(q => q.sort_order || 0)) : 0) + 10, is_hidden: false }]);
        if (!error) { setEditingId(newId); setEditForm({ question_text: '새 문항', role: 'common', type: 'text' }); fetchQuestions(); showNotification('추가되었습니다.', 'success'); }
        else showNotification('추가 실패: ' + error.message, 'error');
    };

    const handleLoadInitialData = () => {
        setConfirmModal({
            isOpen: true, title: '초기 데이터 로드', message: '초기 데이터를 불러오시겠습니까?',
            onConfirm: async () => {
                const client = getSbClient();
                if (!client) return;
                const { error } = await client.from(TABLES.QUESTIONS).upsert(INITIAL_QUESTIONS.map(q => ({ ...q, is_hidden: false })));
                if (error) showNotification('로드 실패: ' + error.message, 'error');
                else { fetchQuestions(); setConfirmModal(prev => ({ ...prev, isOpen: false })); showNotification('로드 완료', 'success'); }
            }
        });
    };

    const handleSaveTeam = async () => {
        const client = getSbClient();
        if (!client) return;
        const teamData = { dept: teamForm.dept, leader: teamForm.leader, country: teamForm.country, missionary: teamForm.missionary, period: teamForm.period, members: teamForm.members, content: teamForm.content };
        let error;
        if (editingTeam?.id) { const { error: e } = await client.from(TABLES.TEAMS).update(teamData).eq('id', editingTeam.id); error = e; }
        else { const { error: e } = await client.from(TABLES.TEAMS).insert([teamData]); error = e; }
        if (error) showNotification('저장 실패: ' + error.message, 'error');
        else { setEditingTeam(null); setTeamForm({}); fetchTeams(); showNotification('저장되었습니다.', 'success'); }
    };

    const handleInitialTeamsLoad = () => {
        setConfirmModal({
            isOpen: true, title: '팀 데이터 초기화', message: '기본 팀 데이터를 로드하시겠습니까?',
            onConfirm: async () => {
                const client = getSbClient();
                if (!client) return;
                const { error } = await client.from(TABLES.TEAMS).insert(MISSION_TEAMS);
                if (error) showNotification('로드 실패: ' + error.message, 'error');
                else { fetchTeams(); setConfirmModal(prev => ({ ...prev, isOpen: false })); showNotification('로드 완료', 'success'); }
            }
        });
    };

    const handleAddAdmin = async () => {
        const client = getSbClient();
        if (!client || !newAdminEmail || !user) return;
        if (!isValidEmail(newAdminEmail)) { showNotification('유효한 이메일을 입력하세요.', 'error'); return; }
        const { error } = await client.from(TABLES.ADMIN_USERS).insert([{ email: newAdminEmail.trim().toLowerCase(), added_by: user.email }]);
        if (error) showNotification('추가 실패: ' + error.message, 'error');
        else { setNewAdminEmail(''); fetchAdmins(); showNotification('추가되었습니다.', 'success'); }
    };

    const handleDeleteAdmin = async (email: string) => {
        const client = getSbClient();
        if (!client || !user) return;
        if (email === user.email) { showNotification('자신은 삭제할 수 없습니다.', 'error'); return; }
        if (!confirm(`${email} 권한을 해제하시겠습니까?`)) return;
        const { error } = await client.from(TABLES.ADMIN_USERS).delete().eq('email', email);
        if (error) showNotification('삭제 실패: ' + error.message, 'error');
        else { fetchAdmins(); showNotification('해제되었습니다.', 'success'); }
    };

    if (authLoading) {
        return <div className="flex items-center justify-center min-h-screen bg-gray-50"><div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div></div>;
    }

    if (!isAuthorized) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-lg shadow-sm w-full max-w-sm text-center border border-gray-200">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                        <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </div>
                    <h1 className="text-lg font-bold mb-1 text-gray-900">관리자 로그인</h1>
                    <p className="text-gray-500 text-sm mb-6">{user ? `${user.email}은 권한이 없습니다.` : '관리자 계정으로 로그인해 주세요.'}</p>
                    {!user ? (
                        <button onClick={handleLogin} className="w-full py-3 bg-white border border-gray-200 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-gray-50 text-sm">
                            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="" />Google 로그인
                        </button>
                    ) : (
                        <button onClick={handleLogout} className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 text-sm">다른 계정으로 로그인</button>
                    )}
                </div>
            </div>
        );
    }

    const filteredQuestions = questions.filter(q =>
        (questionRoleFilter === 'all' || q.role === questionRoleFilter) &&
        (questionTypeFilter === 'all' || q.type === questionTypeFilter) &&
        (questionSearch === '' || (q.question_text || '').toLowerCase().includes(questionSearch.toLowerCase()))
    );

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-sm">
            {/* Notification */}
            {notification.isVisible && (
                <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[70] px-4 py-2 rounded-lg shadow-lg text-white text-xs font-medium ${notification.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
                    {notification.message}
                </div>
            )}

            {/* Confirm Modal */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} />
                    <div className="bg-white rounded-lg p-5 max-w-sm w-full shadow-xl relative z-10">
                        <h3 className="font-bold text-gray-900 mb-2">{confirmModal.title}</h3>
                        <p className="text-gray-600 text-xs mb-4">{confirmModal.message}</p>
                        <div className="flex gap-2">
                            <button onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} className="flex-1 py-2 bg-gray-100 text-gray-600 rounded text-xs font-medium hover:bg-gray-200">취소</button>
                            <button onClick={confirmModal.onConfirm} className="flex-1 py-2 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700">확인</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-screen-xl mx-auto px-4 h-11 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <span className="font-bold text-gray-900">Mission Survey</span>
                        <nav className="flex items-center gap-1 text-xs">
                            <a href="/admin/dashboard" className="px-3 py-1.5 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-50">대시보드</a>
                            <a href="/admin/responses" className="px-3 py-1.5 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-50">응답시트</a>
                            <button onClick={() => setActiveTab('questions')} className={`px-3 py-1.5 rounded font-medium ${activeTab === 'questions' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>문항</button>
                            <button onClick={() => setActiveTab('teams')} className={`px-3 py-1.5 rounded font-medium ${activeTab === 'teams' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>팀</button>
                            <button onClick={() => setActiveTab('admins')} className={`px-3 py-1.5 rounded font-medium ${activeTab === 'admins' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>관리자</button>
                        </nav>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 hidden sm:inline">{user?.email}</span>
                        <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-red-500" title="로그아웃">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-screen-xl mx-auto px-4 py-4">
                {activeTab === 'questions' && (
                    <div className="space-y-3">
                        {/* Actions */}
                        <div className="bg-white border border-gray-200 rounded-lg p-3 flex flex-wrap items-center gap-2">
                            <select value={questionRoleFilter} onChange={e => setQuestionRoleFilter(e.target.value)} className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white">
                                <option value="all">모든 역할</option>
                                <option value="missionary">선교사</option>
                                <option value="leader">인솔자</option>
                                <option value="team_member">팀원</option>
                                <option value="common">공통</option>
                            </select>
                            <select value={questionTypeFilter} onChange={e => setQuestionTypeFilter(e.target.value)} className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white">
                                <option value="all">모든 타입</option>
                                <option value="scale">척도형</option>
                                <option value="text">서술형</option>
                                <option value="multi_select">복수선택</option>
                            </select>
                            <input type="text" placeholder="검색..." value={questionSearch} onChange={e => setQuestionSearch(e.target.value)} className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white flex-1 min-w-[150px]" />
                            <span className="text-xs text-gray-500"><span className="font-semibold text-gray-700">{filteredQuestions.length}</span>개</span>
                            <div className="flex-1" />
                            <button onClick={handleLoadInitialData} className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200">초기 데이터</button>
                            <button onClick={handleAddQuestion} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">새 문항</button>
                        </div>

                        {/* Table */}
                        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                            {loading ? (
                                <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div></div>
                            ) : (
                                <table className="w-full text-xs">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="text-left py-2 px-3 font-medium text-gray-600 w-20">역할</th>
                                            <th className="text-left py-2 px-3 font-medium text-gray-600 w-20">타입</th>
                                            <th className="text-left py-2 px-3 font-medium text-gray-600">문항</th>
                                            <th className="text-center py-2 px-3 font-medium text-gray-600 w-16">상태</th>
                                            <th className="text-right py-2 px-3 font-medium text-gray-600 w-16"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredQuestions.map(q => (
                                            <tr key={q.id} className={`border-b border-gray-50 hover:bg-gray-50 ${q.is_hidden ? 'opacity-50' : ''}`}>
                                                {editingId === q.id ? (
                                                    <td colSpan={5} className="p-3">
                                                        <div className="bg-blue-50 rounded p-3 space-y-2">
                                                            <div className="flex gap-2">
                                                                <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} className="text-xs border rounded px-2 py-1.5 bg-white">
                                                                    <option value="missionary">선교사</option>
                                                                    <option value="leader">인솔자</option>
                                                                    <option value="team_member">팀원</option>
                                                                    <option value="common">공통</option>
                                                                </select>
                                                                <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value as QuestionType })} className="text-xs border rounded px-2 py-1.5 bg-white">
                                                                    <option value="scale">척도형</option>
                                                                    <option value="text">서술형</option>
                                                                    <option value="multi_select">복수선택</option>
                                                                </select>
                                                                <input type="text" value={editForm.question_text} onChange={e => setEditForm({ ...editForm, question_text: e.target.value })} className="flex-1 text-xs border rounded px-2 py-1.5 bg-white" />
                                                            </div>
                                                            {(editForm.type === 'multi_select' || (q.options && q.options.length > 0)) && (
                                                                <textarea value={Array.isArray(editForm.options) ? editForm.options.join('\n') : ''} onChange={e => setEditForm({ ...editForm, options: e.target.value.split('\n').filter(l => l.trim()) })} className="w-full text-xs border rounded px-2 py-1.5 bg-white h-16" placeholder="옵션 (줄별)" />
                                                            )}
                                                            <div className="flex justify-end gap-2">
                                                                <button onClick={() => setEditingId(null)} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700">취소</button>
                                                                <button onClick={() => handleSaveQuestion(q.id)} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">저장</button>
                                                            </div>
                                                        </div>
                                                    </td>
                                                ) : (
                                                    <>
                                                        <td className="py-2 px-3">
                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${q.role === 'missionary' ? 'bg-amber-100 text-amber-700' : q.role === 'leader' ? 'bg-emerald-100 text-emerald-700' : q.role === 'team_member' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                                                                {q.role === 'missionary' ? '선교사' : q.role === 'leader' ? '인솔자' : q.role === 'team_member' ? '팀원' : '공통'}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${q.type === 'scale' ? 'bg-purple-100 text-purple-700' : q.type === 'text' ? 'bg-cyan-100 text-cyan-700' : 'bg-pink-100 text-pink-700'}`}>
                                                                {q.type === 'scale' ? '척도' : q.type === 'text' ? '서술' : '복수'}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            <div className="text-gray-800 line-clamp-1">{q.question_text}</div>
                                                            {q.options && q.options.length > 0 && <div className="text-[10px] text-gray-400 truncate">옵션: {q.options.join(', ')}</div>}
                                                        </td>
                                                        <td className="py-2 px-3 text-center">
                                                            <button onClick={() => handleToggleHidden(q)} className={`w-8 h-4 rounded-full relative ${q.is_hidden ? 'bg-gray-200' : 'bg-emerald-500'}`} title={q.is_hidden ? '숨김' : '표시'}>
                                                                <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${q.is_hidden ? 'left-0.5' : 'left-4'}`}></span>
                                                            </button>
                                                        </td>
                                                        <td className="py-2 px-3 text-right">
                                                            <button onClick={() => { setEditingId(q.id); setEditForm(q); }} className="text-gray-400 hover:text-blue-600" title="수정">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                            </button>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                            {filteredQuestions.length === 0 && !loading && <div className="text-center py-8 text-gray-400">{questions.length === 0 ? '문항이 없습니다.' : '조건에 맞는 문항이 없습니다.'}</div>}
                        </div>
                    </div>
                )}

                {activeTab === 'teams' && (
                    <div className="space-y-3">
                        {/* Actions */}
                        <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                            <span className="text-xs text-gray-500">팀 <span className="font-semibold text-gray-700">{teams.length}</span>개</span>
                            <div className="flex gap-2">
                                <button onClick={handleInitialTeamsLoad} className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200">초기 데이터</button>
                                <button onClick={() => { setEditingTeam({} as TeamInfo); setTeamForm({}); }} className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700">새 팀</button>
                            </div>
                        </div>

                        {/* Edit Form */}
                        {editingTeam !== null && (
                            <div className="bg-white border border-gray-200 rounded-lg p-4">
                                <h3 className="font-semibold text-gray-800 text-xs mb-3">{editingTeam.id ? '팀 수정' : '새 팀'}</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                                    <input type="text" placeholder="국가" value={teamForm.country || ''} onChange={e => setTeamForm({ ...teamForm, country: e.target.value })} className="border rounded px-2 py-1.5" />
                                    <input type="text" placeholder="팀명 (Dept)" value={teamForm.dept || ''} onChange={e => setTeamForm({ ...teamForm, dept: e.target.value })} className="border rounded px-2 py-1.5" />
                                    <input type="text" placeholder="선교사" value={teamForm.missionary || ''} onChange={e => setTeamForm({ ...teamForm, missionary: e.target.value })} className="border rounded px-2 py-1.5" />
                                    <input type="text" placeholder="팀장" value={teamForm.leader || ''} onChange={e => setTeamForm({ ...teamForm, leader: e.target.value })} className="border rounded px-2 py-1.5" />
                                    <input type="text" placeholder="기간" value={teamForm.period || ''} onChange={e => setTeamForm({ ...teamForm, period: e.target.value })} className="border rounded px-2 py-1.5" />
                                    <input type="text" placeholder="멤버" value={teamForm.members || ''} onChange={e => setTeamForm({ ...teamForm, members: e.target.value })} className="border rounded px-2 py-1.5" />
                                    <textarea placeholder="설명" value={teamForm.content || ''} onChange={e => setTeamForm({ ...teamForm, content: e.target.value })} className="col-span-full border rounded px-2 py-1.5 h-16" />
                                </div>
                                <div className="flex justify-end gap-2 mt-3">
                                    <button onClick={() => { setEditingTeam(null); setTeamForm({}); }} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700">취소</button>
                                    <button onClick={handleSaveTeam} className="px-3 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700">저장</button>
                                </div>
                            </div>
                        )}

                        {/* Table */}
                        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                            <table className="w-full text-xs">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="text-left py-2 px-3 font-medium text-gray-600">국가</th>
                                        <th className="text-left py-2 px-3 font-medium text-gray-600">선교사</th>
                                        <th className="text-left py-2 px-3 font-medium text-gray-600">팀장</th>
                                        <th className="text-left py-2 px-3 font-medium text-gray-600">기간</th>
                                        <th className="text-right py-2 px-3 font-medium text-gray-600"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {teams.map(team => (
                                        <tr key={team.id || team.missionary} className="border-b border-gray-50 hover:bg-gray-50">
                                            <td className="py-2 px-3 text-gray-700">{team.country}</td>
                                            <td className="py-2 px-3 font-medium text-gray-800">{team.missionary || '-'}</td>
                                            <td className="py-2 px-3 text-gray-600">{team.leader || '-'}</td>
                                            <td className="py-2 px-3 text-gray-500">{team.period || '-'}</td>
                                            <td className="py-2 px-3 text-right">
                                                <button onClick={() => { setEditingTeam(team); setTeamForm(team); }} className="text-gray-400 hover:text-emerald-600">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {teams.length === 0 && <div className="text-center py-8 text-gray-400">등록된 팀이 없습니다.</div>}
                        </div>
                    </div>
                )}

                {activeTab === 'admins' && (
                    <div className="space-y-3">
                        {/* Actions */}
                        <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-2">
                            <input type="email" placeholder="이메일 주소" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddAdmin()} className="flex-1 text-xs border rounded px-2 py-1.5" />
                            <button onClick={handleAddAdmin} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">추가</button>
                        </div>

                        {/* Table */}
                        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                            <table className="w-full text-xs">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="text-left py-2 px-3 font-medium text-gray-600">이메일</th>
                                        <th className="text-left py-2 px-3 font-medium text-gray-600">추가일</th>
                                        <th className="text-left py-2 px-3 font-medium text-gray-600">추가자</th>
                                        <th className="text-right py-2 px-3 font-medium text-gray-600"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {admins.map(admin => (
                                        <tr key={admin.email} className="border-b border-gray-50 hover:bg-gray-50">
                                            <td className="py-2 px-3">
                                                <span className="font-medium text-gray-800">{admin.email}</span>
                                                {admin.email === user?.email && <span className="ml-1 text-[9px] bg-blue-500 text-white px-1 py-0.5 rounded">YOU</span>}
                                            </td>
                                            <td className="py-2 px-3 text-gray-600">{new Date(admin.created_at).toLocaleDateString('ko-KR')}</td>
                                            <td className="py-2 px-3 text-gray-500">{admin.added_by || '-'}</td>
                                            <td className="py-2 px-3 text-right">
                                                <button onClick={() => handleDeleteAdmin(admin.email)} disabled={admin.email === user?.email} className={`px-2 py-1 rounded text-[10px] font-medium ${admin.email === user?.email ? 'bg-gray-100 text-gray-300' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>해제</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {admins.length === 0 && <div className="text-center py-8 text-gray-400">등록된 관리자가 없습니다.</div>}
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                            관리자로 추가된 이메일은 Google OAuth 로그인 시 대시보드와 설정 페이지에 접근할 수 있습니다.
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
