import { TeamInfo, Question as BaseQuestion, RoleKey } from '@/types';

// Re-export for backwards compatibility
export type { TeamInfo };

// Local Question type that extends base with string role for static data
export interface Question extends Omit<BaseQuestion, 'role'> {
    role?: RoleKey | string;
}

export const MISSION_TEAMS: TeamInfo[] = [
    { dept: '15252', leader: '강성택 목사', country: '요르단', missionary: '김축복 선교사', period: '2/9-18', members: '6명', content: '난민사역, 교회 간증, 성경지리 탐방' },
    { dept: '15252', leader: '심중섭 목사', country: '이집트', missionary: '여호수아 선교사', period: '2/12-20', members: '6명', content: '난민사역, 교회 간증, 성경지리 탐방' },
    { dept: '15252', leader: '김성일 목사', country: '튀르키예', missionary: '김다니엘 선교사', period: '3/26-4/3', members: '8명', content: 'BCC 사역, 성경지리 탐방' },
    { dept: '청년부', leader: '박찬영 목사', country: '엘살바도르', missionary: '최정환 선교사', period: '2/12-21', members: '8명', content: '현지 대학생 전도, 지역교회 캠프' },
    { dept: '청년부', leader: '권신애 전도사', country: '말레이시아', missionary: 'MK캠프', period: '1/31-8', members: '7명', content: '선양하나 MK캠프' },
    { dept: '교육부서', leader: '한진석 전도사', country: '말레이시아', missionary: '이한신 선교사', period: '1/3-9', members: '10명', content: '어린이사역, 현지교회 센터 보수' },
    { dept: '교육부서', leader: '권오경 목사', country: '태국', missionary: '지은재 선교사', period: '1/12-20', members: '40명', content: '코랏지역 전도, 학교사역' },
    { dept: '글로벌 예배선교', leader: '박영송 목사', country: '대만', missionary: '임미진 선교사', period: '1/30-2/6', members: '12명', content: '현지인 사역자와 동역, 귀국 성도 돌봄' },
    { dept: '오픈 모집팀', leader: '이이삭 목사', country: '네팔', missionary: '진실로 선교사', period: '1/20-27', members: '6명', content: '언약학교 어린이사역' },
    { dept: '오픈 모집팀', leader: '김현진 간사', country: '세네갈', missionary: '전재범 선교사', period: '1/15-22', members: '7명', content: '선교사 돌봄 및 음향장비교육' },
    { dept: '오픈 모집팀', leader: '이병철 집사', country: '태국', missionary: '지은재 선교사', period: '1/28-2/3', members: '6명', content: '4부예배 중보기도팀 기도사역' },
    { dept: '오픈 모집팀', leader: '이인호 목사', country: '베트남', missionary: '박종은 선교사', period: '4/3-7', members: '13명', content: '가정 단기선교 (어린이, 노방, 예배사역)' }
];

export const COMMON_SHARED_QUESTIONS: Question[] = [
    {
        id: 'c1',
        type: 'multi_select',
        text: '공통1. 현지사역을 진행하면서 있어서 가장 어려웠던 점은 무엇인가? (중복선택)',
        options: [
            '1) 인력 부족',
            '2) 전문성(언어 등) 부족',
            '3) 재정 부족',
            '4) 시설 및 장비 부족',
            '5) 사전 정보(숙소, 교통, 치안, 날씨 등) 부족',
            '6) 사람들과의 관계 (팀원, 인솔자, 현지인, 선교사 등)',
            '7) 현지에서의 전도 방법',
            '기타'
        ]
    },
    {
        id: 'c2',
        type: 'multi_select',
        text: '공통2. 현지 선교사와 교회에 대한 지원, 관리를 잘 하기 위해 도움이 가장 절실히 필요한 분야는? (중복선택)',
        options: [
            '1) 선교사 훈련',
            '2) 선교사 돌봄',
            '3) 선교사를 보조하는 전문 인력 양성',
            '4) 선교회간 협력 및 소통',
            '5) 지역 교회 후원 기반 확충',
            '6) 국제적인 협력 관계 구축',
            '기타'
        ]
    },
    { id: 'c3', type: 'text', text: '공통3. 그 밖에 더 나은 단기선교를 위해 필요하다고 생각하는 것이나 선교회에 하고 싶은 말은?' }
];

