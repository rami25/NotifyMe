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

/**
 * Handles BOTH "New Action" (POST /actions) and "Edit Action"
 * (PATCH /actions/:id) — same form, same validation, driven by whether
 * a route :id param is present. Previously this page only ever created;
 * editing/reassigning an existing action had no UI at all.
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

  /** Non-null in edit mode — the action being edited. Null while creating a new one. */
  readonly editingId = signal<string | null>(null);
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

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return; // create mode — EMPTY_DRAFT is already in place

    this.editingId.set(id);
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

  get isEditMode(): boolean {
    return this.editingId() !== null;
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

    const id = this.editingId();

    try {
      if (id) {
        await this.admin.updateAction(id, payload);
        await this.toast(`"${payload.title}" updated.`, 'success');
        this.router.navigate(['/admin/actions', id], { replaceUrl: true });
      } else {
        await this.admin.createAction(payload);
        await this.toast(`Action assigned to ${payload.assignedToEmail}.`, 'success');
        this.router.navigateByUrl('/admin/actions', { replaceUrl: true });
      }
    } catch {
      this.errorMessage.set(
        id ? "Couldn't save changes. Check the details and try again." : "Couldn't create the action. Check the details and try again."
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
