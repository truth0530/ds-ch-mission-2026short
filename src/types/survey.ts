import { RoleType, TeamInfo } from './index';

// Survey Form Data
export interface SurveyFormData {
  respondent_name?: string;
  respondent_email?: string;
  answers: Record<string, string | number | string[]>;
}

// Survey Submission Payload
export interface SurveySubmissionPayload {
  role: RoleType;
  team_missionary: string | null;
  team_dept: string | null;
  team_country: string | null;
  team_leader: string | null;
  respondent_name: string;
  respondent_email: string;
  answers: Record<string, string | number | string[]>;
}

// Survey State
export interface SurveyState {
  view: import('./index').ViewState;
  role: RoleType | null;
  selectedTeam: TeamInfo | null;
  formData: Record<string, string | number | string[]>;
  error: string | null;
  isSubmitting: boolean;
  existingSubmissionId: string | null;
}

// Survey Action Types
export type SurveyAction =
  | { type: 'SET_VIEW'; payload: import('./index').ViewState }
  | { type: 'SET_ROLE'; payload: RoleType | null }
  | { type: 'SET_TEAM'; payload: TeamInfo | null }
  | { type: 'UPDATE_FORM_DATA'; payload: Record<string, string | number | string[]> }
  | { type: 'SET_FORM_FIELD'; payload: { key: string; value: string | number | string[] } }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SUBMITTING'; payload: boolean }
  | { type: 'SET_EXISTING_SUBMISSION_ID'; payload: string | null }
  | { type: 'RESET' };

// Draft Data (localStorage)
export interface SurveyDraft {
  formData: Record<string, string | number | string[]>;
  respondentInfo: {
    name: string;
    email: string;
  };
  savedAt: number;
  role?: RoleType;
  teamMissionary?: string;
}

// Form Validation Result
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  missingFields: string[];
}

// Respondent Info
export interface RespondentInfo {
  name: string;
  email: string;
}
