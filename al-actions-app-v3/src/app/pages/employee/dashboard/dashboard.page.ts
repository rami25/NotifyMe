import { Component, OnInit, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonContent, IonIcon, IonSkeletonText } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline, checkmarkDoneCircleOutline, timeOutline,
  addCircleOutline, listOutline, closeCircleOutline
} from 'ionicons/icons';
import { ActionsService } from '../../../services/actions.service';
import { HeaderBrandComponent } from '../../../shared/header-brand/header-brand.component';
import { BottomNavComponent } from '../../../shared/bottom-nav/bottom-nav.component';

addIcons({ alertCircleOutline, checkmarkDoneCircleOutline, timeOutline, addCircleOutline, listOutline, closeCircleOutline });

@Component({
  selector: 'app-employee-dashboard',
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonContent, IonIcon, IonSkeletonText, HeaderBrandComponent, BottomNavComponent],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss'
})
export class EmployeeDashboardPage implements OnInit {
  readonly activeCount = computed(() => this.actionsService.plan().length);
  readonly overdueCount = computed(() => this.actionsService.plan().filter(a => a.status === 'postponed').length);
  readonly finishedCount = computed(() => this.actionsService.finishedOrCancelled().filter(a => a.status === 'finished').length);
  readonly cancelledCount = computed(() => this.actionsService.finishedOrCancelled().filter(a => a.status === 'cancelled').length);

  constructor(public actionsService: ActionsService, private router: Router) {}

  ngOnInit(): void {
    this.actionsService.loadMyActions();
  }

  goToBoard(filter?: string): void {
    this.router.navigate(['/employee/actions'], filter ? { queryParams: { status: filter } } : {});
  }

  goToNewAction(): void {
    this.router.navigate(['/employee/actions/new']);
  }
}
