'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Question, TeamInfo, RoleType } from '@/types';
import { SurveyFormData } from '@/types/survey';
import { sanitizeInput } from '@/lib/validators';

interface SurveyFormViewProps {
    role: RoleType;
    team: TeamInfo | null;
    questions: Question[];
    onSubmit: (data: SurveyFormData) => void;
    onBack: () => void;
    initialData?: Record<string, string | number | string[]>;
}

export default function SurveyFormView({
    role,
    team,
    questions,
    onSubmit,
    onBack,
    initialData = {}
}: SurveyFormViewProps) {
    const [answers, setAnswers] = useState<Record<string, string | number | string[]>>(initialData);
    const [errors, setErrors] = useState<string[]>([]);
    const [showValidationError, setShowValidationError] = useState(false);

    // Smooth scroll to first error
    useEffect(() => {
        if (errors.length > 0) {
            const el = document.getElementById(errors[0]);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [errors]);

    const handleAnswerChange = useCallback((id: string, value: string | number | string[]) => {
        setAnswers(prev => ({ ...prev, [id]: value }));
        // Clear error if exists
        if (errors.includes(id)) {
            setErrors(prev => prev.filter(e => e !== id));
        }
        setShowValidationError(false);
    }, [errors]);

    const validate = useCallback((): boolean => {
        const newErrors: string[] = [];

        questions.forEach(q => {
            const val = answers[q.id];
            if (val === undefined || val === null ||
                (Array.isArray(val) && val.length === 0) ||
                (typeof val === 'string' && !val.trim())) {
                newErrors.push(q.id);
            }
        });
        setErrors(newErrors);
        return newErrors.length === 0;
    }, [questions, answers]);

    const handleSubmit = useCallback(() => {
        if (validate()) {
            onSubmit({ answers });
        } else {
            setShowValidationError(true);
        }
    }, [validate, onSubmit, answers]);

    const getBadgeColor = (dept: string): string => {
        if (dept.includes('15252')) return 'bg-rose-100 text-rose-700 border-rose-200';
        if (dept.includes('청년')) return 'bg-blue-100 text-blue-700 border-blue-200';
        if (dept.includes('교육')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        if (dept.includes('오픈')) return 'bg-amber-100 text-amber-700 border-amber-200';
        if (dept.includes('글로벌')) return 'bg-violet-100 text-violet-700 border-violet-200';
        return 'bg-slate-100 text-slate-600 border-slate-200';
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col min-h-screen bg-slate-50"
        >
            {/* Header */}
            <div className="sticky top-0 bg-white/90 backdrop-blur-md z-20 px-4 py-3 border-b border-indigo-100 shadow-sm">
                <div className="max-w-xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>

                        {team ? (
                            <div className="flex items-center gap-3">
                                {/* Country Circle */}
                                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100 flex-shrink-0">
                                    <span className="text-xs font-bold text-indigo-700 text-center leading-none px-0.5 break-keep">
                                        {team.country}
                                    </span>
                                </div>
                                {/* Info */}
                                <div>
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <h2 className="text-sm font-bold text-slate-800 leading-none">인솔 {team.leader}</h2>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider leading-none ${getBadgeColor(team.dept)}`}>
                                            {team.dept}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium leading-none">{team.missionary}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                {/* Role Icon Circle */}
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center border flex-shrink-0 ${role === '선교사' ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
                                    {role === '선교사' ? (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                                        </svg>
                                    )}
                                </div>
                                {/* Info */}
                                <div>
                                    <h2 className={`text-sm font-bold leading-none mb-1 ${role === '선교사' ? 'text-blue-900' : 'text-emerald-900'}`}>
                                        {role === '선교사' ? '선교사의 의견입니다' : '인솔자의 의견입니다'}
                                    </h2>
                                    <p className="text-xs text-slate-500 font-medium leading-none">
                                        {role === '선교사' ? '단기선교팀 평가' : '인솔자 사역 평가'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="text-xs font-medium px-3 py-1 bg-slate-100 rounded-full text-slate-600 whitespace-nowrap ml-2">
                        {Object.keys(answers).length}/{questions.length}
                    </div>
                </div>
            </div>

            {/* Validation Error Toast */}
            {showValidationError && errors.length > 0 && (
                <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg animate-bounce">
                    작성하지 않은 문항이 {errors.length}개 있습니다. 확인해주세요.
                </div>
            )}

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
                                {sanitizeInput(q.text)}
                            </label>

                            {q.type === 'scale' && (
                                <ScaleInput
                                    value={answers[q.id] as number}
                                    onChange={v => handleAnswerChange(q.id, v)}
                                />
                            )}

                            {q.type === 'multi_select' && (
                                <MultiSelectInput
                                    options={q.options || []}
                                    value={(answers[q.id] as string[]) || []}
                                    onChange={v => handleAnswerChange(q.id, v)}
                                />
                            )}

                            {q.type === 'text' && (
                                <textarea
                                    value={(answers[q.id] as string) || ''}
                                    onChange={e => handleAnswerChange(q.id, e.target.value)}
                                    placeholder="내용을 자유롭게 작성해주세요."
                                    className="w-full p-4 min-h-[120px] bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none shadow-sm text-slate-700 placeholder-slate-400 resize-none"
                                />
                            )}

                            {errors.includes(q.id) && (
                                <p className="mt-2 text-sm text-red-500 font-medium flex items-center gap-1">
                                    필수 항목입니다.
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

// Sub-components

interface ScaleInputProps {
    value: number | undefined;
    onChange: (v: number) => void;
}

function ScaleInput({ value, onChange }: ScaleInputProps) {
    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
                {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                    <button
                        key={num}
                        type="button"
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

interface MultiSelectInputProps {
    options: string[];
    value: string[];
    onChange: (v: string[]) => void;
}

function MultiSelectInput({ options, value, onChange }: MultiSelectInputProps) {
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
                            type="button"
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
                            <span className="text-sm font-medium">{sanitizeInput(opt)}</span>
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
