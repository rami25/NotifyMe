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
import { BottomNavComponent } from '../../../shared/bottom-nav/bottom-nav.component';
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
    HeaderBrandComponent, BottomNavComponent
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

  /**
   * ion-toggle flips its own internal/visual state immediately on click
   * and fires ionChange right away — before our confirm dialog even
   * opens. If the admin then cancels, `user.active` never actually
   * changed, so Angular's one-way [checked] binding sees the same value
   * as before and skips re-pushing it into the component (Angular only
   * re-applies a bound input when the expression's value differs from
   * last check). That left the toggle visually stuck in the wrong
   * position. Fix: keep a handle on the native <ion-toggle> element via
   * the event target and explicitly reset .checked ourselves whenever
   * the change doesn't actually go through (cancelled, self, or the
   * request fails).
   */
  async toggleActive(user: AppUser, event: CustomEvent): Promise<void> {
    const toggleEl = event.target as HTMLIonToggleElement;
    const requestedActive = (event as any).detail.checked as boolean;

    if (this.isSelf(user)) {
      toggleEl.checked = user.active; // revert — self-toggle is never allowed
      return;
    }

    if (!requestedActive) {
      const alert = await this.alertCtrl.create({
        header: `Deactivate ${user.name}?`,
        message: 'They will no longer be able to sign in. Historical actions stay intact.',
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => {
              toggleEl.checked = true; // revert the optimistic flip
            }
          },
          {
            text: 'Deactivate',
            role: 'destructive',
            handler: () => this.applyActive(user.email, false, toggleEl)
          }
        ]
      });
      await alert.present();
    } else {
      await this.applyActive(user.email, true, toggleEl);
    }
  }

  private async applyActive(email: string, active: boolean, toggleEl: HTMLIonToggleElement): Promise<void> {
    this.busyEmail.set(email);
    try {
      await this.admin.setUserActive(email, active);
      // Success: `user.active` in the signal now genuinely differs, so
      // Angular's [checked] binding will correctly re-sync the toggle on
      // the next change detection — no manual DOM write needed here.
    } catch {
      toggleEl.checked = !active; // revert — the request failed, nothing actually changed
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
