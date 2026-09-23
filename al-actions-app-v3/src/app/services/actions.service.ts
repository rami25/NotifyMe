import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { FieldAction, CancelActionPayload, CreateActionPayload } from '../models/action.model';

const PRIORITY_WEIGHT: Record<string, number> = { high: 0, medium: 1, low: 2 };

@Injectable({ providedIn: 'root' })
export class ActionsService {
  private readonly _actions = signal<FieldAction[]>([]);
  private readonly _loading = signal(false);

  readonly loading = this._loading.asReadonly();
  readonly actions = this._actions.asReadonly();

  /** The employee's plan list: active and overdue actions remain visible for the employee. */
  readonly plan = computed(() =>
    this._actions()
      .filter(a => a.status === 'in_progress' || a.status === 'postponed')
      .sort((a, b) => {
        const statusOrder = a.status === 'in_progress' && b.status === 'postponed' ? -1
          : a.status === 'postponed' && b.status === 'in_progress' ? 1
          : 0;

        if (statusOrder !== 0) return statusOrder;

        const byDeadline = new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        if (byDeadline !== 0) return byDeadline;
        return PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
      })
  );

  readonly finishedOrCancelled = computed(() =>
    this._actions()
      .filter(a => a.status === 'finished' || a.status === 'cancelled')
      .sort((a, b) => new Date(b.deadline).getTime() - new Date(a.deadline).getTime())
  );

  readonly overdueCount = computed(
    () => this._actions().filter(a => a.status === 'postponed').length
  );

  constructor(private http: HttpClient) {}

  // Listen for global action-list changes (admin-side edits) and refresh
  // the employee's plan so UI stays in sync across admin/employee flows.
  private _globalListener = (() => {
    try {
      const handler = () => { this.loadMyActions().catch(() => {}); };
      window.addEventListener('actions:changed', handler);
      return { remove: () => window.removeEventListener('actions:changed', handler) };
    } catch {
      return { remove: () => {} };
    }
  })();

  async loadMyActions(): Promise<void> {
    this._loading.set(true);
    try {
      const data = await firstValueFrom(
        this.http.get<FieldAction[]>(`${environment.apiBaseUrl}/actions/mine`)
      );
      this._actions.set(data);
    } finally {
      this._loading.set(false);
    }
  }

  getById(id: string): FieldAction | undefined {
    return this._actions().find(a => a.id === id);
  }

  async getOrFetchAction(id: string): Promise<FieldAction | undefined> {
    const cached = this.getById(id);
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

  async createAction(payload: Partial<CreateActionPayload>): Promise<FieldAction> {
    const created = await firstValueFrom(
      this.http.post<FieldAction>(`${environment.apiBaseUrl}/actions`, payload)
    );
    this._actions.update(list => [created, ...list]);
    return created;
  }

  async duplicateAction(sourceId: string, payload: Partial<CreateActionPayload>): Promise<FieldAction> {
    const duplicated = await firstValueFrom(
      this.http.post<FieldAction>(`${environment.apiBaseUrl}/actions/${sourceId}/duplicate`, payload)
    );
    this._actions.update(list => [duplicated, ...list]);
    return duplicated;
  }

  async restoreAction(id: string, payload: Partial<CreateActionPayload>): Promise<FieldAction> {
    const restored = await firstValueFrom(
      this.http.post<FieldAction>(`${environment.apiBaseUrl}/actions/${id}/restore`, payload)
    );
    this.patchLocal(restored);
    return restored;
  }

  async updateAction(id: string, payload: Partial<CreateActionPayload>): Promise<FieldAction> {
    const updated = await firstValueFrom(
      this.http.patch<FieldAction>(`${environment.apiBaseUrl}/actions/${id}`, payload)
    );
    this.patchLocal(updated);
    return updated;
  }

  async deleteAction(id: string): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${environment.apiBaseUrl}/actions/${id}`));
    this._actions.update(list => list.filter(a => a.id !== id));
  }

  async finish(id: string, attachments: File[] = []): Promise<void> {
    let updated: FieldAction;

    if (attachments.length > 0) {
      const formData = new FormData();
      attachments.forEach(file => formData.append('attachments', file, file.name));
      updated = await firstValueFrom(
        this.http.post<FieldAction>(`${environment.apiBaseUrl}/actions/${id}/finish`, formData)
      );
    } else {
      updated = await firstValueFrom(
        this.http.post<FieldAction>(`${environment.apiBaseUrl}/actions/${id}/finish`, {})
      );
    }

    this.patchLocal(updated);
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

    const current = this.getById(id);
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

    this.patchLocal({ ...current, attachments: nextAttachments } as FieldAction);
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
    const current = this.getById(actionId);
    if (!current) return;
    this.patchLocal({
      ...current,
      attachments: (current.attachments ?? []).filter(a => a.id !== attachmentId)
    } as FieldAction);
  }

  async cancel(id: string, payload: CancelActionPayload): Promise<void> {
    const updated = await firstValueFrom(
      this.http.post<FieldAction>(`${environment.apiBaseUrl}/actions/${id}/cancel`, payload)
    );
    this.patchLocal(updated);
  }

  private patchLocal(updated: FieldAction): void {
    this._actions.update(list => list.map(a => (a.id === updated.id ? updated : a)));
  }
}
