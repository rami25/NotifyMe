import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonButtons, IonBackButton, IonContent,
  IonIcon, IonTextarea, ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  locationOutline, timeOutline, personOutline, pricetagOutline,
  closeCircleOutline, documentTextOutline, mailOutline
} from 'ionicons/icons';
import { AdminService } from '../../../services/admin.service';
import { FieldAction } from '../../../models/action.model';
import { HeaderBrandComponent } from '../../../shared/header-brand/header-brand.component';

addIcons({
  locationOutline, timeOutline, personOutline, pricetagOutline,
  closeCircleOutline, documentTextOutline, mailOutline
});

@Component({
  selector: 'app-admin-action-detail',
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule,
    IonHeader, IonToolbar, IonButtons, IonBackButton, IonContent,
    IonIcon, IonTextarea, HeaderBrandComponent
  ],
  templateUrl: './admin-action-detail.page.html',
  styleUrl: './admin-action-detail.page.scss'
})
export class AdminActionDetailPage implements OnInit {
  action = signal<FieldAction | undefined>(undefined);
  showCancelForm = signal(false);
  cancelReason = signal('');
  busy = signal(false);

  constructor(
    private route: ActivatedRoute,
    public admin: AdminService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.action.set(this.admin.getActionById(id));
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
      const toast = await this.toastCtrl.create({
        message: `Cancelled. ${a.assignedToEmail} has been notified.`,
        color: 'medium',
        duration: 2200,
        position: 'bottom'
      });
      await toast.present();
    } catch {
      const toast = await this.toastCtrl.create({
        message: "Couldn't cancel the action. Try again.",
        color: 'danger',
        duration: 2200,
        position: 'bottom'
      });
      await toast.present();
    } finally {
      this.busy.set(false);
    }
  }
}
