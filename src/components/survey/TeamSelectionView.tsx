'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TeamInfo } from '@/types';
import { getBadgeColor, sortTeamsByDeptAndDate } from '@/lib/utils';

interface TeamSelectionViewProps {
    teams: TeamInfo[];
    onSelect: (team: TeamInfo) => void;
    onBack: () => void;
}

export default function TeamSelectionView({ teams, onSelect, onBack }: TeamSelectionViewProps) {
    const [searchTerm, setSearchTerm] = useState('');

    // Memoized filtering and sorting for performance optimization
    const sortedTeams = useMemo(() => {
        const filtered = teams.filter(t =>
            t.missionary.includes(searchTerm) ||
            t.country.includes(searchTerm) ||
            t.leader.includes(searchTerm) ||
            t.dept.includes(searchTerm)
        );

        return sortTeamsByDeptAndDate(filtered);
    }, [teams, searchTerm]);

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col min-h-screen bg-slate-50"
        >
            <div className="sticky top-0 bg-slate-50/80 backdrop-blur-md z-10 px-6 pt-6 pb-4 border-b border-slate-200/50">
                <div className="max-w-md mx-auto">
                    <div className="relative flex items-center justify-center mb-4">
                        <button onClick={onBack} className="absolute left-0 p-2 -ml-2 text-slate-400 hover:text-slate-600" aria-label="뒤로 가기">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <h2 className="text-lg font-bold text-slate-800">사역팀 선택</h2>
                    </div>

                    <div className="relative">
                        <label htmlFor="team-search" className="sr-only">선교사님 이름 또는 국가 검색</label>
                        <input
                            id="team-search"
                            type="text"
                            placeholder="선교사님 이름 또는 국가 검색..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
                        />
                        <svg className="w-5 h-5 text-slate-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                </div>
            </div>

            <div className="flex-1 p-6 max-w-md mx-auto w-full overflow-y-auto">
                <div className="space-y-3">
                    {sortedTeams.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                            검색 결과가 없습니다.
                        </div>
                    ) : (
                        sortedTeams.map((team, idx) => (
                            <button
                                key={team.id || `${team.missionary}-${idx}`}
                                onClick={() => onSelect(team)}
                                className="w-full p-5 bg-white rounded-2xl shadow-sm border border-slate-100 hover:border-indigo-500 hover:shadow-md transition-all text-left group"
                                aria-label={`${team.country} - ${team.missionary} 선교사님 팀 선택`}
                            >
                                <div className="flex items-center gap-4">
                                    {/* Left: Country Circle */}
                                    <div className="flex-shrink-0 w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100 group-hover:bg-indigo-100 group-hover:border-indigo-200 transition-colors">
                                        <span className="text-sm font-bold text-indigo-700 text-center leading-tight break-keep px-1">
                                            {team.country}
                                        </span>
                                    </div>

                                    {/* Right: Info */}
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-lg font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                                                    인솔 {team.leader}
                                                </h3>
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded border text-[10px] uppercase tracking-wider ${getBadgeColor(team.dept)}`}>
                                                    {team.dept}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-sm text-slate-500 mb-2 font-medium">
                                            {team.missionary}
                                        </div>
                                        <div className="text-xs text-slate-400 flex items-center gap-2">
                                            <span>🗓 {team.period}</span>
                                            <span>👥 {team.members}</span>
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </motion.div>
    );
}
