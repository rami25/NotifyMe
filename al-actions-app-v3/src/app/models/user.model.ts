export type UserRole = 'employee' | 'admin';

export interface AppUser {
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  photoUrl?: string;
}