export const MISSIONARY_QUESTIONS: Question[] = [
    { id: 'q1', type: 'scale', text: '1. 이번에 방문한 단기선교팀이 영적으로 어느 정도 준비되어 있다고 생각하는가? (1~7점)' },
    { id: 'q1_1', type: 'text', text: '1-1. 영적으로 이 정도 준비되어 있다고 생각하는 이유는 무엇인가?' },
    { id: 'q2', type: 'scale', text: '2. 이번에 방문한 단기선교팀이 사역적으로 어느 정도 준비되어 있다고 생각하는가? (1~7점)' },
    { id: 'q2_1', type: 'text', text: '2-1. 사역적으로 이 정도 준비되어 있다고 생각하는 이유는 무엇인가?' },
    { id: 'q3', type: 'scale', text: '3. 사전에 단기선교팀과의 소통은 얼만큼 효과적으로 진행되었는가? (1~7점)' },
    { id: 'q3_1', type: 'text', text: '3-1. 효과적인 소통을 위해 보완해야 할 부분은 무엇인가?' },
    { id: 'q4', type: 'scale', text: '4. 단기선교가 현재 섬기시는 사역에 어느 정도 도움이 된다고 느끼십니까? (1~7점)' },
    { id: 'q4_1', type: 'text', text: '4-1. 단기선교팀을 통해 사역에 도움이 필요한 부분이 있다면 무엇인가요?' },
    { id: 'q5', type: 'text', text: '5. 단기선교팀 방문으로 인한 선교사님이 느끼는 어려움(애로사항)은 어떤 것이 있는지?' },
    { id: 'q6', type: 'text', text: '6. 내년에도 같은 단기선교팀이 온다면, 어떤 부분을 보완해서 오면 좋겠습니까?' },
    { id: 'q7', type: 'text', text: '7. 이번 단기선교 기간 동안 특별히 소개하고 싶은 에피소드가 있다면?' },
    { id: 'q8', type: 'text', text: '8. 그 밖에 선교회가 더 도와주기를 원하는 부분이 있다면?' }
];

export const LEADER_QUESTIONS: Question[] = [
    { id: 'l_pre', type: 'scale', text: 'I. 사전모임 준비: 1. 준비를 위한 사전 모임 횟수나 내용, 분위기는 어떻다고 생각되는가? (1~7점)' },
    { id: 'l_pre_1_reason', type: 'text', text: '1번 문항에서 해당 번호를 선택한 이유는 무엇인가?' },
    { id: 'l_pre_2', type: 'scale', text: '2. 모임과 준비를 시작하는 시기는 적절했다고 생각되는가? (1~7점)' },
    { id: 'l_pre_2_reason', type: 'text', text: '2번 문항에서 해당 번호를 선택한 이유는 무엇인가?' },
    { id: 'l_pre_3', type: 'text', text: '3. 기타 사전 모임 및 준비에 대한 조언은?' },
    { id: 'l_school', type: 'scale', text: '4. 단기선교학교는 도움이 되었다고 생각하는가? (1~7점)' },
    { id: 'l_school_reason', type: 'text', text: '4번 문항에서 해당 번호를 선택한 이유는 무엇인가?' },
    { id: 'l_school_advice', type: 'text', text: '5. 기타 단기선교학교에 대한 조언은?' },
    { id: 'l1', type: 'text', text: 'Q2.1. 만약에 내년에도 단기선교팀이 같은 사역지를 방문한다면 어떤 부분을 보완하기 원하는가?' },
    { id: 'l2', type: 'text', text: 'Q3.2. 사전에 현장 선교사님과의 소통은 얼만큼 효과적으로 진행되었는가? 보완되어야 한다면 어떤 부분인가?' },
    ...COMMON_SHARED_QUESTIONS
];

