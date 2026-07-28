import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  IonHeader, IonToolbar, IonButtons, IonBackButton, IonContent, IonIcon, IonSkeletonText
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  timeOutline, alertCircleOutline, checkmarkDoneCircleOutline, closeCircleOutline
} from 'ionicons/icons';
import { AdminService } from '../../../services/admin.service';
import { HeaderBrandComponent } from '../../../shared/header-brand/header-brand.component';
import { BottomNavComponent } from '../../../shared/bottom-nav/bottom-nav.component';

@Component({
  selector: 'app-admin-user-stats',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader, IonToolbar, IonButtons, IonBackButton, IonContent, IonIcon, IonSkeletonText,
    HeaderBrandComponent, BottomNavComponent
  ],
  templateUrl: './user-stats.page.html',
  styleUrl: './user-stats.page.scss'
})
export class AdminUserStatsPage implements OnInit {
  readonly userEmail = signal('');
  readonly userName = signal('');
  readonly loading = signal(true);

  readonly userActions = computed(() => {
    const email = this.userEmail().trim().toLowerCase();
    return this.admin.actions().filter(a => a.assignedToEmail.toLowerCase() === email);
  });

  readonly activeCount = computed(() => this.userActions().filter(a => a.status === 'in_progress').length);
  readonly overdueCount = computed(() => this.userActions().filter(a => a.status === 'postponed').length);
  readonly finishedCount = computed(() => this.userActions().filter(a => a.status === 'finished').length);
  readonly cancelledCount = computed(() => this.userActions().filter(a => a.status === 'cancelled').length);

  constructor(public admin: AdminService, private route: ActivatedRoute, private router: Router) {
    addIcons({ timeOutline, alertCircleOutline, checkmarkDoneCircleOutline, closeCircleOutline });
  }

  async ngOnInit(): Promise<void> {
    const encoded = this.route.snapshot.paramMap.get('email') || '';
    const email = decodeURIComponent(encoded);
    this.userEmail.set(email);

    if (this.admin.actions().length === 0) {
      await this.admin.loadAllActions();
    }
    if (this.admin.users().length === 0) {
      await this.admin.loadUsers();
    }

    const match = this.admin.users().find(u => u.email.toLowerCase() === email.toLowerCase());
    this.userName.set(match?.name || email);
    this.loading.set(false);
  }

  goBack(): void {
    this.router.navigate(['/admin/users']);
  }
}
