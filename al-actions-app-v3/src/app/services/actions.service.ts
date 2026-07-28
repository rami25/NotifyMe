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

  /** The employee's active plan: in_progress + postponed, sorted by deadline then priority. */
  readonly plan = computed(() =>
    this._actions()
      .filter(a => a.status === 'in_progress' || a.status === 'postponed')
      .sort((a, b) => {
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

  async finish(id: string): Promise<void> {
    const updated = await firstValueFrom(
      this.http.post<FieldAction>(`${environment.apiBaseUrl}/actions/${id}/finish`, {})
    );
    this.patchLocal(updated);
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
