import type { TourLeader } from '@/types';

export function formatTourLeaderLabel(leader: TourLeader): string {
  return `${leader.group_number}조 ${leader.name}`;
}

export function getTourLeaderByName(leaders: TourLeader[], name: string): TourLeader | null {
  return leaders.find(leader => leader.name === name) || null;
}

export function getTourLeaderByQuery(leaders: TourLeader[], query: string): TourLeader | null {
  const normalized = query.trim();
  return (
    leaders.find(leader => formatTourLeaderLabel(leader) === normalized) ||
    leaders.find(leader => leader.name === normalized) ||
    null
  );
}

export function searchTourLeaders(leaders: TourLeader[], query: string): TourLeader[] {
  const normalized = query.trim().replace(/\s+/g, '').toLowerCase();
  if (!normalized) {
    return leaders;
  }

  return leaders.filter(leader => {
    const groupMatch = `${leader.group_number}조`.includes(normalized) || String(leader.group_number).includes(normalized);
    const nameMatch = leader.name.toLowerCase().includes(normalized);
    const labelMatch = formatTourLeaderLabel(leader).replace(/\s+/g, '').toLowerCase().includes(normalized);
    return groupMatch || nameMatch || labelMatch;
  });
}
