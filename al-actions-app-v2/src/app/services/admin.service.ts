import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { FieldAction, CreateActionPayload } from '../models/action.model';
import { AppUser, UserRole } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly _actions = signal<FieldAction[]>([]);
  private readonly _users = signal<AppUser[]>([]);
  private readonly _loadingActions = signal(false);
  private readonly _loadingUsers = signal(false);

  readonly actions = this._actions.asReadonly();
  readonly users = this._users.asReadonly();
  readonly loadingActions = this._loadingActions.asReadonly();
  readonly loadingUsers = this._loadingUsers.asReadonly();

  // ---- Dashboard stats, derived from whatever's currently loaded ----
  readonly activeCount = computed(
    () => this._actions().filter(a => a.status === 'in_progress').length
  );
  readonly overdueCount = computed(
    () => this._actions().filter(a => a.status === 'postponed').length
  );
  readonly finishedCount = computed(
    () => this._actions().filter(a => a.status === 'finished').length
  );
  readonly cancelledCount = computed(
    () => this._actions().filter(a => a.status === 'cancelled').length
  );
  readonly activeEmployeeCount = computed(() => this._users().filter(u => u.active).length);

  constructor(private http: HttpClient) {}

  async loadAllActions(): Promise<void> {
    this._loadingActions.set(true);
    try {
      const data = await firstValueFrom(
        this.http.get<FieldAction[]>(`${environment.apiBaseUrl}/actions`)
      );
      this._actions.set(data);
    } finally {
      this._loadingActions.set(false);
    }
  }

  async loadUsers(): Promise<void> {
    this._loadingUsers.set(true);
    try {
      const data = await firstValueFrom(
        this.http.get<AppUser[]>(`${environment.apiBaseUrl}/users`)
      );
      this._users.set(data);
    } finally {
      this._loadingUsers.set(false);
    }
  }

  getActionById(id: string): FieldAction | undefined {
    return this._actions().find(a => a.id === id);
  }

  /** Same as getActionById, but fetches from the API if the board hasn't loaded this action yet (e.g. a direct deep link into the edit form). */
  async getOrFetchAction(id: string): Promise<FieldAction | undefined> {
    const cached = this.getActionById(id);
    if (cached) return cached;
    try {
      const fetched = await firstValueFrom(
        this.http.get<FieldAction>(`${environment.apiBaseUrl}/actions/${id}`)
      );
      this._actions.update(list => [fetched, ...list]);
      return fetched;
    } catch {
      return undefined;
    }
  }

  async createAction(payload: CreateActionPayload): Promise<FieldAction> {
    const created = await firstValueFrom(
      this.http.post<FieldAction>(`${environment.apiBaseUrl}/actions`, payload)
    );
    this._actions.update(list => [created, ...list]);
    return created;
  }

  /** Admin cancelling any action — the assigned employee gets notified by push (handled server-side). */
  async cancelAction(id: string, reason?: string): Promise<void> {
    const updated = await firstValueFrom(
      this.http.post<FieldAction>(`${environment.apiBaseUrl}/actions/${id}/cancel`, { reason })
    );
    this._actions.update(list => list.map(a => (a.id === updated.id ? updated : a)));
  }

  /**
   * Admin editing an action's details (and/or reassigning it). Status is
   * never sent here — the backend ignores it even if present, since only
   * finish/cancel/the overdue sweep are allowed to move it.
   */
  async updateAction(id: string, payload: Partial<CreateActionPayload>): Promise<FieldAction> {
    const updated = await firstValueFrom(
      this.http.patch<FieldAction>(`${environment.apiBaseUrl}/actions/${id}`, payload)
    );
    this._actions.update(list => list.map(a => (a.id === updated.id ? updated : a)));
    return updated;
  }

  /** Admin permanently removing an action — the assignee is notified by push (handled server-side). */
  async deleteAction(id: string): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${environment.apiBaseUrl}/actions/${id}`));
    this._actions.update(list => list.filter(a => a.id !== id));
  }

  async setUserActive(email: string, active: boolean): Promise<void> {
    const updated = await firstValueFrom(
      this.http.patch<AppUser>(`${environment.apiBaseUrl}/users/${encodeURIComponent(email)}/active`, { active })
    );
    this._users.update(list => list.map(u => (u.email === updated.email ? updated : u)));
  }

  async setUserRole(email: string, role: UserRole): Promise<void> {
    const updated = await firstValueFrom(
      this.http.patch<AppUser>(`${environment.apiBaseUrl}/users/${encodeURIComponent(email)}/role`, { role })
    );
    this._users.update(list => list.map(u => (u.email === updated.email ? updated : u)));
  }
}
