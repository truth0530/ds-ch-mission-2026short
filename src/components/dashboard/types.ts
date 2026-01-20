import { Evaluation } from '@/types';

export interface ScaleStats {
    questionId: string;
    questionText: string;
    count: number;
    sum: number;
    average: number;
}

export interface Stats {
    total: number;
    byRole: { missionary: number; leader: number; team_member: number };
    teamMemberByTeam: Record<string, number>;
    missionaries: Evaluation[];
    leaders: Evaluation[];
    scaleAverages: ScaleStats[];
}

export interface FilterState {
    roleFilter: string;
    teamFilter: string;
    countryFilter: string;
    deptFilter: string;
    dateFrom: string;
    dateTo: string;
    searchQuery: string;
}
