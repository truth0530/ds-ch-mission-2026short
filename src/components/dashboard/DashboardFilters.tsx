'use client';

import { FilterState } from './types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface DashboardFiltersProps {
    filters: FilterState;
    onFilterChange: (key: keyof FilterState, value: string) => void;
    onReset: () => void;
    uniqueTeams: string[];
    uniqueCountries: string[];
    uniqueDepts: string[];
}

export function DashboardFilters({
    filters,
    onFilterChange,
    onReset,
    uniqueTeams,
    uniqueCountries,
    uniqueDepts,
}: DashboardFiltersProps) {
    return (
        <Card className="px-4 py-3 mb-4">
            <div className="flex flex-wrap items-center gap-3">
                {/* Team Filter */}
                <Select value={filters.teamFilter} onValueChange={(value) => onFilterChange('teamFilter', value)}>
                    <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="전체 팀" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">전체 팀</SelectItem>
                        {uniqueTeams.map(team => (
                            <SelectItem key={team} value={team}>{team}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Country Filter */}
                <Select value={filters.countryFilter} onValueChange={(value) => onFilterChange('countryFilter', value)}>
                    <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="전체 국가" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">전체 국가</SelectItem>
                        {uniqueCountries.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Dept Filter */}
                <Select value={filters.deptFilter} onValueChange={(value) => onFilterChange('deptFilter', value)}>
                    <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="전체 부서" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">전체 부서</SelectItem>
                        {uniqueDepts.map(d => (
                            <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Date Range */}
                <div className="flex items-center gap-2">
                    <Input
                        type="date"
                        value={filters.dateFrom}
                        onChange={e => onFilterChange('dateFrom', e.target.value)}
                        className="w-36"
                        aria-label="시작일"
                    />
                    <span className="text-muted-foreground">~</span>
                    <Input
                        type="date"
                        value={filters.dateTo}
                        onChange={e => onFilterChange('dateTo', e.target.value)}
                        className="w-36"
                        aria-label="종료일"
                    />
                </div>

                {/* Search */}
                <Input
                    type="text"
                    placeholder="이름/이메일 검색"
                    value={filters.searchQuery}
                    onChange={e => onFilterChange('searchQuery', e.target.value)}
                    className="w-40"
                    aria-label="검색"
                />

                {/* Reset Button */}
                <Button variant="ghost" onClick={onReset}>
                    초기화
                </Button>
            </div>
        </Card>
    );
}
