import { User, Session, SupabaseClient } from '@supabase/supabase-js';

// Re-export Supabase types
export type { User, Session, SupabaseClient };

// Role Types
export type RoleType = '선교사' | '인솔자' | '단기선교 팀원';
export type RoleKey = 'missionary' | 'leader' | 'team_member' | 'common';

// View States
export type ViewState = 'landing' | 'role_selection' | 'team_selection' | 'survey_form' | 'submitting' | 'success';

// Auth State
export interface AuthState {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
}

// Team Info
export interface TeamInfo {
  id?: string;
  dept: string;
  leader: string;
  country: string;
  missionary: string;
  period: string;
  members: string;
  content: string;
}

// Question Types
export type QuestionType = 'scale' | 'text' | 'multi_select';

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  options?: string[];
  is_hidden?: boolean;
  sort_order?: number;
  role?: RoleKey;
  question_text?: string;
}

// DB Question (from Supabase)
export interface DbQuestion {
  id: string;
  role: RoleKey;
  type: QuestionType;
  question_text: string;
  options: string[] | null;
  sort_order: number;
  is_hidden: boolean;
}

// Evaluation Types
export interface Evaluation {
  id: string;
  role: RoleType;
  team_dept: string | null;
  team_country: string | null;
  team_missionary: string | null;
  team_leader: string | null;
  respondent_email: string | null;
  respondent_name: string | null;
  submission_date?: string;
  response_status?: 'completed' | 'partial';
  answers: Record<string, string | number | string[]>;
  created_at: string;
}

// Admin User
export interface AdminUser {
  id?: string;
  email: string;
  created_at?: string;
}

// Toast Types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

// Questions Map
export interface QuestionsMap {
  missionary: Question[];
  leader: Question[];
  team_member: Question[];
}

// Pagination
export interface PaginationState {
  page: number;
  pageSize: number;
  totalCount: number;
}

// API Response
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}
