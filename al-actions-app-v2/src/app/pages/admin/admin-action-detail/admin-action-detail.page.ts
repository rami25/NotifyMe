import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonButtons, IonBackButton, IonContent,
  IonIcon, IonTextarea, AlertController, ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  locationOutline, timeOutline, personOutline, pricetagOutline,
  closeCircleOutline, documentTextOutline, mailOutline,
  createOutline, trashOutline
} from 'ionicons/icons';
import { AdminService } from '../../../services/admin.service';
import { FieldAction } from '../../../models/action.model';
import { HeaderBrandComponent } from '../../../shared/header-brand/header-brand.component';

addIcons({
  locationOutline, timeOutline, personOutline, pricetagOutline,
  closeCircleOutline, documentTextOutline, mailOutline,
  createOutline, trashOutline
});

@Component({
  selector: 'app-admin-action-detail',
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule, RouterLink,
    IonHeader, IonToolbar, IonButtons, IonBackButton, IonContent,
    IonIcon, IonTextarea, HeaderBrandComponent
  ],
  templateUrl: './admin-action-detail.page.html',
  styleUrl: './admin-action-detail.page.scss'
})
export class AdminActionDetailPage implements OnInit {
  action = signal<FieldAction | undefined>(undefined);
  loading = signal(true);
  showCancelForm = signal(false);
  cancelReason = signal('');
  busy = signal(false);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public admin: AdminService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id')!;
    // getOrFetchAction (not the plain cache lookup) so this still works
    // on a direct deep link where the board hasn't loaded this action yet.
    this.action.set(await this.admin.getOrFetchAction(id));
    this.loading.set(false);
  }

  get isCancellable(): boolean {
    const a = this.action();
    return !!a && (a.status === 'in_progress' || a.status === 'postponed');
  }

  async submitCancel(): Promise<void> {
    const a = this.action();
    if (!a) return;
    this.busy.set(true);
    try {
      await this.admin.cancelAction(a.id, this.cancelReason() || undefined);
      this.action.set(this.admin.getActionById(a.id));
      this.showCancelForm.set(false);
      await this.toast(`Cancelled. ${a.assignedToEmail} has been notified.`, 'medium');
    } catch {
      await this.toast("Couldn't cancel the action. Try again.", 'danger');
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * Point 5 in the reported issues: admin previously had no way to
   * remove an action at all. Requires explicit confirmation since it's
   * a hard delete (see deleteAction's comment in actions.repository.js
   * on the backend for why actions, unlike users, don't get a soft
   * "never delete" rule).
   */
  async confirmDelete(): Promise<void> {
    const a = this.action();
    if (!a) return;

    const alert = await this.alertCtrl.create({
      header: `Delete "${a.title}"?`,
      message: `This permanently removes the action and its history. ${a.assignedToEmail} will be notified. This can't be undone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Delete', role: 'destructive', handler: () => this.deleteNow(a) }
      ]
    });
    await alert.present();
  }

  private async deleteNow(a: FieldAction): Promise<void> {
    this.busy.set(true);
    try {
      await this.admin.deleteAction(a.id);
      await this.toast('Action deleted.', 'medium');
      this.router.navigateByUrl('/admin/actions', { replaceUrl: true });
    } catch {
      await this.toast("Couldn't delete the action. Try again.", 'danger');
      this.busy.set(false);
    }
  }

  private async toast(message: string, color: string): Promise<void> {
    const toast = await this.toastCtrl.create({ message, color, duration: 2200, position: 'bottom' });
    await toast.present();
  }
}
