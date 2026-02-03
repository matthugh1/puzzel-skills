/**
 * Environment variable validation
 * Throws at startup if required variables are missing
 */

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getOptionalEnvVar(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

export const env = {
  // Database
  DATABASE_URL: getEnvVar('DATABASE_URL'),

  // Auth
  NEXTAUTH_SECRET: getEnvVar('NEXTAUTH_SECRET'),
  NEXTAUTH_URL: getEnvVar('NEXTAUTH_URL'),

  // Environment
  NODE_ENV: getOptionalEnvVar('NODE_ENV', 'development'),

  // Azure AD (optional for now, required later)
  AZURE_AD_CLIENT_ID: process.env.AZURE_AD_CLIENT_ID,
  AZURE_AD_CLIENT_SECRET: process.env.AZURE_AD_CLIENT_SECRET,
  AZURE_AD_TENANT_ID: process.env.AZURE_AD_TENANT_ID,

  // LLM Configuration
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
} as const;

export type Env = typeof env;
