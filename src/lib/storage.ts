import { SurveyDraft } from '@/types/survey';
import { STORAGE_KEYS, DRAFT_EXPIRATION_MS } from './constants';

/**
 * Check if localStorage is available
 */
const isLocalStorageAvailable = (): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate draft data structure
 */
const isValidDraft = (data: unknown): data is SurveyDraft => {
  if (!data || typeof data !== 'object') return false;

  const draft = data as Record<string, unknown>;

  return (
    typeof draft.formData === 'object' &&
    draft.formData !== null &&
    typeof draft.savedAt === 'number' &&
    typeof draft.respondentInfo === 'object' &&
    draft.respondentInfo !== null
  );
};

/**
 * Check if draft is expired (older than 24 hours)
 */
const isDraftExpired = (savedAt: number): boolean => {
  return Date.now() - savedAt > DRAFT_EXPIRATION_MS;
};

/**
 * Load survey draft from localStorage
 */
export function loadDraft(role: string, missionary: string): SurveyDraft | null {
  if (!isLocalStorageAvailable()) return null;

  const key = STORAGE_KEYS.SURVEY_DRAFT(role, missionary);

  try {
    const saved = localStorage.getItem(key);
    if (!saved) return null;

    const parsed = JSON.parse(saved);

    // Validate structure
    if (!isValidDraft(parsed)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Storage] Invalid draft format, removing');
      }
      localStorage.removeItem(key);
      return null;
    }

    // Check expiration
    if (isDraftExpired(parsed.savedAt)) {
      if (process.env.NODE_ENV === 'development') {
        console.info('[Storage] Draft expired, removing');
      }
      localStorage.removeItem(key);
      return null;
    }

    return parsed;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[Storage] Failed to load draft:', error);
    }
    localStorage.removeItem(key);
    return null;
  }
}

/**
 * Save survey draft to localStorage
 */
export function saveDraft(role: string, missionary: string, draft: Omit<SurveyDraft, 'savedAt'>): boolean {
  if (!isLocalStorageAvailable()) return false;

  const key = STORAGE_KEYS.SURVEY_DRAFT(role, missionary);

  try {
    const dataToSave: SurveyDraft = {
      ...draft,
      savedAt: Date.now(),
      role: draft.role,
      teamMissionary: missionary || undefined,
    };

    localStorage.setItem(key, JSON.stringify(dataToSave));
    return true;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[Storage] Failed to save draft:', error);
    }
    return false;
  }
}

/**
 * Remove survey draft from localStorage
 */
export function removeDraft(role: string, missionary: string): boolean {
  if (!isLocalStorageAvailable()) return false;

  const key = STORAGE_KEYS.SURVEY_DRAFT(role, missionary);

  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[Storage] Failed to remove draft:', error);
    }
    return false;
  }
}

/**
 * Check if survey was already submitted (session-based)
 */
export function wasSubmitted(role: string, missionary: string): boolean {
  if (typeof window === 'undefined') return false;

  const key = STORAGE_KEYS.SURVEY_SUBMITTED(role, missionary);

  try {
    return sessionStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark survey as submitted (session-based)
 */
export function markAsSubmitted(role: string, missionary: string): boolean {
  if (typeof window === 'undefined') return false;

  const key = STORAGE_KEYS.SURVEY_SUBMITTED(role, missionary);

  try {
    sessionStorage.setItem(key, 'true');
    return true;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[Storage] Failed to mark as submitted:', error);
    }
    return false;
  }
}

/**
 * Clear all survey-related data from storage
 */
export function clearAllSurveyData(): void {
  if (!isLocalStorageAvailable()) return;

  try {
    // Clear localStorage items that start with survey_draft_
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('survey_draft_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Clear sessionStorage items that start with survey_submitted_
    const sessionKeysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith('survey_submitted_')) {
        sessionKeysToRemove.push(key);
      }
    }
    sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[Storage] Failed to clear survey data:', error);
    }
  }
}

/**
 * Get draft last saved date as formatted string
 */
export function getDraftSavedDate(role: string, missionary: string): string | null {
  const draft = loadDraft(role, missionary);
  if (!draft) return null;

  try {
    return new Date(draft.savedAt).toLocaleString('ko-KR');
  } catch {
    return null;
  }
}
