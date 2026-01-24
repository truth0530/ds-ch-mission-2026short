'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getSbClient } from '@/lib/supabase';
import { INITIAL_QUESTIONS, Question, MISSION_TEAMS, TeamInfo } from '@/lib/surveyData';
import { QuestionType } from '@/types';
import { TABLES } from '@/lib/constants';
import { isValidEmail, generateId } from '@/lib/validators';
import { useRequireAdmin } from '@/hooks/useAdminAuth';
import { AdminLoginCard, AdminErrorAlert } from '@/components/admin';

interface AdminUser {
    email: string;
    created_at: string;
    added_by: string;
}

export default function AdminQuestionsPage() {
    const { user, isAuthorized, loading: authLoading, login, logout, error: authError, clearError } = useRequireAdmin();

    const [activeTab, setActiveTab] = useState<'questions' | 'admins' | 'teams'>('questions');
    const [questions, setQuestions] = useState<Question[]>([]);
    const [admins, setAdmins] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [dataError, setDataError] = useState<string | null>(null);

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
        if (!client) { setDataError('데이터베이스 연결 실패'); return; }
        const { data, error } = await client.from(TABLES.TEAMS).select('*').order('country', { ascending: true });
        if (error) setDataError('팀 데이터 로드 실패');
        else setTeams(data || []);
    };

    const fetchQuestions = async () => {
        const client = getSbClient();
        if (!client) { setDataError('데이터베이스 연결 실패'); return; }
        setLoading(true);
        const { data, error } = await client.from(TABLES.QUESTIONS).select('*').order('sort_order', { ascending: true });
        if (error) setDataError('문항 데이터 로드 실패');
        else setQuestions(data || []);
        setLoading(false);
    };

    const fetchAdmins = async () => {
        const client = getSbClient();
        if (!client) { setDataError('데이터베이스 연결 실패'); return; }
        const { data, error } = await client.from(TABLES.ADMIN_USERS).select('*').order('created_at', { ascending: false });
        if (error) setDataError('관리자 데이터 로드 실패');
        else setAdmins(data || []);
    };

    useEffect(() => {
        if (isAuthorized) {
            setDataError(null);
            Promise.allSettled([fetchQuestions(), fetchAdmins(), fetchTeams()]);
        }
    }, [isAuthorized]);

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
        return <div className="flex items-center justify-center min-h-screen bg-white"><div className="w-8 h-8 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"></div></div>;
    }

    if (!isAuthorized) {
        return <AdminLoginCard user={user} onLogin={() => login('/admin/questions')} onLogout={logout} title="설정" />;
    }

    const filteredQuestions = questions.filter(q =>
        (questionRoleFilter === 'all' || q.role === questionRoleFilter) &&
        (questionTypeFilter === 'all' || q.type === questionTypeFilter) &&
        (questionSearch === '' || (q.question_text || '').toLowerCase().includes(questionSearch.toLowerCase()))
    );

    return (
        <div className="min-h-screen bg-white font-sans text-sm">
            {/* Notification */}
            {notification.isVisible && (
                <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[70] px-4 py-2.5 rounded-xl shadow-lg text-white text-xs font-medium backdrop-blur-sm ${notification.type === 'success' ? 'bg-emerald-500/90' : 'bg-red-500/90'}`}>
                    {notification.message}
                </div>
            )}

            {/* Confirm Modal */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} />
                    <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 max-w-sm w-full shadow-2xl relative z-10 border border-white/20">
                        <h3 className="font-bold text-slate-900 mb-2">{confirmModal.title}</h3>
                        <p className="text-slate-600 text-xs mb-5">{confirmModal.message}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-medium hover:bg-slate-200 transition-colors">취소</button>
                            <button onClick={confirmModal.onConfirm} className="flex-1 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl text-xs font-medium hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/25">확인</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
                <div className="max-w-screen-xl mx-auto px-4 h-12 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </div>
                            <span className="font-bold text-slate-800">Settings</span>
                        </div>
                        <nav className="flex items-center gap-1 text-xs" aria-label="관리자 메뉴">
                            <Link href="/admin/dashboard" className="px-3 py-1.5 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-white/50 transition-colors">대시보드</Link>
                            <Link href="/admin/responses" className="px-3 py-1.5 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-white/50 transition-colors">응답시트</Link>
                            <button onClick={() => setActiveTab('questions')} className={`px-3 py-1.5 rounded-lg font-medium transition-all ${activeTab === 'questions' ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}>문항</button>
                            <button onClick={() => setActiveTab('teams')} className={`px-3 py-1.5 rounded-lg font-medium transition-all ${activeTab === 'teams' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}>팀</button>
                            <button onClick={() => setActiveTab('admins')} className={`px-3 py-1.5 rounded-lg font-medium transition-all ${activeTab === 'admins' ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}>관리자</button>
                        </nav>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 hidden sm:inline">{user?.email}</span>
                        <button onClick={logout} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="로그아웃" aria-label="로그아웃">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-screen-xl mx-auto px-4 py-4">
                <AdminErrorAlert error={authError || dataError} onDismiss={authError ? clearError : () => setDataError(null)} />
                {activeTab === 'questions' && (
                    <div className="space-y-4">
                        {/* Actions */}
                        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-wrap items-center gap-3">
                            <select value={questionRoleFilter} onChange={e => setQuestionRoleFilter(e.target.value)} className="text-xs text-slate-800 border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all">
                                <option value="all">모든 역할</option>
                                <option value="missionary">선교사</option>
                                <option value="leader">인솔자</option>
                                <option value="team_member">팀원</option>
                                <option value="common">공통</option>
                            </select>
                            <select value={questionTypeFilter} onChange={e => setQuestionTypeFilter(e.target.value)} className="text-xs text-slate-800 border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all">
                                <option value="all">모든 타입</option>
                                <option value="scale">척도형</option>
                                <option value="text">서술형</option>
                                <option value="multi_select">복수선택</option>
                            </select>
                            <div className="relative flex-1 min-w-[150px]">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                <input type="text" placeholder="검색..." value={questionSearch} onChange={e => setQuestionSearch(e.target.value)} className="w-full text-xs text-slate-800 border border-slate-300 rounded-lg pl-9 pr-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all placeholder:text-slate-400" />
                            </div>
                            <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-lg"><span className="font-semibold text-slate-700">{filteredQuestions.length}</span>개</span>
                            <div className="flex-1" />
                            <button onClick={handleLoadInitialData} className="px-4 py-2 text-xs bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors font-medium">초기 데이터</button>
                            <button onClick={handleAddQuestion} className="px-4 py-2 text-xs bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/25 font-medium">새 문항</button>
                        </div>

                        {/* Table */}
                        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                            {loading ? (
                                <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"></div></div>
                            ) : (
                                <table className="w-full text-xs" role="table" aria-label="설문 문항 목록">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th scope="col" className="text-left py-3 px-4 font-semibold text-slate-600 w-20">역할</th>
                                            <th scope="col" className="text-left py-3 px-4 font-semibold text-slate-600 w-20">타입</th>
                                            <th scope="col" className="text-left py-3 px-4 font-semibold text-slate-600">문항</th>
                                            <th scope="col" className="text-center py-3 px-4 font-semibold text-slate-600 w-16">상태</th>
                                            <th scope="col" className="text-right py-3 px-4 font-semibold text-slate-600 w-16"><span className="sr-only">작업</span></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filteredQuestions.map(q => (
                                            <tr key={q.id} className={`hover:bg-indigo-50/30 transition-colors ${q.is_hidden ? 'opacity-50' : ''}`}>
                                                {editingId === q.id ? (
                                                    <td colSpan={5} className="p-4">
                                                        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 space-y-3 border border-indigo-100">
                                                            <div className="flex gap-2 flex-wrap">
                                                                <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500/20">
                                                                    <option value="missionary">선교사</option>
                                                                    <option value="leader">인솔자</option>
                                                                    <option value="team_member">팀원</option>
                                                                    <option value="common">공통</option>
                                                                </select>
                                                                <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value as QuestionType })} className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500/20">
                                                                    <option value="scale">척도형</option>
                                                                    <option value="text">서술형</option>
                                                                    <option value="multi_select">복수선택</option>
                                                                </select>
                                                                <input type="text" value={editForm.question_text} onChange={e => setEditForm({ ...editForm, question_text: e.target.value })} className="flex-1 min-w-[200px] text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500/20" />
                                                            </div>
                                                            {(editForm.type === 'multi_select' || (q.options && q.options.length > 0)) && (
                                                                <textarea value={Array.isArray(editForm.options) ? editForm.options.join('\n') : ''} onChange={e => setEditForm({ ...editForm, options: e.target.value.split('\n').filter(l => l.trim()) })} className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white h-20 focus:ring-2 focus:ring-indigo-500/20" placeholder="옵션 (줄별)" />
                                                            )}
                                                            <div className="flex justify-end gap-2">
                                                                <button onClick={() => setEditingId(null)} className="px-4 py-2 text-xs text-slate-500 hover:text-slate-700 hover:bg-white/50 rounded-lg transition-colors">취소</button>
                                                                <button onClick={() => handleSaveQuestion(q.id)} className="px-4 py-2 text-xs bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 shadow-lg shadow-indigo-500/25 font-medium">저장</button>
                                                            </div>
                                                        </div>
                                                    </td>
                                                ) : (
                                                    <>
                                                        <td className="py-3 px-4">
                                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-semibold ${q.role === 'missionary' ? 'bg-amber-100 text-amber-700' : q.role === 'leader' ? 'bg-emerald-100 text-emerald-700' : q.role === 'team_member' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                                                                {q.role === 'missionary' ? '선교사' : q.role === 'leader' ? '인솔자' : q.role === 'team_member' ? '팀원' : '공통'}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-semibold ${q.type === 'scale' ? 'bg-purple-100 text-purple-700' : q.type === 'text' ? 'bg-cyan-100 text-cyan-700' : 'bg-pink-100 text-pink-700'}`}>
                                                                {q.type === 'scale' ? '척도' : q.type === 'text' ? '서술' : '복수'}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <div className="text-slate-800 line-clamp-1">{q.question_text}</div>
                                                            {q.options && q.options.length > 0 && <div className="text-[10px] text-slate-400 truncate mt-0.5">옵션: {q.options.join(', ')}</div>}
                                                        </td>
                                                        <td className="py-3 px-4 text-center">
                                                            <button onClick={() => handleToggleHidden(q)} className={`w-9 h-5 rounded-full relative transition-colors ${q.is_hidden ? 'bg-slate-200' : 'bg-gradient-to-r from-emerald-400 to-teal-500'}`} title={q.is_hidden ? '숨김' : '표시'}>
                                                                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-md transition-transform ${q.is_hidden ? 'left-0.5' : 'left-4'}`}></span>
                                                            </button>
                                                        </td>
                                                        <td className="py-3 px-4 text-right">
                                                            <button onClick={() => { setEditingId(q.id); setEditForm(q); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="수정">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                            </button>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                            {filteredQuestions.length === 0 && !loading && <div className="text-center py-12 text-slate-400">{questions.length === 0 ? '문항이 없습니다.' : '조건에 맞는 문항이 없습니다.'}</div>}
                        </div>
                    </div>
                )}

                {activeTab === 'teams' && (
                    <div className="space-y-4">
                        {/* Actions */}
                        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex items-center justify-between">
                            <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-lg">팀 <span className="font-semibold text-slate-700">{teams.length}</span>개</span>
                            <div className="flex gap-2">
                                <button onClick={handleInitialTeamsLoad} className="px-4 py-2 text-xs bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors font-medium">초기 데이터</button>
                                <button onClick={() => { setEditingTeam({} as TeamInfo); setTeamForm({}); }} className="px-4 py-2 text-xs bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/25 font-medium">새 팀</button>
                            </div>
                        </div>

                        {/* Edit Form */}
                        {editingTeam !== null && (
                            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                                <h3 className="font-semibold text-slate-800 text-sm mb-4 flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                    </div>
                                    {editingTeam.id ? '팀 수정' : '새 팀'}
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                                    <input type="text" placeholder="국가" value={teamForm.country || ''} onChange={e => setTeamForm({ ...teamForm, country: e.target.value })} className="text-slate-800 border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all placeholder:text-slate-400" />
                                    <input type="text" placeholder="팀명 (Dept)" value={teamForm.dept || ''} onChange={e => setTeamForm({ ...teamForm, dept: e.target.value })} className="text-slate-800 border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all placeholder:text-slate-400" />
                                    <input type="text" placeholder="선교사" value={teamForm.missionary || ''} onChange={e => setTeamForm({ ...teamForm, missionary: e.target.value })} className="text-slate-800 border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all placeholder:text-slate-400" />
                                    <input type="text" placeholder="팀장" value={teamForm.leader || ''} onChange={e => setTeamForm({ ...teamForm, leader: e.target.value })} className="text-slate-800 border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all placeholder:text-slate-400" />
                                    <input type="text" placeholder="기간" value={teamForm.period || ''} onChange={e => setTeamForm({ ...teamForm, period: e.target.value })} className="text-slate-800 border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all placeholder:text-slate-400" />
                                    <input type="text" placeholder="멤버" value={teamForm.members || ''} onChange={e => setTeamForm({ ...teamForm, members: e.target.value })} className="text-slate-800 border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all placeholder:text-slate-400" />
                                    <textarea placeholder="설명" value={teamForm.content || ''} onChange={e => setTeamForm({ ...teamForm, content: e.target.value })} className="col-span-full text-slate-800 border border-slate-300 rounded-lg px-3 py-2 bg-white h-20 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all placeholder:text-slate-400" />
                                </div>
                                <div className="flex justify-end gap-2 mt-4">
                                    <button onClick={() => { setEditingTeam(null); setTeamForm({}); }} className="px-4 py-2 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">취소</button>
                                    <button onClick={handleSaveTeam} className="px-4 py-2 text-xs bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/25 font-medium">저장</button>
                                </div>
                            </div>
                        )}

                        {/* Table */}
                        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                            <table className="w-full text-xs" role="table" aria-label="선교 팀 목록">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th scope="col" className="text-left py-3 px-4 font-semibold text-slate-600">국가</th>
                                        <th scope="col" className="text-left py-3 px-4 font-semibold text-slate-600">선교사</th>
                                        <th scope="col" className="text-left py-3 px-4 font-semibold text-slate-600">팀장</th>
                                        <th scope="col" className="text-left py-3 px-4 font-semibold text-slate-600">기간</th>
                                        <th scope="col" className="text-right py-3 px-4 font-semibold text-slate-600"><span className="sr-only">작업</span></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {teams.map(team => (
                                        <tr key={team.id || team.missionary} className="hover:bg-emerald-50/30 transition-colors">
                                            <td className="py-3 px-4">
                                                <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-lg text-[10px] font-medium">{team.country}</span>
                                            </td>
                                            <td className="py-3 px-4 font-medium text-slate-800">{team.missionary || '-'}</td>
                                            <td className="py-3 px-4 text-slate-600">{team.leader || '-'}</td>
                                            <td className="py-3 px-4 text-slate-500">{team.period || '-'}</td>
                                            <td className="py-3 px-4 text-right">
                                                <button onClick={() => { setEditingTeam(team); setTeamForm(team); }} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {teams.length === 0 && <div className="text-center py-12 text-slate-400">등록된 팀이 없습니다.</div>}
                        </div>
                    </div>
                )}

                {activeTab === 'admins' && (
                    <div className="space-y-4">
                        {/* Actions */}
                        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex items-center gap-3">
                            <div className="relative flex-1">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" /></svg>
                                <input type="email" placeholder="이메일 주소" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddAdmin()} className="w-full text-xs text-slate-800 border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-all placeholder:text-slate-400" />
                            </div>
                            <button onClick={handleAddAdmin} className="px-5 py-2.5 text-xs bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl hover:from-amber-600 hover:to-orange-700 transition-all shadow-lg shadow-amber-500/25 font-medium">추가</button>
                        </div>

                        {/* Table */}
                        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                            <table className="w-full text-xs" role="table" aria-label="관리자 목록">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th scope="col" className="text-left py-3 px-4 font-semibold text-slate-600">이메일</th>
                                        <th scope="col" className="text-left py-3 px-4 font-semibold text-slate-600">추가일</th>
                                        <th scope="col" className="text-left py-3 px-4 font-semibold text-slate-600">추가자</th>
                                        <th scope="col" className="text-right py-3 px-4 font-semibold text-slate-600"><span className="sr-only">작업</span></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {admins.map(admin => (
                                        <tr key={admin.email} className="hover:bg-amber-50/30 transition-colors">
                                            <td className="py-3 px-4">
                                                <span className="font-medium text-slate-800">{admin.email}</span>
                                                {admin.email === user?.email && <span className="ml-2 text-[9px] bg-gradient-to-r from-amber-500 to-orange-500 text-white px-1.5 py-0.5 rounded-md font-semibold">YOU</span>}
                                            </td>
                                            <td className="py-3 px-4 text-slate-600">{new Date(admin.created_at).toLocaleDateString('ko-KR')}</td>
                                            <td className="py-3 px-4 text-slate-500">{admin.added_by || '-'}</td>
                                            <td className="py-3 px-4 text-right">
                                                <button onClick={() => handleDeleteAdmin(admin.email)} disabled={admin.email === user?.email} className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${admin.email === user?.email ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>해제</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {admins.length === 0 && <div className="text-center py-12 text-slate-400">등록된 관리자가 없습니다.</div>}
                        </div>

                        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50 rounded-2xl p-4 text-xs text-amber-700 flex items-start gap-3">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <div>
                                <p className="font-semibold text-amber-800 mb-1">관리자 권한 안내</p>
                                <p>관리자로 추가된 이메일은 Google OAuth 로그인 시 대시보드와 설정 페이지에 접근할 수 있습니다.</p>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
