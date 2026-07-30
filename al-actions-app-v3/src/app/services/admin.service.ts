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
      // Notify other parts of the app that the global actions list changed
      try { window.dispatchEvent(new CustomEvent('actions:changed')); } catch {}
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
    try { window.dispatchEvent(new CustomEvent('actions:changed')); } catch {}
    return created;
  }

  /** Admin cancelling any action — the assigned employee gets notified by push (handled server-side). */
  async cancelAction(id: string, reason?: string): Promise<void> {
    const updated = await firstValueFrom(
      this.http.post<FieldAction>(`${environment.apiBaseUrl}/actions/${id}/cancel`, { reason })
    );
    this._actions.update(list => list.map(a => (a.id === updated.id ? updated : a)));
    try { window.dispatchEvent(new CustomEvent('actions:changed')); } catch {}
  }

  /**
   * Admin editing an action's details (and/or reassigning it). Only
   * valid for in_progress/postponed — the backend returns 409 for
   * finished (duplicate it instead, see duplicateAction) or cancelled
   * (restore it instead, see restoreAction) actions.
   */
  async updateAction(id: string, payload: Partial<CreateActionPayload>): Promise<FieldAction> {
    const updated = await firstValueFrom(
      this.http.patch<FieldAction>(`${environment.apiBaseUrl}/actions/${id}`, payload)
    );
    this._actions.update(list => list.map(a => (a.id === updated.id ? updated : a)));
    try { window.dispatchEvent(new CustomEvent('actions:changed')); } catch {}
    return updated;
  }

  /**
   * Admin "editing" a FINISHED action — actually creates a brand-new
   * action (optionally with changed fields), and leaves the finished
   * original completely untouched so its historical record is preserved.
   * The new action's initial status is derived from its own deadline by
   * the backend (in_progress if still ahead, postponed if already past).
   */
  async duplicateAction(sourceId: string, payload: Partial<CreateActionPayload>): Promise<FieldAction> {
    const created = await firstValueFrom(
      this.http.post<FieldAction>(`${environment.apiBaseUrl}/actions/${sourceId}/duplicate`, payload)
    );
    this._actions.update(list => [created, ...list]);
    try { window.dispatchEvent(new CustomEvent('actions:changed')); } catch {}
    return created;
  }

  /**
   * Admin restoring a CANCELLED action back to active, with the option
   * to edit fields as part of the same request. Reuses the same action
   * id — the backend re-derives in_progress vs. postponed from the
   * (possibly edited) deadline and clears cancel_reason.
   */
  async restoreAction(id: string, payload: Partial<CreateActionPayload>): Promise<FieldAction> {
    const restored = await firstValueFrom(
      this.http.post<FieldAction>(`${environment.apiBaseUrl}/actions/${id}/restore`, payload)
    );
    this._actions.update(list => list.map(a => (a.id === restored.id ? restored : a)));
    try { window.dispatchEvent(new CustomEvent('actions:changed')); } catch {}
    return restored;
  }

  /** Admin permanently removing an action — the assignee is notified by push (handled server-side). */
  async deleteAction(id: string): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${environment.apiBaseUrl}/actions/${id}`));
    this._actions.update(list => list.filter(a => a.id !== id));
    try { window.dispatchEvent(new CustomEvent('actions:changed')); } catch {}
  }

  async uploadAttachments(id: string, attachments: File[]): Promise<void> {
    if (attachments.length === 0) return;

    const formData = new FormData();
    attachments.forEach(file => formData.append('attachments', file, file.name));
    const saved = await firstValueFrom(
      this.http.post<{ uploaded: Array<{ id: string; fileName: string; mimeType: string; fileSize: number }> }>(
        `${environment.apiBaseUrl}/actions/${id}/attachments`,
        formData
      )
    );

    const current = this.getActionById(id);
    if (!current) return;

    const nextAttachments = [
      ...(current.attachments ?? []),
      ...saved.uploaded.map(item => ({
        id: item.id,
        fileName: item.fileName,
        mimeType: item.mimeType,
        fileSize: item.fileSize,
        downloadUrl: `${environment.apiBaseUrl}/actions/${id}/attachments/${item.id}/download`
      }))
    ];

    this._actions.update(list => list.map(a => (a.id === id ? { ...a, attachments: nextAttachments } : a)));
    try { window.dispatchEvent(new CustomEvent('actions:changed')); } catch {}
  }

  async downloadAttachment(url: string, fileName: string): Promise<void> {
    const resolvedUrl = url.startsWith('http')
      ? url
      : url.startsWith('/api')
      ? `${new URL(environment.apiBaseUrl).origin}${url}`
      : `${environment.apiBaseUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
    const response = await firstValueFrom(this.http.get(resolvedUrl, { responseType: 'blob' }));
    const blob = new Blob([response], { type: response.type || 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async deleteAttachment(actionId: string, attachmentId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${environment.apiBaseUrl}/actions/${actionId}/attachments/${attachmentId}`)
    );
    const current = this.getActionById(actionId);
    if (!current) return;
    this._actions.update(list =>
      list.map(a =>
        a.id === actionId
          ? { ...a, attachments: (a.attachments ?? []).filter(att => att.id !== attachmentId) }
          : a
      )
    );
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
