'use client';

import { Evaluation } from '@/types';
import { getRoleBadgeColor, formatDateKR } from '@/lib/utils';

interface TextAnswer {
    evaluation: Evaluation;
    answer: string;
}

interface TextAnswersModalProps {
    questionId: string;
    questionText: string;
    answers: TextAnswer[];
    onClose: () => void;
    roleFilter: string;
    onRoleFilterChange: (role: string) => void;
    roleCounts: {
        total: number;
        missionary: number;
        leader: number;
        team_member: number;
    };
}

export function TextAnswersModal({
    questionId,
    questionText,
    answers,
    onClose,
    roleFilter,
    onRoleFilterChange,
    roleCounts,
}: TextAnswersModalProps) {
    const filteredAnswers = roleFilter === 'all'
        ? answers
        : answers.filter(a => a.evaluation.role === roleFilter);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col relative z-10">
                {/* Header */}
                <div className="p-4 border-b border-slate-200">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <h2 className="text-base font-bold text-slate-800 mb-1">주관식 답변</h2>
                            <p className="text-sm text-slate-600 line-clamp-2">{questionText}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Role Filter Cards */}
                    <div className="grid grid-cols-4 gap-2 mt-4">
                        <button
                            onClick={() => onRoleFilterChange('all')}
                            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${roleFilter === 'all' ? 'bg-slate-200 text-slate-800' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                        >
                            전체 <span className="font-bold">{roleCounts.total}</span>
                        </button>
                        <button
                            onClick={() => onRoleFilterChange('선교사')}
                            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${roleFilter === '선교사' ? 'bg-amber-100 text-amber-700' : 'bg-slate-50 text-slate-500 hover:bg-amber-50'}`}
                        >
                            선교사 <span className="font-bold">{roleCounts.missionary}</span>
                        </button>
                        <button
                            onClick={() => onRoleFilterChange('인솔자')}
                            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${roleFilter === '인솔자' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-50 text-slate-500 hover:bg-emerald-50'}`}
                        >
                            인솔자 <span className="font-bold">{roleCounts.leader}</span>
                        </button>
                        <button
                            onClick={() => onRoleFilterChange('단기선교 팀원')}
                            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${roleFilter === '단기선교 팀원' ? 'bg-blue-100 text-blue-700' : 'bg-slate-50 text-slate-500 hover:bg-blue-50'}`}
                        >
                            팀원 <span className="font-bold">{roleCounts.team_member}</span>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {filteredAnswers.length > 0 ? (
                        <div className="space-y-3">
                            {filteredAnswers.map((item, index) => (
                                <div key={`${item.evaluation.id}-${index}`} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${getRoleBadgeColor(item.evaluation.role)}`}>
                                            {item.evaluation.role}
                                        </span>
                                        <span className="text-xs text-slate-600">
                                            {item.evaluation.respondent_name || '익명'}
                                        </span>
                                        {item.evaluation.team_country && (
                                            <span className="text-xs text-slate-400">
                                                ({item.evaluation.team_country})
                                            </span>
                                        )}
                                        <span className="text-[10px] text-slate-400 ml-auto">
                                            {formatDateKR(item.evaluation.created_at)}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                                        {item.answer}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-slate-400 py-12">
                            {roleFilter === 'all' ? '답변이 없습니다.' : `${roleFilter} 답변이 없습니다.`}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">
                            총 <span className="font-semibold text-slate-700">{filteredAnswers.length}</span>개 답변
                        </span>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-300 transition-colors"
                        >
                            닫기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
