export const APP_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  CASHIER: 'cashier',
  WAITER: 'waiter',
  PRODUCTION: 'production',
} as const;

export type AppRole = (typeof APP_ROLES)[keyof typeof APP_ROLES];
