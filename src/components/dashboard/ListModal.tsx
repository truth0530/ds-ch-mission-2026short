'use client';

import { Evaluation } from '@/types';

interface ListModalProps {
    title: string;
    evaluations: Evaluation[];
    onClose: () => void;
    onViewDetail: (evaluation: Evaluation, index: number) => void;
}

export function ListModal({
    title,
    evaluations,
    onClose,
    onViewDetail,
}: ListModalProps) {
    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={title}
        >
            <div
                className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h3 className="font-bold text-gray-900">{title}</h3>
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{evaluations.length}건</span>
                    </div>
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

                {/* List Content */}
                <div className="overflow-y-auto max-h-[calc(80vh-56px)]">
                    {evaluations.length > 0 ? (
                        <table className="w-full text-xs">
                            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                                <tr>
                                    <th scope="col" className="text-left py-2 px-4 font-medium text-gray-600">역할</th>
                                    <th scope="col" className="text-left py-2 px-4 font-medium text-gray-600">팀</th>
                                    <th scope="col" className="text-left py-2 px-4 font-medium text-gray-600">응답자</th>
                                    <th scope="col" className="text-left py-2 px-4 font-medium text-gray-600">제출일</th>
                                    <th scope="col" className="text-right py-2 px-4 font-medium text-gray-600"><span className="sr-only">상세</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {evaluations.map((evaluation, index) => (
                                    <tr
                                        key={evaluation.id}
                                        className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                                        onClick={() => onViewDetail(evaluation, index)}
                                    >
                                        <td className="py-2 px-4">
                                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                evaluation.role === '선교사' ? 'bg-amber-100 text-amber-700' :
                                                evaluation.role === '인솔자' ? 'bg-emerald-100 text-emerald-700' :
                                                'bg-blue-100 text-blue-700'
                                            }`}>
                                                {evaluation.role === '단기선교 팀원' ? '팀원' : evaluation.role}
                                            </span>
                                        </td>
                                        <td className="py-2 px-4 text-gray-700">{evaluation.team_missionary || '-'}</td>
                                        <td className="py-2 px-4">
                                            <div className="text-gray-800">{evaluation.respondent_name || '익명'}</div>
                                            <div className="text-[10px] text-gray-400">{evaluation.respondent_email || ''}</div>
                                        </td>
                                        <td className="py-2 px-4 text-gray-600">
                                            {evaluation.submission_date ? new Date(evaluation.submission_date).toLocaleDateString('ko-KR') : '-'}
                                        </td>
                                        <td className="py-2 px-4 text-right">
                                            <button className="text-blue-500 hover:text-blue-700 text-[10px]">보기</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="text-center py-12 text-gray-400">데이터가 없습니다.</div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-end bg-white">
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 text-xs bg-gray-900 text-white rounded hover:bg-gray-800"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}