export const TEAM_QUESTIONS: Question[] = [
    { id: 't_pre', type: 'scale', text: 'I. 사전모임 준비: 1. 준비를 위한 사전 모임 횟수나 내용, 분위기는 어떻다고 생각되는가?(7점)' },
    { id: 't_pre_1_reason', type: 'text', text: '1번 문항에서 해당 번호를 선택한 이유는 무엇인가?' },
    { id: 't_pre_2', type: 'scale', text: '2. 모임과 준비를 시작하는 시기는 적절했다고 생각되는가?(7점)' },
    { id: 't_pre_2_reason', type: 'text', text: '2번 문항에서 해당 번호를 선택한 이유는 무엇인가?' },
    { id: 't_pre_3', type: 'text', text: '3. 기타 사전 모임 및 준비에 대한 조언은?' },
    { id: 't_school', type: 'scale', text: '4. 단기선교학교는 도움이 되었다고 생각하는가?(7점)' },
    { id: 't_school_reason', type: 'text', text: '4번 문항에서 해당 번호를 선택한 이유는 무엇인가?' },
    { id: 't_school_advice', type: 'text', text: '5. 기타 단기선교학교에 대한 조언은?' },
    { id: 't1', type: 'scale', text: '팀원1. 단기선교팀의 사역을 위한 현지 교회의 준비는 대체로 어떻다고 생각되는가?(7점)' },
    { id: 't1_1', type: 'text', text: '팀원1. 문항에서 해당 번호를 선택한 이유는 무엇인가?' },
    { id: 't2', type: 'scale', text: '팀원2. 이번 단기선교 일정은 대체로 어떻다고 생각되는가?(7점)' },
    { id: 't2_1', type: 'text', text: '팀원2. 문항에서 해당 번호를 선택한 이유는 무엇인가?' },
    { id: 't3', type: 'scale', text: '팀원3. 이번에 갔던 사역지를 중장기적으로 계속 방문할 계획이 있는가?(7점)' },
    { id: 't3_1', type: 'text', text: '팀원3. 문항에서 해당 번호를 선택한 이유는 무엇인가?' },
    {
        id: 't4',
        type: 'multi_select',
        text: '팀원4. 단기선교 전반에 대해 평가할 때 가장 긍정적인 부분은?(중복선택)',
        options: [
            '1) 현지 선교지/선교사에 대한 이해',
            '2) 선교하시는 하나님을 직접 체험',
            '3) 팀원 간의 유대와 친목',
            '4) 생명사역자로 선교적 삶을 살기로 다짐',
            '5) 마음에 품고 기도할 선교지/선교사 결정',
            '6) 현지인 만나서 직접 복음 전파 경험',
            '기타'
        ]
    },
    ...COMMON_SHARED_QUESTIONS
];

const mapToDbQuestion = (q: any, role: string, index: number) => ({
    id: q.id,
    role: role,
    type: q.type,
    question_text: q.text,
    options: q.options || null,
    sort_order: (index + 1) * 10,
    is_hidden: false
});

const commonIds = new Set(COMMON_SHARED_QUESTIONS.map(q => q.id));

export const INITIAL_QUESTIONS = [
    ...COMMON_SHARED_QUESTIONS.map((q, i) => mapToDbQuestion(q, 'common', i)),
    ...MISSIONARY_QUESTIONS.map((q, i) => mapToDbQuestion(q, 'missionary', i)),
    ...LEADER_QUESTIONS.filter(q => !commonIds.has(q.id)).map((q, i) => mapToDbQuestion(q, 'leader', i)),
    ...TEAM_QUESTIONS.filter(q => !commonIds.has(q.id)).map((q, i) => mapToDbQuestion(q, 'team_member', i)),
];
