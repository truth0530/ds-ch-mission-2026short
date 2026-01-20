'use client';

import { FilterState } from './types';

interface DashboardFiltersProps {
    filters: FilterState;
    onFilterChange: (key: keyof FilterState, value: string) => void;
    onReset: () => void;
    uniqueTeams: string[];
    uniqueCountries: string[];
    uniqueDepts: string[];
    filteredCount: number;
    totalCount: number;
}

export function DashboardFilters({
    filters,
    onFilterChange,
    onReset,
    uniqueTeams,
    uniqueCountries,
    uniqueDepts,
    filteredCount,
    totalCount,
}: DashboardFiltersProps) {
    const selectClass = "text-xs border border-gray-200 rounded px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500";

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4">
            <div className="flex flex-wrap items-center gap-2">
                <select
                    value={filters.roleFilter}
                    onChange={e => onFilterChange('roleFilter', e.target.value)}
                    className={selectClass}
                    aria-label="역할 필터"
                >
                    <option value="all">모든 역할</option>
                    <option value="선교사">선교사</option>
                    <option value="인솔자">인솔자</option>
                    <option value="단기선교 팀원">단기선교 팀원</option>
                </select>
                <select
                    value={filters.teamFilter}
                    onChange={e => onFilterChange('teamFilter', e.target.value)}
                    className={selectClass}
                    aria-label="팀 필터"
                >
                    <option value="all">모든 팀</option>
                    {uniqueTeams.map(team => <option key={team} value={team}>{team}</option>)}
                </select>
                <select
                    value={filters.countryFilter}
                    onChange={e => onFilterChange('countryFilter', e.target.value)}
                    className={selectClass}
                    aria-label="국가 필터"
                >
                    <option value="all">모든 국가</option>
                    {uniqueCountries.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                    value={filters.deptFilter}
                    onChange={e => onFilterChange('deptFilter', e.target.value)}
                    className={selectClass}
                    aria-label="부서 필터"
                >
                    <option value="all">모든 부서</option>
                    {uniqueDepts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={e => onFilterChange('dateFrom', e.target.value)}
                    className={selectClass}
                    aria-label="시작일"
                />
                <span className="text-gray-300" aria-hidden="true">~</span>
                <input
                    type="date"
                    value={filters.dateTo}
                    onChange={e => onFilterChange('dateTo', e.target.value)}
                    className={selectClass}
                    aria-label="종료일"
                />
                <input
                    type="text"
                    placeholder="검색..."
                    value={filters.searchQuery}
                    onChange={e => onFilterChange('searchQuery', e.target.value)}
                    className={`${selectClass} w-32`}
                    aria-label="검색"
                />
                <button
                    onClick={onReset}
                    className="text-xs text-gray-400 hover:text-gray-600 px-2"
                    aria-label="필터 초기화"
                >
                    초기화
                </button>
                <div className="flex-1" />
                <span className="text-xs text-gray-500">
                    <span className="font-semibold text-gray-700">{filteredCount}</span> / {totalCount}건
                </span>
            </div>
        </div>
    );
}
