import {
    isValidEmail,
    sanitizeInput,
    isValidScaleAnswer,
    isValidTextAnswer,
    isValidMultiSelectAnswer,
    isValidRole,
    isEmpty,
    isValidUrl,
    isValidSupabaseUrl,
    generateId,
} from '@/lib/validators';

describe('validators', () => {
    describe('isValidEmail', () => {
        it('returns true for valid emails', () => {
            expect(isValidEmail('test@example.com')).toBe(true);
            expect(isValidEmail('user.name@domain.co.kr')).toBe(true);
            expect(isValidEmail('test+label@gmail.com')).toBe(true);
        });

        it('returns false for invalid emails', () => {
            expect(isValidEmail('')).toBe(false);
            expect(isValidEmail('invalid')).toBe(false);
            expect(isValidEmail('test@')).toBe(false);
            expect(isValidEmail('@example.com')).toBe(false);
            expect(isValidEmail('test@.com')).toBe(false);
        });

        it('returns false for non-string inputs', () => {
            expect(isValidEmail(null as unknown as string)).toBe(false);
            expect(isValidEmail(undefined as unknown as string)).toBe(false);
            expect(isValidEmail(123 as unknown as string)).toBe(false);
        });
    });

    describe('sanitizeInput', () => {
        it('removes HTML tags', () => {
            expect(sanitizeInput('<script>alert("xss")</script>')).toBe('alert("xss")');
            expect(sanitizeInput('<b>bold</b>')).toBe('bold');
            expect(sanitizeInput('<a href="test">link</a>')).toBe('link');
        });

        it('handles HTML entities', () => {
            expect(sanitizeInput('&lt;test&gt;')).toBe('<test>');
            expect(sanitizeInput('&amp;')).toBe('&');
        });

        it('trims whitespace', () => {
            expect(sanitizeInput('  hello  ')).toBe('hello');
        });

        it('returns empty string for invalid inputs', () => {
            expect(sanitizeInput('')).toBe('');
            expect(sanitizeInput(null as unknown as string)).toBe('');
            expect(sanitizeInput(undefined as unknown as string)).toBe('');
        });
    });

    describe('isValidScaleAnswer', () => {
        it('returns true for valid scale values (1-7)', () => {
            for (let i = 1; i <= 7; i++) {
                expect(isValidScaleAnswer(i)).toBe(true);
                expect(isValidScaleAnswer(String(i))).toBe(true);
            }
        });

        it('returns false for out of range values', () => {
            expect(isValidScaleAnswer(0)).toBe(false);
            expect(isValidScaleAnswer(8)).toBe(false);
            expect(isValidScaleAnswer(-1)).toBe(false);
            expect(isValidScaleAnswer('0')).toBe(false);
            expect(isValidScaleAnswer('8')).toBe(false);
        });

        it('returns false for invalid types', () => {
            expect(isValidScaleAnswer(null)).toBe(false);
            expect(isValidScaleAnswer(undefined)).toBe(false);
            expect(isValidScaleAnswer('abc')).toBe(false);
            expect(isValidScaleAnswer([])).toBe(false);
        });
    });

    describe('isValidTextAnswer', () => {
        it('returns true for non-empty strings', () => {
            expect(isValidTextAnswer('hello')).toBe(true);
            expect(isValidTextAnswer('  hello  ')).toBe(true);
        });

        it('returns false for empty or whitespace strings', () => {
            expect(isValidTextAnswer('')).toBe(false);
            expect(isValidTextAnswer('   ')).toBe(false);
        });

        it('returns false for non-string values', () => {
            expect(isValidTextAnswer(123)).toBe(false);
            expect(isValidTextAnswer(null)).toBe(false);
            expect(isValidTextAnswer([])).toBe(false);
        });
    });

    describe('isValidMultiSelectAnswer', () => {
        it('returns true for non-empty arrays', () => {
            expect(isValidMultiSelectAnswer(['a'])).toBe(true);
            expect(isValidMultiSelectAnswer([1, 2, 3])).toBe(true);
        });

        it('returns false for empty arrays', () => {
            expect(isValidMultiSelectAnswer([])).toBe(false);
        });

        it('returns false for non-array values', () => {
            expect(isValidMultiSelectAnswer('string')).toBe(false);
            expect(isValidMultiSelectAnswer(123)).toBe(false);
            expect(isValidMultiSelectAnswer(null)).toBe(false);
        });
    });

    describe('isValidRole', () => {
        it('returns true for valid roles', () => {
            expect(isValidRole('선교사')).toBe(true);
            expect(isValidRole('인솔자')).toBe(true);
            expect(isValidRole('단기선교 팀원')).toBe(true);
        });

        it('returns false for invalid roles', () => {
            expect(isValidRole('admin')).toBe(false);
            expect(isValidRole('')).toBe(false);
            expect(isValidRole(null)).toBe(false);
            expect(isValidRole(123)).toBe(false);
        });
    });

    describe('isEmpty', () => {
        it('returns true for empty values', () => {
            expect(isEmpty(null)).toBe(true);
            expect(isEmpty(undefined)).toBe(true);
            expect(isEmpty('')).toBe(true);
            expect(isEmpty('   ')).toBe(true);
            expect(isEmpty([])).toBe(true);
        });

        it('returns false for non-empty values', () => {
            expect(isEmpty('hello')).toBe(false);
            expect(isEmpty([1, 2, 3])).toBe(false);
            expect(isEmpty(0)).toBe(false);
        });
    });

    describe('isValidUrl', () => {
        it('returns true for valid URLs', () => {
            expect(isValidUrl('https://example.com')).toBe(true);
            expect(isValidUrl('http://localhost:3000')).toBe(true);
            expect(isValidUrl('https://test.supabase.co')).toBe(true);
        });

        it('returns false for invalid URLs', () => {
            expect(isValidUrl('not-a-url')).toBe(false);
            expect(isValidUrl('')).toBe(false);
            expect(isValidUrl('example.com')).toBe(false);
        });
    });

    describe('isValidSupabaseUrl', () => {
        it('returns true for valid Supabase URLs', () => {
            expect(isValidSupabaseUrl('https://abc123.supabase.co')).toBe(true);
            expect(isValidSupabaseUrl('https://project.supabase.co')).toBe(true);
        });

        it('returns false for non-Supabase URLs', () => {
            expect(isValidSupabaseUrl('https://example.com')).toBe(false);
            expect(isValidSupabaseUrl('https://supabase.co')).toBe(false);
        });
    });

    describe('generateId', () => {
        it('generates unique IDs', () => {
            const id1 = generateId();
            const id2 = generateId();
            expect(id1).not.toBe(id2);
        });

        it('adds prefix when provided', () => {
            const id = generateId('test');
            expect(id.startsWith('test_')).toBe(true);
        });

        it('returns string without prefix when not provided', () => {
            const id = generateId();
            expect(typeof id).toBe('string');
            expect(id.includes('_')).toBe(false);
        });
    });
});
