import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonContent, IonIcon, IonSkeletonText } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline, checkmarkDoneCircleOutline, timeOutline, peopleOutline,
  addCircleOutline, listOutline, personAddOutline
} from 'ionicons/icons';
import { AdminService } from '../../../services/admin.service';
import { HeaderBrandComponent } from '../../../shared/header-brand/header-brand.component';
import { AdminNavComponent } from '../../../shared/admin-nav/admin-nav.component';

addIcons({
  alertCircleOutline, checkmarkDoneCircleOutline, timeOutline, peopleOutline,
  addCircleOutline, listOutline, personAddOutline
});

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule, IonHeader, IonToolbar, IonContent, IonIcon, IonSkeletonText,
    HeaderBrandComponent, AdminNavComponent
  ],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss'
})
export class AdminDashboardPage implements OnInit {
  constructor(public admin: AdminService, private router: Router) {}

  ngOnInit(): void {
    this.admin.loadAllActions();
    this.admin.loadUsers();
  }

  goToBoard(filter?: string): void {
    this.router.navigate(['/admin/actions'], filter ? { queryParams: { status: filter } } : {});
  }

  goToNewAction(): void {
    this.router.navigate(['/admin/actions/new']);
  }

  goToUsers(): void {
    this.router.navigate(['/admin/users']);
  }
}
