'use client';

import { Evaluation, TeamInfo } from '@/types';
import { Stats } from './types';

interface DashboardSidebarProps {
    teams: TeamInfo[];
    stats: Stats;
    onViewEvaluation: (evaluation: Evaluation, index: number) => void;
    getEvaluationIndex: (id: string) => number;
}

export function DashboardSidebar({
    teams,
    stats,
    onViewEvaluation,
    getEvaluationIndex,
}: DashboardSidebarProps) {
    return (
        <div className="lg:col-span-1 space-y-4">
            {/* Team Breakdown */}
            <div className="bg-white border border-gray-200 rounded-lg">
                <div className="px-3 py-2 border-b border-gray-100 font-semibold text-xs text-gray-700">팀별 제출</div>
                <div className="max-h-48 overflow-y-auto">
                    {teams.map((team, index) => {
                        const count = stats.teamMemberByTeam[team.missionary] || 0;
                        return (
                            <div key={team.id || `team-${index}-${team.missionary}`} className="px-3 py-1.5 flex items-center justify-between text-xs border-b border-gray-50 last:border-0 hover:bg-gray-50">
                                <span className="text-gray-700 truncate flex-1" title={team.missionary}>{team.missionary}</span>
                                <span className={`font-medium ${count > 0 ? 'text-blue-600' : 'text-gray-300'}`}>{count}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Missionary List */}
            <div className="bg-white border border-gray-200 rounded-lg">
                <div className="px-3 py-2 border-b border-gray-100 font-semibold text-xs text-gray-700">선교사 ({stats.missionaries.length})</div>
                <div className="max-h-36 overflow-y-auto">
                    {stats.missionaries.length > 0 ? stats.missionaries.map(m => {
                        const idx = getEvaluationIndex(m.id);
                        return (
                            <div key={m.id} className="px-3 py-1.5 flex items-center justify-between text-xs border-b border-gray-50 last:border-0 hover:bg-gray-50">
                                <span className="text-gray-700">{m.respondent_name || '익명'}</span>
                                <button onClick={() => onViewEvaluation(m, idx >= 0 ? idx : 0)} className="text-blue-500 hover:text-blue-700 text-[10px]">보기</button>
                            </div>
                        );
                    }) : <div className="px-3 py-3 text-center text-gray-400 text-xs">없음</div>}
                </div>
            </div>

            {/* Leader List */}
            <div className="bg-white border border-gray-200 rounded-lg">
                <div className="px-3 py-2 border-b border-gray-100 font-semibold text-xs text-gray-700">인솔자 ({stats.leaders.length})</div>
                <div className="max-h-36 overflow-y-auto">
                    {stats.leaders.length > 0 ? stats.leaders.map(l => {
                        const idx = getEvaluationIndex(l.id);
                        return (
                            <div key={l.id} className="px-3 py-1.5 flex items-center justify-between text-xs border-b border-gray-50 last:border-0 hover:bg-gray-50">
                                <span className="text-gray-700">{l.respondent_name || '익명'}</span>
                                <button onClick={() => onViewEvaluation(l, idx >= 0 ? idx : 0)} className="text-blue-500 hover:text-blue-700 text-[10px]">보기</button>
                            </div>
                        );
                    }) : <div className="px-3 py-3 text-center text-gray-400 text-xs">없음</div>}
                </div>
            </div>
        </div>
    );
}
