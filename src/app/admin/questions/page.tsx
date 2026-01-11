'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const sbClient = createClient(SB_URL, SB_KEY);

interface Question {
    id: string;
    role: string;
    type: 'scale' | 'text' | 'multi_select';
    question_text: string;
    options: string[] | null;
    sort_order: number;
    is_hidden: boolean;
}

export default function AdminQuestionsPage() {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Question>>({});
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [password, setPassword] = useState('');

    useEffect(() => {
        if (isAuthorized) fetchQuestions();
    }, [isAuthorized]);

    const fetchQuestions = async () => {
        setLoading(true);
        const { data, error } = await sbClient
            .from('survey_questions')
            .select('*')
            .order('sort_order', { ascending: true });

        if (error) {
            console.error('Error fetching questions:', error);
        } else {
            setQuestions(data || []);
        }
        setLoading(false);
    };

    const handleSave = async (id: string) => {
        const { error } = await sbClient
            .from('survey_questions')
            .update(editForm)
            .eq('id', id);

        if (error) {
            alert('저장 중 오류가 발생했습니다: ' + error.message);
        } else {
            setEditingId(null);
            fetchQuestions();
        }
    };

    const handleToggleHidden = async (q: Question) => {
        const { error } = await sbClient
            .from('survey_questions')
            .update({ is_hidden: !q.is_hidden })
            .eq('id', q.id);

        if (error) {
            alert('업데이트 중 오류가 발생했습니다: ' + error.message);
        } else {
            fetchQuestions();
        }
    };

    const handleAdd = async () => {
        const newId = `new_${Date.now()}`;
        const { error } = await sbClient
            .from('survey_questions')
            .insert([{
                id: newId,
                role: 'common',
                type: 'text',
                question_text: '새로운 문항을 입력하세요',
                sort_order: (questions.length > 0 ? Math.max(...questions.map(q => q.sort_order)) : 0) + 10,
                is_hidden: false
            }]);

        if (error) {
            alert('추가 중 오류가 발생했습니다: ' + error.message);
        } else {
            setEditingId(newId);
            setEditForm({ question_text: '새로운 문항을 입력하세요', role: 'common', type: 'text' });
            fetchQuestions();
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('정말로 삭제하시겠습니까?')) return;
        const { error } = await sbClient
            .from('survey_questions')
            .delete()
            .eq('id', id);

        if (error) {
            alert('삭제 중 오류가 발생했습니다: ' + error.message);
        } else {
            fetchQuestions();
        }
    };

    if (!isAuthorized) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
                <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm">
                    <h1 className="text-2xl font-bold mb-6 text-gray-800">관리자 인증</h1>
                    <input
                        type="password"
                        placeholder="관리자 비밀번호"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                    <button
                        onClick={() => password === 'admin2026' ? setIsAuthorized(true) : alert('틀린 비밀번호입니다.')}
                        className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-200"
                    >
                        로그인
                    </button>
                    <p className="mt-4 text-center text-xs text-gray-400">© 2026 동계 단기선교 설문 시스템</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
            <div className="max-w-5xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">문항 관리 센터</h1>
                        <p className="text-gray-500 mt-1">설문 문항을 추가하고, 수정하며, 노출 여부를 관리합니다.</p>
                    </div>
                    <button
                        onClick={handleAdd}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                        새 문항 추가
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {['missionary', 'leader', 'team_member', 'common'].map(role => {
                            const roleQs = questions.filter(q => q.role === role);
                            if (roleQs.length === 0 && role !== 'common') return null;

                            return (
                                <div key={role} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                        <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wider">
                                            {role === 'missionary' ? '선교사용' : role === 'leader' ? '인솔자용' : role === 'team_member' ? '팀원용' : '공통 문항'}
                                        </h2>
                                        <span className="bg-white text-gray-500 text-xs font-semibold px-2.5 py-1 rounded-full border border-gray-200">{roleQs.length} items</span>
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        {roleQs.map(q => (
                                            <div key={q.id} className={`p-6 transition-colors ${q.is_hidden ? 'bg-gray-50/50 opacity-60' : 'hover:bg-gray-50'}`}>
                                                {editingId === q.id ? (
                                                    <div className="space-y-4">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div>
                                                                <label className="block text-xs font-bold text-gray-400 mb-1 ml-1">ROLE</label>
                                                                <select
                                                                    value={editForm.role}
                                                                    onChange={e => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                                                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                                                >
                                                                    <option value="missionary">missionary</option>
                                                                    <option value="leader">leader</option>
                                                                    <option value="team_member">team_member</option>
                                                                    <option value="common">common</option>
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-bold text-gray-400 mb-1 ml-1">TYPE</label>
                                                                <select
                                                                    value={editForm.type}
                                                                    onChange={e => setEditForm(prev => ({ ...prev, type: e.target.value as any }))}
                                                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                                                >
                                                                    <option value="scale">Scale (1-7)</option>
                                                                    <option value="text">Text (Open Ended)</option>
                                                                    <option value="multi_select">Multi-Select (Options)</option>
                                                                </select>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-gray-400 mb-1 ml-1">QUESTION TEXT</label>
                                                            <textarea
                                                                value={editForm.question_text}
                                                                onChange={e => setEditForm(prev => ({ ...prev, question_text: e.target.value }))}
                                                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                                                            />
                                                        </div>
                                                        {editForm.type === 'multi_select' && (
                                                            <div>
                                                                <label className="block text-xs font-bold text-gray-400 mb-1 ml-1">OPTIONS (COMMA SEPARATED)</label>
                                                                <input
                                                                    type="text"
                                                                    value={(editForm.options || []).join(', ')}
                                                                    onChange={e => setEditForm(prev => ({ ...prev, options: e.target.value.split(',').map(o => o.trim()) }))}
                                                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                                                />
                                                            </div>
                                                        )}
                                                        <div className="flex items-center justify-end gap-3 pt-2">
                                                            <button
                                                                onClick={() => setEditingId(null)}
                                                                className="px-4 py-2 text-gray-500 font-bold hover:text-gray-700 transition"
                                                            >
                                                                취소
                                                            </button>
                                                            <button
                                                                onClick={() => handleSave(q.id)}
                                                                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md shadow-blue-100 transition"
                                                            >
                                                                저장하기
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${q.type === 'scale' ? 'bg-amber-100 text-amber-700' : q.type === 'text' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                                                    {q.type}
                                                                </span>
                                                                <span className="text-[10px] font-mono text-gray-400">ID: {q.id} | Order: {q.sort_order}</span>
                                                            </div>
                                                            <p className="text-gray-800 font-medium text-lg leading-snug">{q.question_text}</p>
                                                            {q.options && q.options.length > 0 && (
                                                                <div className="mt-3 flex flex-wrap gap-1.5">
                                                                    {q.options.map(opt => (
                                                                        <span key={opt} className="text-[11px] bg-gray-100 text-gray-500 px-2 py-1 rounded-md">{opt}</span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <button
                                                                onClick={() => handleToggleHidden(q)}
                                                                className={`p-2 rounded-lg border transition-all ${q.is_hidden ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-500 hover:text-blue-600 hover:border-blue-200'}`}
                                                                title={q.is_hidden ? 'Show Question' : 'Hide Question'}
                                                            >
                                                                {q.is_hidden ? (
                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                                                                ) : (
                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={() => { setEditingId(q.id); setEditForm(q); }}
                                                                className="p-2 bg-white text-gray-500 border rounded-lg hover:text-blue-600 hover:border-blue-200 transition-all"
                                                                title="Edit"
                                                            >
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(q.id)}
                                                                className="p-2 bg-white text-gray-500 border rounded-lg hover:text-red-600 hover:border-red-200 transition-all"
                                                                title="Delete"
                                                            >
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                            </button>
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
        </div>
    );
}
