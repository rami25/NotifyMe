import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonButtons, IonBackButton, IonContent,
  IonItem, IonLabel, IonInput, IonTextarea, IonSelect, IonSelectOption,
  ToastController
} from '@ionic/angular/standalone';
import { AdminService } from '../../../services/admin.service';
import { HeaderBrandComponent } from '../../../shared/header-brand/header-brand.component';
import { CreateActionPayload, ActionPriority } from '../../../models/action.model';

type FormMode = 'create' | 'edit' | 'duplicate' | 'restore';

interface DraftAction {
  title: string;
  description: string;
  customerName: string;
  customerRef: string;
  address: string;
  assignedToEmail: string;
  priority: ActionPriority;
  deadline: string; // datetime-local input value
}

const EMPTY_DRAFT: DraftAction = {
  title: '',
  description: '',
  customerName: '',
  customerRef: '',
  address: '',
  assignedToEmail: '',
  priority: 'medium',
  deadline: ''
};

/** Converts a stored ISO deadline into the local "YYYY-MM-DDTHH:mm" string <input type="datetime-local"> expects. */
function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const MODE_COPY: Record<FormMode, { title: string; submitLabel: string; submittingLabel: string; successVerb: string }> = {
  create: { title: 'New Action', submitLabel: 'Create & assign', submittingLabel: 'Creating…', successVerb: 'created' },
  edit: { title: 'Edit Action', submitLabel: 'Save changes', submittingLabel: 'Saving…', successVerb: 'updated' },
  duplicate: { title: 'Duplicate Action', submitLabel: 'Create duplicate', submittingLabel: 'Creating…', successVerb: 'duplicated' },
  restore: { title: 'Restore Action', submitLabel: 'Restore action', submittingLabel: 'Restoring…', successVerb: 'restored' }
};

/**
 * One form, four modes, driven by the route's `data.formMode`:
 *  - create:    POST /actions               (blank draft)
 *  - edit:      PATCH /actions/:id          (only reachable for in_progress/postponed —
 *                                             the backend 409s for finished/cancelled)
 *  - duplicate: POST /actions/:id/duplicate (source must be finished; the ORIGINAL
 *                                             is left untouched, this creates a new row)
 *  - restore:   POST /actions/:id/restore   (source must be cancelled; edits the
 *                                             SAME row and reactivates it)
 * Same validation and field layout throughout — only the submit action,
 * title, and button copy change per mode (see MODE_COPY).
 */
@Component({
  selector: 'app-admin-action-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonButtons, IonBackButton, IonContent,
    IonItem, IonLabel, IonInput, IonTextarea, IonSelect, IonSelectOption,
    HeaderBrandComponent
  ],
  templateUrl: './action-form.page.html',
  styleUrl: './action-form.page.scss'
})
export class AdminActionFormPage implements OnInit {
  readonly draft = signal<DraftAction>({ ...EMPTY_DRAFT });

  readonly mode = signal<FormMode>('create');
  /** The action id being duplicated/edited/restored. Null in create mode. */
  readonly sourceId = signal<string | null>(null);
  readonly loadingExisting = signal(false);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  constructor(
    public admin: AdminService,
    private router: Router,
    private route: ActivatedRoute,
    private toastCtrl: ToastController
  ) {}

  async ngOnInit(): Promise<void> {
    if (this.admin.users().length === 0) {
      this.admin.loadUsers();
    }

    const formMode = (this.route.snapshot.data['formMode'] as FormMode) || 'create';
    this.mode.set(formMode);

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return; // create mode — EMPTY_DRAFT is already in place

    this.sourceId.set(id);
    this.loadingExisting.set(true);
    try {
      const existing = await this.admin.getOrFetchAction(id);
      if (existing) {
        this.draft.set({
          title: existing.title,
          description: existing.description || '',
          customerName: existing.customerName,
          customerRef: existing.customerRef || '',
          address: existing.address,
          assignedToEmail: existing.assignedToEmail,
          priority: existing.priority,
          deadline: isoToDatetimeLocal(existing.deadline)
        });
      } else {
        this.errorMessage.set("Couldn't load this action. Go back and try again.");
      }
    } finally {
      this.loadingExisting.set(false);
    }
  }

  get copy() {
    return MODE_COPY[this.mode()];
  }

  get subtitle(): string | null {
    switch (this.mode()) {
      case 'duplicate':
        return 'Creates a new action with these details — the original stays Finished, untouched.';
      case 'restore':
        return 'Edit anything needed, then restore — this reactivates the same action (In progress or Overdue, based on the deadline below).';
      default:
        return null;
    }
  }

  get activeEmployees() {
    return this.admin.users().filter(u => u.active);
  }

  update<K extends keyof DraftAction>(field: K, value: DraftAction[K]): void {
    this.draft.update(d => ({ ...d, [field]: value }));
  }

  get isValid(): boolean {
    const d = this.draft();
    return !!(d.title && d.customerName && d.address && d.assignedToEmail && d.deadline);
  }

  async submit(): Promise<void> {
    if (!this.isValid) {
      this.errorMessage.set('Fill in title, customer, address, assignee, and deadline.');
      return;
    }
    this.errorMessage.set(null);
    this.submitting.set(true);

    const d = this.draft();
    const payload: CreateActionPayload = {
      title: d.title.trim(),
      description: d.description.trim(),
      customerName: d.customerName.trim(),
      customerRef: d.customerRef.trim() || undefined,
      address: d.address.trim(),
      assignedToEmail: d.assignedToEmail,
      priority: d.priority,
      deadline: new Date(d.deadline).toISOString()
    };

    const mode = this.mode();
    const id = this.sourceId();

    try {
      let result;
      switch (mode) {
        case 'edit':
          result = await this.admin.updateAction(id!, payload);
          break;
        case 'duplicate':
          result = await this.admin.duplicateAction(id!, payload);
          break;
        case 'restore':
          result = await this.admin.restoreAction(id!, payload);
          break;
        default:
          result = await this.admin.createAction(payload);
      }

      await this.toast(`"${result.title}" ${this.copy.successVerb}.`, 'success');
      this.router.navigate(['/admin/actions', result.id], { replaceUrl: true });
    } catch (err: any) {
      // The backend's 409s (e.g. "Only cancelled actions can be restored")
      // are readable on their own — surface them directly when present.
      this.errorMessage.set(
        err?.error?.error || `Couldn't ${mode === 'create' ? 'create' : mode} the action. Check the details and try again.`
      );
    } finally {
      this.submitting.set(false);
    }
  }

  private async toast(message: string, color: string): Promise<void> {
    const toast = await this.toastCtrl.create({ message, color, duration: 2200, position: 'bottom' });
    await toast.present();
  }
}
