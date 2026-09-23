import { Component, OnInit, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonContent, IonRefresher, IonRefresherContent,
  IonIcon, IonSkeletonText, IonItem, IonLabel, IonInput
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronForwardOutline, fileTrayOutline, locationOutline, timeOutline } from 'ionicons/icons';
import { ActionsService } from '../../services/actions.service';
import { HeaderBrandComponent } from '../../shared/header-brand/header-brand.component';
import { BottomNavComponent } from '../../shared/bottom-nav/bottom-nav.component';
import { FieldAction } from '../../models/action.model';

addIcons({ chevronForwardOutline, fileTrayOutline, locationOutline, timeOutline });

@Component({
  selector: 'app-actions-list',
  standalone: true,
  imports: [
    CommonModule, DatePipe,
    IonHeader, IonToolbar, IonContent, IonRefresher, IonRefresherContent,
    IonIcon, IonSkeletonText, IonItem, IonLabel, IonInput,
    HeaderBrandComponent, BottomNavComponent
  ],
  templateUrl: './actions-list.page.html',
  styleUrl: './actions-list.page.scss'
})
export class ActionsListPage implements OnInit {
  readonly selectedFromDate = signal<string>('');
  readonly selectedToDate = signal<string>('');

  readonly filteredPlan = computed(() => {
    const fromDateValue = this.selectedFromDate().trim();
    const toDateValue = this.selectedToDate().trim();
    const base = this.actionsService.plan();

    if (!fromDateValue && !toDateValue) return base;

    return base.filter(action => {
      const deadline = new Date(action.deadline);
      deadline.setHours(0, 0, 0, 0);

      if (fromDateValue) {
        const fromDate = new Date(`${fromDateValue}T00:00:00`);
        fromDate.setHours(0, 0, 0, 0);
        if (deadline.getTime() < fromDate.getTime()) return false;
      }

      if (toDateValue) {
        const toDate = new Date(`${toDateValue}T00:00:00`);
        toDate.setHours(0, 0, 0, 0);
        if (deadline.getTime() > toDate.getTime()) return false;
      }

      return true;
    });
  });

  constructor(public actionsService: ActionsService, private router: Router) {}

  ngOnInit(): void {
    this.actionsService.loadMyActions();
  }

  async handleRefresh(event: any): Promise<void> {
    await this.actionsService.loadMyActions();
    event.target.complete();
  }

  openAction(action: FieldAction): void {
    this.router.navigate(['/action', action.id]);
  }

  isDueSoon(action: FieldAction): boolean {
    const hoursLeft = (new Date(action.deadline).getTime() - Date.now()) / 36e5;
    return action.status === 'in_progress' && hoursLeft <= 24 && hoursLeft > 0;
  }

  clearDateFilter(): void {
    this.selectedFromDate.set('');
    this.selectedToDate.set('');
  }
}
