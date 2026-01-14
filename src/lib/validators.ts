import { Evaluation, Question, RoleType } from '@/types';
import { SCALE_RANGE } from './constants';

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

/**
 * Sanitize input to prevent XSS
 * Removes HTML tags from string
 */
export const sanitizeInput = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
};

/**
 * Validate scale answer (1-7)
 */
export const isValidScaleAnswer = (value: unknown): boolean => {
  if (typeof value === 'number') {
    return value >= SCALE_RANGE.MIN && value <= SCALE_RANGE.MAX;
  }
  if (typeof value === 'string') {
    const num = parseInt(value, 10);
    return !isNaN(num) && num >= SCALE_RANGE.MIN && num <= SCALE_RANGE.MAX;
  }
  return false;
};

/**
 * Validate text answer (non-empty string)
 */
export const isValidTextAnswer = (value: unknown): boolean => {
  return typeof value === 'string' && value.trim().length > 0;
};

/**
 * Validate multi-select answer (non-empty array)
 */
export const isValidMultiSelectAnswer = (value: unknown): boolean => {
  return Array.isArray(value) && value.length > 0;
};

/**
 * Validate single question answer
 */
export const isValidAnswer = (question: Question, value: unknown): boolean => {
  switch (question.type) {
    case 'scale':
      return isValidScaleAnswer(value);
    case 'text':
      return isValidTextAnswer(value);
    case 'multi_select':
      return isValidMultiSelectAnswer(value);
    default:
      return false;
  }
};

/**
 * Validate entire survey form
 */
export const validateSurveyForm = (
  questions: Question[],
  answers: Record<string, unknown>
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  for (const question of questions) {
    const answer = answers[question.id];
    if (!isValidAnswer(question, answer)) {
      errors.push(question.id);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Check if object is a valid Evaluation
 */
export const isValidEvaluation = (obj: unknown): obj is Evaluation => {
  if (!obj || typeof obj !== 'object') return false;

  const e = obj as Record<string, unknown>;

  return (
    typeof e.id === 'string' &&
    typeof e.role === 'string' &&
    ['선교사', '인솔자', '단기선교 팀원'].includes(e.role as string) &&
    typeof e.created_at === 'string' &&
    typeof e.answers === 'object' &&
    e.answers !== null
  );
};

/**
 * Validate array of evaluations
 */
export const validateEvaluations = (data: unknown[]): Evaluation[] => {
  if (!Array.isArray(data)) return [];
  return data.filter(isValidEvaluation);
};

/**
 * Validate role type
 */
export const isValidRole = (role: unknown): role is RoleType => {
  return (
    typeof role === 'string' &&
    ['선교사', '인솔자', '단기선교 팀원'].includes(role)
  );
};

/**
 * Check if string is empty or whitespace only
 */
export const isEmpty = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
};

/**
 * Validate URL format
 */
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate Supabase URL format
 */
export const isValidSupabaseUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
};

/**
 * Generate a unique ID (UUID v4-like)
 * More collision-resistant than Date.now()
 */
export const generateId = (prefix = ''): string => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  const randomPart2 = Math.random().toString(36).substring(2, 5);
  return prefix ? `${prefix}_${timestamp}${randomPart}${randomPart2}` : `${timestamp}${randomPart}${randomPart2}`;
};
