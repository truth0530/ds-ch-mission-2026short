'use client';

import { useReducer, useCallback, useRef } from 'react';
import { SurveyState, SurveyAction, SurveyFormData } from '@/types/survey';
import { ViewState, RoleType, TeamInfo } from '@/types';

const initialState: SurveyState = {
  view: 'landing',
  role: null,
  selectedTeam: null,
  formData: {},
  error: null,
  isSubmitting: false,
  existingSubmissionId: null,
};

function surveyReducer(state: SurveyState, action: SurveyAction): SurveyState {
  switch (action.type) {
    case 'SET_VIEW':
      return { ...state, view: action.payload };

    case 'SET_ROLE':
      return { ...state, role: action.payload };

    case 'SET_TEAM':
      return { ...state, selectedTeam: action.payload };

    case 'UPDATE_FORM_DATA':
      return { ...state, formData: action.payload };

    case 'SET_FORM_FIELD':
      return {
        ...state,
        formData: { ...state.formData, [action.payload.key]: action.payload.value },
      };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'SET_SUBMITTING':
      return { ...state, isSubmitting: action.payload };

    case 'SET_EXISTING_SUBMISSION_ID':
      return { ...state, existingSubmissionId: action.payload };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

export interface UseSurveyStateReturn {
  state: SurveyState;
  // Navigation
  setView: (view: ViewState) => void;
  setRole: (role: RoleType | null) => void;
  setTeam: (team: TeamInfo | null) => void;
  // Form
  updateFormData: (data: Record<string, string | number | string[]>) => void;
  setFormField: (key: string, value: string | number | string[]) => void;
  // Status
  setError: (error: string | null) => void;
  setSubmitting: (isSubmitting: boolean) => void;
  setExistingSubmissionId: (id: string | null) => void;
  // Actions
  reset: () => void;
  // Submit lock (for race condition prevention)
  isSubmitLocked: () => boolean;
  lockSubmit: () => boolean;
  unlockSubmit: () => void;
}

/**
 * Custom hook for survey state management
 * Uses useReducer for better state organization
 */
export function useSurveyState(initial?: Partial<SurveyState>): UseSurveyStateReturn {
  const [state, dispatch] = useReducer(
    surveyReducer,
    initial ? { ...initialState, ...initial } : initialState
  );

  // Ref for submit lock (prevents race conditions)
  const submitLockRef = useRef(false);

  // Navigation actions
  const setView = useCallback((view: ViewState) => {
    dispatch({ type: 'SET_VIEW', payload: view });
  }, []);

  const setRole = useCallback((role: RoleType | null) => {
    dispatch({ type: 'SET_ROLE', payload: role });
  }, []);

  const setTeam = useCallback((team: TeamInfo | null) => {
    dispatch({ type: 'SET_TEAM', payload: team });
  }, []);

  // Form actions
  const updateFormData = useCallback((data: Record<string, string | number | string[]>) => {
    dispatch({ type: 'UPDATE_FORM_DATA', payload: data });
  }, []);

  const setFormField = useCallback((key: string, value: string | number | string[]) => {
    dispatch({ type: 'SET_FORM_FIELD', payload: { key, value } });
  }, []);

  // Status actions
  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  const setSubmitting = useCallback((isSubmitting: boolean) => {
    dispatch({ type: 'SET_SUBMITTING', payload: isSubmitting });
  }, []);

  const setExistingSubmissionId = useCallback((id: string | null) => {
    dispatch({ type: 'SET_EXISTING_SUBMISSION_ID', payload: id });
  }, []);

  // Reset action
  const reset = useCallback(() => {
    submitLockRef.current = false;
    dispatch({ type: 'RESET' });
  }, []);

  // Submit lock functions (race condition prevention)
  const isSubmitLocked = useCallback(() => {
    return submitLockRef.current;
  }, []);

  const lockSubmit = useCallback(() => {
    if (submitLockRef.current) {
      return false; // Already locked
    }
    submitLockRef.current = true;
    return true;
  }, []);

  const unlockSubmit = useCallback(() => {
    submitLockRef.current = false;
  }, []);

  return {
    state,
    setView,
    setRole,
    setTeam,
    updateFormData,
    setFormField,
    setError,
    setSubmitting,
    setExistingSubmissionId,
    reset,
    isSubmitLocked,
    lockSubmit,
    unlockSubmit,
  };
}

/**
 * Helper hook for navigation logic
 */
export function useSurveyNavigation(surveyState: UseSurveyStateReturn) {
  const { state, setView, setRole, setTeam } = surveyState;

  const handleStart = useCallback((hasExistingData: boolean, currentRole: RoleType | null) => {
    if (hasExistingData && currentRole) {
      setView('survey_form');
    } else {
      setView('role_selection');
    }
  }, [setView]);

  const handleRoleSelect = useCallback((selectedRole: RoleType) => {
    setRole(selectedRole);
    if (selectedRole === '선교사' || selectedRole === '인솔자') {
      setView('survey_form');
    } else {
      setView('team_selection');
    }
  }, [setRole, setView]);

  const handleTeamSelect = useCallback((team: TeamInfo) => {
    setTeam(team);
    setView('survey_form');
  }, [setTeam, setView]);

  const handleBack = useCallback(() => {
    switch (state.view) {
      case 'role_selection':
        setView('landing');
        break;
      case 'team_selection':
        setView('role_selection');
        break;
      case 'survey_form':
        if (state.role === '선교사' || state.role === '인솔자') {
          setView('role_selection');
        } else {
          setView('team_selection');
        }
        break;
    }
  }, [state.view, state.role, setView]);

  return {
    handleStart,
    handleRoleSelect,
    handleTeamSelect,
    handleBack,
  };
}
