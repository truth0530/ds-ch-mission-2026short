// Environment Configuration
export const ENV_CONFIG = {
  PROJECT_NAME: '2026mission_short',
  PROJECT_ID: 'fjdorhdauvumfqhqujaj',
  get SUPABASE_URL() {
    return process.env.NEXT_PUBLIC_SUPABASE_URL || `https://${this.PROJECT_ID}.supabase.co`;
  },
  get SUPABASE_ANON_KEY() {
    return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  },
  get ADMIN_EMAIL() {
    return process.env.NEXT_PUBLIC_ADMIN_EMAIL || '';
  },
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  SURVEY_DRAFT: (role: string, missionary: string) =>
    `survey_draft_${role}_${missionary || 'general'}`,
  SURVEY_SUBMITTED: (role: string, missionary: string) =>
    `survey_submitted_${role}_${missionary || 'general'}`,
} as const;

// View States
export const VIEW_STATES = {
  LANDING: 'landing',
  ROLE_SELECTION: 'role_selection',
  TEAM_SELECTION: 'team_selection',
  SURVEY_FORM: 'survey_form',
  SUBMITTING: 'submitting',
  SUCCESS: 'success',
} as const;

// Role Labels
export const ROLE_LABELS = {
  MISSIONARY: '선교사',
  LEADER: '인솔자',
  TEAM_MEMBER: '단기선교 팀원',
} as const;

export const ROLE_KEYS = {
  missionary: '선교사',
  leader: '인솔자',
  team_member: '단기선교 팀원',
  common: 'common',
} as const;

// Question Types
export const QUESTION_TYPES = {
  SCALE: 'scale',
  TEXT: 'text',
  MULTI_SELECT: 'multi_select',
} as const;

// Scale Range
export const SCALE_RANGE = {
  MIN: 1,
  MAX: 7,
} as const;

// Pagination Defaults
export const PAGINATION_DEFAULTS = {
  PAGE_SIZE: 50,
  INITIAL_PAGE: 0,
} as const;

// Toast Duration (ms)
export const TOAST_DURATION = 5000;

// Draft Expiration (24 hours in ms)
export const DRAFT_EXPIRATION_MS = 24 * 60 * 60 * 1000;

// Table Names
export const TABLES = {
  EVALUATIONS: 'mission_evaluations',
  QUESTIONS: 'survey_questions',
  TEAMS: 'mission_teams',
  ADMIN_USERS: 'admin_users',
} as const;
