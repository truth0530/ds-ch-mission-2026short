import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Question, TeamInfo } from '@/lib/surveyData';

interface SurveyFormViewProps {
    role: string;
    team: TeamInfo | null;
    questions: Question[];
    onSubmit: (data: any) => void;
    onBack: () => void;
    initialData?: any;
}

export default function SurveyFormView({ role, team, questions, onSubmit, onBack, initialData = {} }: SurveyFormViewProps) {
    const [answers, setAnswers] = useState<any>(initialData);
    const [respondentName, setRespondentName] = useState('');
    const [errors, setErrors] = useState<string[]>([]);

    // Smooth scroll to first error
    useEffect(() => {
        if (errors.length > 0) {
            const el = document.getElementById(errors[0]);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [errors]);

    const handleAnswerChange = (id: string, value: any) => {
        setAnswers((prev: any) => ({ ...prev, [id]: value }));
        // Clear error if exists
        if (errors.includes(id)) {
            setErrors(prev => prev.filter(e => e !== id));
        }
    };

    const validate = () => {
        const newErrors: string[] = [];
        questions.forEach(q => {
            const val = answers[q.id];
            if (!val || (Array.isArray(val) && val.length === 0) || (typeof val === 'string' && !val.trim())) {
                newErrors.push(q.id);
            }
        });
        setErrors(newErrors);
        return newErrors.length === 0;
    };

    const handleSubmit = () => {
        if (validate()) {
            onSubmit({ answers, respondent_name: respondentName });
        } else {
            alert('작성하지 않은 문항이 있습니다. 확인해주세요.');
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col min-h-screen bg-slate-50"
        >
            {/* Header */}
            <div className="sticky top-16 bg-white/90 backdrop-blur-md z-20 px-4 py-4 border-b border-indigo-100 shadow-sm">
                <div className="max-w-xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <div>
                            <h2 className="text-sm font-bold text-indigo-600">
                                {role === '선교사' ? '단기선교팀 평가' : role === '인솔자' ? '인솔자 사역 평가' : '선교사님 평가'}
                            </h2>
                            <p className="text-xs text-slate-500 line-clamp-1">
                                {team ? `${team.missionary} (${team.country})` : role === '인솔자' ? 'Leader Survey' : 'Missionary Survey'}
                            </p>
                        </div>
                    </div>
                    <div className="text-xs font-medium px-3 py-1 bg-slate-100 rounded-full text-slate-600">
                        {Object.keys(answers).length} / {questions.length} 완료
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-4 lg:p-8 max-w-xl mx-auto w-full">
                <div className="space-y-8">
                    {questions.map((q, idx) => (
                        <div
                            key={q.id}
                            id={q.id}
                            className={`scroll-mt-24 transition-all duration-300 ${errors.includes(q.id) ? 'p-4 -m-4 bg-red-50 rounded-2xl ring-2 ring-red-100' : ''}`}
                        >
                            <label className="block text-slate-800 font-bold mb-3 leading-relaxed">
                                <span className={`mr-2 ${errors.includes(q.id) ? 'text-red-500' : 'text-indigo-600'}`}>Q{idx + 1}.</span>
                                {q.text}
                            </label>

                            {q.type === 'scale' && (
                                <ScaleInput
                                    value={answers[q.id]}
                                    onChange={v => handleAnswerChange(q.id, v)}
                                />
                            )}

                            {q.type === 'multi_select' && (
                                <MultiSelectInput
                                    options={q.options || []}
                                    value={answers[q.id] || []}
                                    onChange={v => handleAnswerChange(q.id, v)}
                                />
                            )}

                            {q.type === 'text' && (
                                <textarea
                                    value={answers[q.id] || ''}
                                    onChange={e => handleAnswerChange(q.id, e.target.value)}
                                    placeholder="내용을 자유롭게 작성해주세요."
                                    className="w-full p-4 min-h-[120px] bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none shadow-sm text-slate-700 placeholder-slate-400 resize-none"
                                />
                            )}

                            {errors.includes(q.id) && (
                                <p className="mt-2 text-sm text-red-500 font-medium flex items-center gap-1">
                                    ⚠️ 필수 항목입니다.
                                </p>
                            )}
                        </div>
                    ))}
                </div>

                {/* Submit Button (Static) */}
                <div className="mt-12 mb-8 flex justify-center">
                    <button
                        onClick={handleSubmit}
                        className="w-full max-w-xl py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-indigo-200 transition-all active:scale-[0.98]"
                    >
                        평가 제출하기
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

// Sub-components for cleaner file

function ScaleInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
                {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                    <button
                        key={num}
                        onClick={() => onChange(num)}
                        className={`
                            relative w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all
                            ${value === num
                                ? 'bg-indigo-600 text-white shadow-md scale-110 z-10'
                                : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}
                        `}
                    >
                        {num}
                        {value === num && (
                            <motion.div
                                layoutId="scale-ring"
                                className="absolute inset-0 border-2 border-white rounded-full"
                            />
                        )}
                    </button>
                ))}
            </div>
            <div className="flex justify-between text-xs font-medium text-slate-400 px-2">
                <span>매우 부족</span>
                <span>매우 우수</span>
            </div>
        </div>
    );
}

function MultiSelectInput({ options, value, onChange }: { options: string[], value: string[], onChange: (v: string[]) => void }) {
    // Extract 'Other' text if it exists
    const otherOption = value.find(v => v.startsWith('기타:'));
    const otherText = otherOption ? otherOption.replace('기타:', '').trim() : '';

    const toggle = (opt: string) => {
        if (opt === '기타') {
            if (otherOption) {
                // If unchecking 'Other', remove the '기타:...' entry
                onChange(value.filter(v => !v.startsWith('기타')));
            } else {
                // If checking 'Other', add '기타:' placeholder
                onChange([...value, '기타:']);
            }
        } else {
            if (value.includes(opt)) onChange(value.filter(v => v !== opt));
            else onChange([...value, opt]);
        }
    };

    const handleOtherTextChange = (text: string) => {
        // Remove existing 'Other' entry and add updated one
        const newValue = value.filter(v => !v.startsWith('기타'));
        newValue.push(`기타: ${text}`);
        onChange(newValue);
    };

    return (
        <div className="grid gap-3">
            {options.map((opt) => {
                const isOther = opt === '기타';
                const isSelected = isOther ? !!otherOption : value.includes(opt);

                return (
                    <div key={opt}>
                        <button
                            onClick={() => toggle(opt)}
                            className={`
                                w-full p-4 rounded-xl text-left transition-all border flex items-center gap-3
                                ${isSelected
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}
                            `}
                        >
                            <div className={`
                                w-6 h-6 rounded-md border flex items-center justify-center transition-colors
                                ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}
                            `}>
                                {isSelected && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <span className="text-sm font-medium">{opt}</span>
                        </button>

                        {isOther && isSelected && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="mt-2 ml-2 pl-4 border-l-2 border-indigo-100"
                            >
                                <input
                                    type="text"
                                    value={otherText}
                                    onChange={(e) => handleOtherTextChange(e.target.value)}
                                    placeholder="기타 사유를 입력해주세요..."
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-700 text-sm"
                                    autoFocus
                                />
                            </motion.div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
