import { env } from './env.ts';

/**
 * `astro dev` signs anyone in without a password, so it must never reach the real repository or database by accident.
 * ADMIN_DEV_ALLOW_REAL=1 lets a developer test against them, and then the passwordless sign-in is off.
 */
const allowReal = () => env('ADMIN_DEV_ALLOW_REAL') === '1';

export const realBackendsAllowed = (): boolean => !import.meta.env.DEV || allowReal();
export const devSignInEnabled = (): boolean => import.meta.env.DEV === true && !allowReal();