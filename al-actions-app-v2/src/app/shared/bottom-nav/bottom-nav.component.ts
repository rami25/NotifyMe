import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IonIcon, IonBadge } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  listOutline, checkmarkDoneOutline, personOutline,
  gridOutline, peopleOutline
} from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';

addIcons({ listOutline, checkmarkDoneOutline, personOutline, gridOutline, peopleOutline });

/**
 * Single bottom nav used on every "list-level" screen, for both roles.
 * Previously employees and admins had two separate components
 * (al-bottom-nav vs al-admin-nav), which meant an admin's nav changed
 * shape depending on which section of the app they were in — e.g. still
 * showing the employee's Plan/History/Profile tabs on /profile even
 * though every other admin screen showed Dashboard/Actions/Users. Making
 * this one role-aware component fixes that: the tab set now reflects
 * `auth.isAdmin()` consistently everywhere it's used, and admins also
 * get a "My Plan" tab so they can reach their own assigned actions
 * (finish/cancel) without leaving the admin section.
 */
@Component({
  selector: 'al-bottom-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, IonIcon, IonBadge],
  template: `
    @if (auth.isAdmin()) {
      <nav class="al-bottom-nav">
        <a routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="al-nav-item">
          <ion-icon name="grid-outline"></ion-icon>
          <span>Dashboard</span>
        </a>
        <a routerLink="/plan" routerLinkActive="active" class="al-nav-item">
          <ion-icon name="list-outline"></ion-icon>
          <span>My Plan</span>
        </a>
        <a routerLink="/admin/actions" routerLinkActive="active" class="al-nav-item">
          <span class="al-nav-icon-wrap">
            <ion-icon name="checkmark-done-outline"></ion-icon>
            @if (overdueCount > 0) {
              <ion-badge color="brand-red" class="al-nav-badge">{{ overdueCount }}</ion-badge>
            }
          </span>
          <span>Actions</span>
        </a>
        <a routerLink="/admin/users" routerLinkActive="active" class="al-nav-item">
          <ion-icon name="people-outline"></ion-icon>
          <span>Users</span>
        </a>
        <a routerLink="/profile" routerLinkActive="active" class="al-nav-item">
          <ion-icon name="person-outline"></ion-icon>
          <span>Profile</span>
        </a>
      </nav>
    } @else {
      <nav class="al-bottom-nav">
        <a routerLink="/plan" routerLinkActive="active" class="al-nav-item">
          <span class="al-nav-icon-wrap">
            <ion-icon name="list-outline"></ion-icon>
            @if (overdueCount > 0) {
              <ion-badge color="brand-red" class="al-nav-badge">{{ overdueCount }}</ion-badge>
            }
          </span>
          <span>Plan</span>
        </a>
        <a routerLink="/finished" routerLinkActive="active" class="al-nav-item">
          <ion-icon name="checkmark-done-outline"></ion-icon>
          <span>History</span>
        </a>
        <a routerLink="/profile" routerLinkActive="active" class="al-nav-item">
          <ion-icon name="person-outline"></ion-icon>
          <span>Profile</span>
        </a>
      </nav>
    }
  `,
  styles: [`
    .al-bottom-nav {
      display: flex;
      border-top: 1px solid var(--al-hairline);
      background: var(--al-white);
      padding-bottom: env(safe-area-inset-bottom);
    }
    .al-nav-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 8px 0 6px;
      font-size: 10.5px;
      font-weight: 500;
      color: var(--al-ink-soft);
      text-decoration: none;

      ion-icon {
        font-size: 20px;
      }

      &.active {
        color: var(--al-blue);
      }
    }
    .al-nav-icon-wrap {
      position: relative;
      display: inline-flex;
    }
    .al-nav-badge {
      position: absolute;
      top: -4px;
      right: -8px;
      font-size: 9px;
      min-width: 15px;
      height: 15px;
      padding: 0 4px;
    }
  `]
})
export class BottomNavComponent {
  @Input() overdueCount = 0;

  constructor(public auth: AuthService) {}
}
