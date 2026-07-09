import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
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
  readonly draft = signal<DraftAction>({
    title: '',
    description: '',
    customerName: '',
    customerRef: '',
    address: '',
    assignedToEmail: '',
    priority: 'medium',
    deadline: ''
  });

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  constructor(
    public admin: AdminService,
    private router: Router,
    private toastCtrl: ToastController
  ) {}

  ngOnInit(): void {
    if (this.admin.users().length === 0) {
      this.admin.loadUsers();
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

    try {
      await this.admin.createAction(payload);
      const toast = await this.toastCtrl.create({
        message: `Action assigned to ${payload.assignedToEmail}.`,
        color: 'success',
        duration: 2200,
        position: 'bottom'
      });
      await toast.present();
      this.router.navigateByUrl('/admin/actions', { replaceUrl: true });
    } catch {
      this.errorMessage.set("Couldn't create the action. Check the details and try again.");
    } finally {
      this.submitting.set(false);
    }
  }
}
