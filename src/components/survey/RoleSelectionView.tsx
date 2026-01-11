import React from 'react';
import { motion } from 'framer-motion';

interface RoleSelectionViewProps {
    onSelect: (role: '선교사' | '인솔자' | '단기선교 팀원') => void;
    onBack: () => void;
}

export default function RoleSelectionView({ onSelect, onBack }: RoleSelectionViewProps) {
    const roles = [
        {
            id: '선교사',
            label: '선교사',
            desc: '현지 선교사님',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            bg: 'bg-emerald-100 text-emerald-600 ring-1 ring-emerald-200'
        },
        {
            id: '인솔자',
            label: '인솔자',
            desc: '팀 인솔 담당자',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                </svg>
            ),
            bg: 'bg-indigo-100 text-indigo-600 ring-1 ring-indigo-200'
        },
        {
            id: '단기선교 팀원',
            label: '단기선교 팀원',
            desc: '팀원으로 참여',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
            ),
            bg: 'bg-orange-100 text-orange-600 ring-1 ring-orange-200'
        },
    ] as const;

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col min-h-screen bg-slate-50"
        >
            <div className="sticky top-0 bg-slate-50/80 backdrop-blur-md z-10 p-6 border-b border-slate-200/50">
                <div className="max-w-md mx-auto relative flex items-center justify-center">
                    <button onClick={onBack} className="absolute left-0 p-2 -ml-2 text-slate-400 hover:text-slate-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <h2 className="text-lg font-bold text-slate-800">역할 선택</h2>
                </div>
            </div>

            <div className="flex-1 p-6 flex flex-col items-center max-w-md mx-auto w-full">
                <div className="mb-8 text-center pt-8">
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">어떤 역할로 참여하셨나요?</h1>
                    <p className="text-slate-500">본인의 사역 역할을 선택해 주세요.</p>
                </div>

                <div className="w-full space-y-4">
                    {roles.map((role) => (
                        <button
                            key={role.id}
                            onClick={() => onSelect(role.id)}
                            className="w-full p-5 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5 hover:border-indigo-500 hover:shadow-md hover:scale-[1.02] transition-all group text-left relative overflow-hidden"
                        >
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${role.bg}`}>
                                {role.icon}
                            </div>
                            <div className="flex-1 z-10">
                                <h3 className="font-bold text-slate-800 text-lg group-hover:text-indigo-600 transition-colors">{role.label}</h3>
                                <p className="text-sm text-slate-400 mt-0.5">{role.desc}</p>
                            </div>
                            <div className="text-slate-300 group-hover:text-indigo-500 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </motion.div>
    );
}
