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
  createOutline, trashOutline, closeCircleOutline, documentTextOutline,
  mailOutline, copyOutline, refreshOutline, addOutline, cloudUploadOutline,
  downloadOutline
} from 'ionicons/icons';
import { ActionsService } from '../../../services/actions.service';
import { FieldAction } from '../../../models/action.model';
import { HeaderBrandComponent } from '../../../shared/header-brand/header-brand.component';

addIcons({ locationOutline, timeOutline, personOutline, pricetagOutline, createOutline, trashOutline, closeCircleOutline, documentTextOutline, mailOutline, copyOutline, refreshOutline, addOutline, cloudUploadOutline, downloadOutline });

@Component({
  selector: 'app-employee-action-detail',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, RouterLink, IonHeader, IonToolbar, IonButtons, IonBackButton, IonContent, IonIcon, IonTextarea, HeaderBrandComponent],
  templateUrl: './action-detail.page.html',
  styleUrl: './action-detail.page.scss'
})
export class EmployeeActionDetailPage implements OnInit {
  action = signal<FieldAction | undefined>(undefined);
  showCancelForm = signal(false);
  cancelReason = signal('');
  busy = signal(false);
  selectedFiles = signal<File[]>([]);
  uploadInProgress = signal(false);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private actionsService: ActionsService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.action.set(await this.actionsService.getOrFetchAction(id));
  }

  get isActionable(): boolean {
    const a = this.action();
    return !!a && a.status === 'in_progress';
  }

  get isOverdue(): boolean {
    return !!this.action() && this.action()!.status === 'postponed';
  }

  get isEditable(): boolean {
    return !!this.action() && (this.action()!.status === 'in_progress' || this.action()!.status === 'postponed');
  }

  get isFinished(): boolean {
    return this.action()?.status === 'finished';
  }

  get isCancelledAction(): boolean {
    return this.action()?.status === 'cancelled';
  }

  async confirmFinish(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Finish this action?',
      message: 'This closes the action and notifies the admin team.',
      buttons: [
        { text: 'Not yet', role: 'cancel' },
        { text: 'Finish', role: 'confirm', handler: () => this.finish() }
      ]
    });
    await alert.present();
  }

  private async finish(): Promise<void> {
    const a = this.action();
    if (!a) return;
    this.busy.set(true);
    try {
      await this.actionsService.finish(a.id, this.selectedFiles());
      this.selectedFiles.set([]);
      this.action.set(this.actionsService.getById(a.id));
      await this.showToast('Action finished. Admins have been notified.', 'success');
    } catch {
      await this.showToast("Couldn't update the action. Try again.", 'danger');
    } finally {
      this.busy.set(false);
    }
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (files.length) {
      this.selectedFiles.update(existing => [...existing, ...files]);
    }
    input.value = '';
  }

  removeSelectedFile(index: number): void {
    this.selectedFiles.update(list => list.filter((_, i) => i !== index));
  }

  async uploadSelectedFiles(): Promise<void> {
    const a = this.action();
    if (!a || this.selectedFiles().length === 0) return;

    this.uploadInProgress.set(true);
    try {
      await this.actionsService.uploadAttachments(a.id, this.selectedFiles());
      this.selectedFiles.set([]);
      this.action.set(this.actionsService.getById(a.id));
      await this.showToast('Files attached successfully.', 'success');
    } catch {
      await this.showToast("Couldn't upload the files. Try again.", 'danger');
    } finally {
      this.uploadInProgress.set(false);
    }
  }

  async downloadAttachment(attachment: { downloadUrl: string; fileName: string }): Promise<void> {
    try {
      await this.actionsService.downloadAttachment(attachment.downloadUrl, attachment.fileName);
    } catch {
      await this.showToast('Could not download this file.', 'danger');
    }
  }

  async removeAttachment(actionId: string, attachmentId: string): Promise<void> {
    const a = this.action();
    if (!a) return;

    try {
      await this.actionsService.deleteAttachment(actionId, attachmentId);
      this.action.set(this.actionsService.getById(actionId));
      await this.showToast('Attachment removed.', 'medium');
    } catch {
      await this.showToast("Couldn't remove the attachment. Try again.", 'danger');
    }
  }

  async submitCancel(): Promise<void> {
    const a = this.action();
    if (!a) return;
    this.busy.set(true);
    try {
      await this.actionsService.cancel(a.id, { reason: this.cancelReason() || undefined });
      this.action.set(this.actionsService.getById(a.id));
      this.showCancelForm.set(false);
      await this.showToast('Action cancelled. Admins have been notified.', 'medium');
    } catch {
      await this.showToast("Couldn't cancel the action. Try again.", 'danger');
    } finally {
      this.busy.set(false);
    }
  }

  async confirmDelete(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Delete this action?',
      message: 'This removes the action from your list.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Delete', role: 'destructive', handler: () => this.deleteNow() }
      ]
    });
    await alert.present();
  }

  private async deleteNow(): Promise<void> {
    const a = this.action();
    if (!a) return;
    this.busy.set(true);
    try {
      await this.actionsService.deleteAction(a.id);
      await this.showToast('Action deleted.', 'medium');
      this.router.navigateByUrl('/employee/actions', { replaceUrl: true });
    } catch {
      await this.showToast("Couldn't delete the action. Try again.", 'danger');
    } finally {
      this.busy.set(false);
    }
  }

  private async showToast(message: string, color: string): Promise<void> {
    const toast = await this.toastCtrl.create({ message, color, duration: 2200, position: 'bottom' });
    await toast.present();
  }
}
