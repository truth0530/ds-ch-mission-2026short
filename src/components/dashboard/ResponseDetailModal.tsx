'use client';

import { Evaluation } from '@/types';
import { getQuestionText, getQuestionType } from '@/lib/surveyData';
import { sanitizeInput } from '@/lib/validators';

interface ResponseDetailModalProps {
    evaluation: Evaluation;
    index: number;
    totalCount: number;
    onClose: () => void;
    onPrev: () => void;
    onNext: () => void;
    canGoPrev: boolean;
    canGoNext: boolean;
}

export function ResponseDetailModal({
    evaluation,
    index,
    totalCount,
    onClose,
    onPrev,
    onNext,
    canGoPrev,
    canGoNext,
}: ResponseDetailModalProps) {
    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label="응답 상세 정보"
        >
            <div
                className="bg-white rounded-lg max-w-3xl w-full max-h-[85vh] overflow-hidden shadow-xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h3 className="font-bold text-gray-900">응답 상세</h3>
                        <span className="text-xs text-gray-400">{index + 1} / {totalCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={onPrev}
                            disabled={!canGoPrev}
                            className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30"
                            title="이전 (←)"
                            aria-label="이전 응답"
                        >
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <button
                            onClick={onNext}
                            disabled={!canGoNext}
                            className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30"
                            title="다음 (→)"
                            aria-label="다음 응답"
                        >
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                        <div className="w-px h-4 bg-gray-200 mx-1" aria-hidden="true" />
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-gray-100 rounded"
                            title="닫기 (Esc)"
                            aria-label="모달 닫기"
                        >
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="overflow-y-auto max-h-[calc(85vh-56px)]">
                    {/* Meta Info */}
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 grid grid-cols-3 md:grid-cols-6 gap-3 text-xs">
                        <div><span className="text-gray-400 block">역할</span><span className="font-medium text-gray-800">{evaluation.role}</span></div>
                        <div><span className="text-gray-400 block">팀</span><span className="font-medium text-gray-800">{evaluation.team_missionary || '-'}</span></div>
                        <div><span className="text-gray-400 block">국가</span><span className="font-medium text-gray-800">{evaluation.team_country || '-'}</span></div>
                        <div><span className="text-gray-400 block">부서</span><span className="font-medium text-gray-800">{evaluation.team_dept || '-'}</span></div>
                        <div><span className="text-gray-400 block">응답자</span><span className="font-medium text-gray-800">{evaluation.respondent_name || '익명'}</span></div>
                        <div><span className="text-gray-400 block">제출일</span><span className="font-medium text-gray-800">{new Date(evaluation.created_at).toLocaleString('ko-KR')}</span></div>
                    </div>

                    {/* Answers */}
                    <div className="p-4 space-y-2">
                        {Object.entries(evaluation.answers || {}).map(([key, value]) => {
                            const questionText = getQuestionText(key);
                            const questionType = getQuestionType(key);
                            const isScale = questionType === 'scale';

                            return (
                                <div key={key} className="p-3 bg-gray-50 rounded-lg">
                                    <div className="text-xs text-gray-500 mb-1">{sanitizeInput(questionText)}</div>
                                    <div className={`font-medium ${isScale ? 'text-blue-600 text-lg' : 'text-gray-800 text-sm'}`}>
                                        {isScale ? (
                                            <span>{sanitizeInput(String(value))} <span className="text-xs font-normal text-gray-400">/ 7</span></span>
                                        ) : (
                                            Array.isArray(value) ? value.map(v => sanitizeInput(String(v))).join(', ') : sanitizeInput(String(value))
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={onPrev}
                                disabled={!canGoPrev}
                                className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-30 flex items-center gap-1"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                                </svg>
                                이전
                            </button>
                            <button
                                onClick={onNext}
                                disabled={!canGoNext}
                                className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-30 flex items-center gap-1"
                            >
                                다음
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                            <span className="text-[10px] text-gray-400 ml-2">키보드: ← → Esc</span>
                        </div>
                        <button
                            onClick={onClose}
                            className="px-4 py-1.5 text-xs bg-gray-900 text-white rounded hover:bg-gray-800"
                        >
                            닫기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
