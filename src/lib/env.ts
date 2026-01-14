/**
 * Environment variable validation and access
 */

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const;

const OPTIONAL_ENV_VARS = [
  'NEXT_PUBLIC_ADMIN_EMAIL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
] as const;

export interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Validate required environment variables
 */
export function validateEnv(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required vars
  for (const key of REQUIRED_ENV_VARS) {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      missing.push(key);
    }
  }

  // Check for placeholder values
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseKey === 'your_anon_key_here') {
    warnings.push('NEXT_PUBLIC_SUPABASE_ANON_KEY contains placeholder value');
  }

  // Check optional vars
  for (const key of OPTIONAL_ENV_VARS) {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      warnings.push(`Optional env var ${key} is not set`);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Get environment variable with type safety
 */
export function getEnvVar(key: string, defaultValue = ''): string {
  const value = process.env[key];
  return value && value.trim() !== '' ? value : defaultValue;
}

/**
 * Check if we're in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if we're in production mode
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Log environment validation results (only in development)
 */
export function logEnvStatus(): void {
  if (!isDevelopment()) return;

  const { valid, missing, warnings } = validateEnv();

  if (!valid) {
    console.error('[ENV] Missing required environment variables:', missing);
  }

  if (warnings.length > 0) {
    console.warn('[ENV] Warnings:', warnings);
  }

  if (valid && warnings.length === 0) {
    console.log('[ENV] All environment variables are configured correctly');
  }
}
