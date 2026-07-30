import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonContent, IonIcon, IonSearchbar,
  IonSegment, IonSegmentButton, IonLabel, IonSkeletonText, IonFab, IonFabButton,
  IonRefresher, IonRefresherContent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronForwardOutline, addOutline } from 'ionicons/icons';
import { ActionsService } from '../../../services/actions.service';
import { HeaderBrandComponent } from '../../../shared/header-brand/header-brand.component';
import { BottomNavComponent } from '../../../shared/bottom-nav/bottom-nav.component';
import { ActionStatus, FieldAction } from '../../../models/action.model';

addIcons({ chevronForwardOutline, addOutline });

type StatusFilter = 'all' | ActionStatus;

@Component({
  selector: 'app-employee-actions-board',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, IonHeader, IonToolbar, IonContent, IonIcon, IonSearchbar, IonSegment, IonSegmentButton, IonLabel, IonSkeletonText, IonFab, IonFabButton, IonRefresher, IonRefresherContent, HeaderBrandComponent, BottomNavComponent],
  templateUrl: './actions-board.page.html',
  styleUrl: './actions-board.page.scss'
})
export class EmployeeActionsBoardPage implements OnInit {
  readonly statusFilter = signal<StatusFilter>('all');
  readonly searchTerm = signal('');

  readonly filtered = computed(() => {
    const status = this.statusFilter();
    const term = this.searchTerm().trim().toLowerCase();

    return this.actionsService
      .actions()
      .filter(a => status === 'all' || a.status === status)
      .filter(a => !term || a.title.toLowerCase().includes(term) || a.customerName.toLowerCase().includes(term))
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
  });

  constructor(
    public actionsService: ActionsService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const presetStatus = this.route.snapshot.queryParamMap.get('status') as StatusFilter | null;
    if (presetStatus) this.statusFilter.set(presetStatus);

    if (this.actionsService.actions().length === 0) {
      this.actionsService.loadMyActions();
    }
  }

  async handleRefresh(event: any): Promise<void> {
    await this.actionsService.loadMyActions();
    event.target.complete();
  }

  openAction(action: FieldAction): void {
    this.router.navigate(['/employee/actions', action.id]);
  }

  newAction(): void {
    this.router.navigate(['/employee/actions/new']);
  }
}
