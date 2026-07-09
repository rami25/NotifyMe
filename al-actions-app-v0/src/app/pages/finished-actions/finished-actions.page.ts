import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { IonHeader, IonToolbar, IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { archiveOutline, chevronForwardOutline } from 'ionicons/icons';
import { ActionsService } from '../../services/actions.service';
import { HeaderBrandComponent } from '../../shared/header-brand/header-brand.component';
import { BottomNavComponent } from '../../shared/bottom-nav/bottom-nav.component';
import { FieldAction } from '../../models/action.model';

addIcons({ archiveOutline, chevronForwardOutline });

@Component({
  selector: 'app-finished-actions',
  standalone: true,
  imports: [
    CommonModule, DatePipe,
    IonHeader, IonToolbar, IonContent, IonIcon,
    HeaderBrandComponent, BottomNavComponent
  ],
  templateUrl: './finished-actions.page.html',
  styleUrl: './finished-actions.page.scss'
})
export class FinishedActionsPage implements OnInit {
  constructor(public actionsService: ActionsService, private router: Router) {}

  ngOnInit(): void {
    if (this.actionsService.plan().length === 0) {
      this.actionsService.loadMyActions();
    }
  }

  openAction(action: FieldAction): void {
    this.router.navigate(['/action', action.id]);
  }
}
