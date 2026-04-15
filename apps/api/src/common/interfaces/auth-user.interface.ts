export interface AuthUser {
  sub: string;
  email: string;
  branchId: string;
  roles: string[];
  permissions: string[];
}
