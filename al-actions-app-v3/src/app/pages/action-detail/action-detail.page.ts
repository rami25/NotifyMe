import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonButtons, IonBackButton, IonContent,
  IonIcon, IonTextarea, AlertController, ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  locationOutline, timeOutline, personOutline, pricetagOutline,
  checkmarkCircleOutline, closeCircleOutline, documentTextOutline,
  addOutline, cloudUploadOutline, downloadOutline
} from 'ionicons/icons';
import { ActionsService } from '../../services/actions.service';
import { FieldAction } from '../../models/action.model';
import { HeaderBrandComponent } from '../../shared/header-brand/header-brand.component';

addIcons({
  locationOutline, timeOutline, personOutline, pricetagOutline,
  checkmarkCircleOutline, closeCircleOutline, documentTextOutline,
  addOutline, cloudUploadOutline, downloadOutline
});

@Component({
  selector: 'app-action-detail',
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule,
    IonHeader, IonToolbar, IonButtons, IonBackButton, IonContent,
    IonIcon, IonTextarea, HeaderBrandComponent
  ],
  templateUrl: './action-detail.page.html',
  styleUrl: './action-detail.page.scss'
})
export class ActionDetailPage implements OnInit {
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

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.action.set(this.actionsService.getById(id));
  }

  get isActionable(): boolean {
    const a = this.action();
    return !!a && a.status === 'in_progress';
  }

  get isOverdue(): boolean {
    return !!this.action() && this.action()!.status === 'postponed';
  }

  async confirmFinish(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Finish this action?',
      message: 'This closes it out and notifies the admin team.',
      buttons: [
        { text: 'Not yet', role: 'cancel' },
        {
          text: 'Finish',
          role: 'confirm',
          handler: () => this.finish()
        }
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

  private async showToast(message: string, color: string): Promise<void> {
    const toast = await this.toastCtrl.create({ message, color, duration: 2200, position: 'bottom' });
    await toast.present();
  }
}
