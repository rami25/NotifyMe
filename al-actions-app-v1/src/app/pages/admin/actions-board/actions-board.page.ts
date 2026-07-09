import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonContent, IonIcon, IonSearchbar,
  IonSegment, IonSegmentButton, IonLabel, IonSkeletonText, IonFab, IonFabButton
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronForwardOutline, fileTrayOutline, addOutline } from 'ionicons/icons';
import { AdminService } from '../../../services/admin.service';
import { HeaderBrandComponent } from '../../../shared/header-brand/header-brand.component';
import { AdminNavComponent } from '../../../shared/admin-nav/admin-nav.component';
import { ActionStatus, FieldAction } from '../../../models/action.model';

addIcons({ chevronForwardOutline, fileTrayOutline, addOutline });

type StatusFilter = 'all' | ActionStatus;

@Component({
  selector: 'app-admin-actions-board',
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule,
    IonHeader, IonToolbar, IonContent, IonIcon, IonSearchbar,
    IonSegment, IonSegmentButton, IonLabel, IonSkeletonText, IonFab, IonFabButton,
    HeaderBrandComponent, AdminNavComponent
  ],
  templateUrl: './actions-board.page.html',
  styleUrl: './actions-board.page.scss'
})
export class AdminActionsBoardPage implements OnInit {
  readonly statusFilter = signal<StatusFilter>('all');
  readonly searchTerm = signal('');

  readonly filtered = computed(() => {
    const status = this.statusFilter();
    const term = this.searchTerm().trim().toLowerCase();

    return this.admin
      .actions()
      .filter(a => status === 'all' || a.status === status)
      .filter(
        a =>
          !term ||
          a.title.toLowerCase().includes(term) ||
          a.customerName.toLowerCase().includes(term) ||
          a.assignedToEmail.toLowerCase().includes(term)
      )
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
  });

  constructor(public admin: AdminService, private router: Router, private route: ActivatedRoute) {}

  ngOnInit(): void {
    const presetStatus = this.route.snapshot.queryParamMap.get('status') as StatusFilter | null;
    if (presetStatus) this.statusFilter.set(presetStatus);

    if (this.admin.actions().length === 0) {
      this.admin.loadAllActions();
    }
  }

  async handleRefresh(event: any): Promise<void> {
    await this.admin.loadAllActions();
    event.target.complete();
  }

  openAction(action: FieldAction): void {
    this.router.navigate(['/admin/actions', action.id]);
  }

  goToNewAction(): void {
    this.router.navigate(['/admin/actions/new']);
  }
}
