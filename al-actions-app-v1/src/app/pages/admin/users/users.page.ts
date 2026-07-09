import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonContent, IonIcon, IonSearchbar,
  IonToggle, IonSelect, IonSelectOption, IonSkeletonText, AlertController, ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { peopleOutline, mailOutline } from 'ionicons/icons';
import { AdminService } from '../../../services/admin.service';
import { HeaderBrandComponent } from '../../../shared/header-brand/header-brand.component';
import { AdminNavComponent } from '../../../shared/admin-nav/admin-nav.component';
import { AppUser, UserRole } from '../../../models/user.model';
import { AuthService } from '../../../services/auth.service';

addIcons({ peopleOutline, mailOutline });

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonContent, IonIcon, IonSearchbar,
    IonToggle, IonSelect, IonSelectOption, IonSkeletonText,
    HeaderBrandComponent, AdminNavComponent
  ],
  templateUrl: './users.page.html',
  styleUrl: './users.page.scss'
})
export class AdminUsersPage implements OnInit {
  readonly searchTerm = signal('');
  readonly busyEmail = signal<string | null>(null);

  readonly filtered = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    return this.admin
      .users()
      .filter(u => !term || u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
  });

  constructor(
    public admin: AdminService,
    public auth: AuthService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  ngOnInit(): void {
    if (this.admin.users().length === 0) {
      this.admin.loadUsers();
    }
  }

  async handleRefresh(event: any): Promise<void> {
    await this.admin.loadUsers();
    event.target.complete();
  }

  isSelf(user: AppUser): boolean {
    return user.email === this.auth.currentUser()?.email;
  }

  async toggleActive(user: AppUser, active: boolean): Promise<void> {
    if (this.isSelf(user)) return; // never let an admin deactivate their own account

    if (!active) {
      const alert = await this.alertCtrl.create({
        header: `Deactivate ${user.name}?`,
        message: 'They will no longer be able to sign in. Historical actions stay intact.',
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          { text: 'Deactivate', role: 'destructive', handler: () => this.applyActive(user.email, false) }
        ]
      });
      await alert.present();
    } else {
      await this.applyActive(user.email, true);
    }
  }

  private async applyActive(email: string, active: boolean): Promise<void> {
    this.busyEmail.set(email);
    try {
      await this.admin.setUserActive(email, active);
    } catch {
      await this.toast("Couldn't update this user. Try again.", 'danger');
    } finally {
      this.busyEmail.set(null);
    }
  }

  async changeRole(user: AppUser, role: UserRole): Promise<void> {
    if (this.isSelf(user) || role === user.role) return;
    this.busyEmail.set(user.email);
    try {
      await this.admin.setUserRole(user.email, role);
      await this.toast(`${user.name} is now ${role === 'admin' ? 'an admin' : 'an employee'}.`, 'success');
    } catch {
      await this.toast("Couldn't update this user's role. Try again.", 'danger');
    } finally {
      this.busyEmail.set(null);
    }
  }

  private async toast(message: string, color: string): Promise<void> {
    const toast = await this.toastCtrl.create({ message, color, duration: 2200, position: 'bottom' });
    await toast.present();
  }
}
