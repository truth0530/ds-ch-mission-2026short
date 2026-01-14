'use client';

import React, { useEffect, useState } from 'react';
import { MISSIONARY_QUESTIONS, LEADER_QUESTIONS, TEAM_QUESTIONS, Question } from '@/lib/surveyData';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { QuestionType, QuestionsMap } from '@/types';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Lazy client initialization to prevent build-time crashes
let sbClientInstance: SupabaseClient | null = null;
const getSbClient = (): SupabaseClient | null => {
    if (!sbClientInstance && SB_URL && SB_KEY) {
        sbClientInstance = createClient(SB_URL, SB_KEY);
    }
    return sbClientInstance;
};

// DB에서 가져온 질문 데이터 타입
interface DbQuestion {
    id: string;
    type: string;
    question_text: string;
    options?: string[];
    role: string;
}

const QuestionPreview = ({ question }: { question: Question }) => {
    return (
        <div className="mb-6 p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
            <div className="flex items-start gap-4">
                <span className="inline-flex items-center justify-center px-2 py-1 rounded bg-slate-100 text-slate-500 text-[10px] font-bold tracking-wider uppercase">
                    {question.type}
                </span>
                <div className="flex-1">
                    <p className="text-slate-800 font-medium mb-3">{question.text}</p>
                    {question.type === 'scale' && (
                        <div className="flex items-center gap-2 mt-2">
                            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                                <div key={n} className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-xs text-slate-400">
                                    {n}
                                </div>
                            ))}
                            <span className="text-[10px] text-slate-400 ml-2">(7점 척도)</span>
                        </div>
                    )}
                    {question.type === 'multi_select' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                            {question.options?.map((opt, i) => (
                                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded border border-slate-100 bg-slate-50 text-[12px] text-slate-600">
                                    <div className="w-4 h-4 rounded border border-slate-300" />
                                    {opt}
                                </div>
                            ))}
                        </div>
                    )}
                    {question.type === 'text' && (
                        <div className="mt-2 w-full h-16 rounded border border-slate-100 bg-slate-50 flex items-center px-4 text-slate-300 text-[12px]">
                            내용을 입력해주세요... (주관식)
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default function PreviewPage() {
    const [questions, setQuestions] = useState({
        missionary: MISSIONARY_QUESTIONS,
        leader: LEADER_QUESTIONS,
        team_member: TEAM_QUESTIONS
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchQuestions = async () => {
            try {
                const client = getSbClient();
                if (!client) throw new Error('Supabase client not initialized');
                const { data, error } = await client
                    .from('survey_questions')
                    .select('*')
                    .eq('is_hidden', false)
                    .order('sort_order', { ascending: true });

                if (!error && data && data.length > 0) {
                    const qMap: QuestionsMap & { common: Question[] } = { missionary: [], leader: [], team_member: [], common: [] };
                    data.forEach((q: DbQuestion) => {
                        const mappedQ: Question = { id: q.id, type: q.type as QuestionType, text: q.question_text, options: q.options };
                        if (q.role === 'common') qMap.common.push(mappedQ);
                        else if (q.role in qMap) (qMap[q.role as keyof QuestionsMap] as Question[]).push(mappedQ);
                    });
                    setQuestions({
                        missionary: qMap.missionary.length > 0 ? qMap.missionary : MISSIONARY_QUESTIONS,
                        leader: qMap.leader.length > 0 ? [...qMap.leader, ...qMap.common] : LEADER_QUESTIONS,
                        team_member: qMap.team_member.length > 0 ? [...qMap.team_member, ...qMap.common] : TEAM_QUESTIONS
                    });
                }
            } catch (e) {
                console.error('Failed to fetch dynamic questions:', e);
            } finally {
                setLoading(false);
            }
        };

        fetchQuestions();
    }, []);

    return (
        <div className="min-h-screen bg-[#f8fafc] py-12 px-4">
            <div className="max-w-3xl mx-auto">
                <div className="text-center mb-16">
                    <h1 className="text-3xl font-bold text-slate-900 mb-4">설문 문항 미리보기</h1>
                    <p className="text-slate-500">2026 동계 단기선교 사역 평가 시스템의 모든 문항을 확인하실 수 있습니다.</p>
                </div>

                <section className="mb-20">
                    <div className="flex items-center gap-3 mb-8 border-b border-slate-200 pb-4">
                        <h2 className="text-xl font-bold text-blue-600">1. 선교사용 설문</h2>
                        <span className="text-slate-400 text-sm font-normal">({questions.missionary.length} 문항)</span>
                    </div>
                    {questions.missionary.map((q) => <QuestionPreview key={q.id} question={q} />)}
                </section>

                <section className="mb-20">
                    <div className="flex items-center gap-3 mb-8 border-b border-slate-200 pb-4">
                        <h2 className="text-xl font-bold text-blue-600">2. 인솔자용 설문</h2>
                        <span className="text-slate-400 text-sm font-normal">({questions.leader.length} 문항)</span>
                    </div>
                    <div className="p-4 mb-6 bg-blue-50 text-blue-700 rounded-lg text-sm mb-8">
                        인솔자 전용 문항 뒤에 공통 질문이 바로 이어집니다.
                    </div>
                    {questions.leader.map((q) => <QuestionPreview key={q.id} question={q} />)}
                </section>

                <section className="mb-20">
                    <div className="flex items-center gap-3 mb-8 border-b border-slate-200 pb-4">
                        <h2 className="text-xl font-bold text-blue-600">3. 단기선교 팀원용 설문</h2>
                        <span className="text-slate-400 text-sm font-normal">({questions.team_member.length} 문항)</span>
                    </div>
                    <div className="p-4 mb-6 bg-blue-50 text-blue-700 rounded-lg text-sm mb-8">
                        팀원 전용 문항 뒤에 공통 질문이 바로 이어집니다.
                    </div>
                    {questions.team_member.map((q) => <QuestionPreview key={q.id} question={q} />)}
                </section>

                <footer className="text-center text-slate-400 text-sm pt-8 border-t border-slate-200">
                    &copy; 2026 동신세계선교회 단기선교 설문. All rights reserved.
                </footer>
            </div>
        </div>
    );
}
