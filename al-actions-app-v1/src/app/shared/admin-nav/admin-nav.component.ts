import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IonIcon, IonBadge } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { gridOutline, listOutline, peopleOutline, personCircleOutline } from 'ionicons/icons';

addIcons({ gridOutline, listOutline, peopleOutline, personCircleOutline });

@Component({
  selector: 'al-admin-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IonIcon, IonBadge],
  template: `
    <nav class="al-bottom-nav">
      <a routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="al-nav-item">
        <ion-icon name="grid-outline"></ion-icon>
        <span>Dashboard</span>
      </a>
      <a routerLink="/admin/actions" routerLinkActive="active" class="al-nav-item">
        <span class="al-nav-icon-wrap">
          <ion-icon name="list-outline"></ion-icon>
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
        <ion-icon name="person-circle-outline"></ion-icon>
        <span>Profile</span>
      </a>
    </nav>
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
      font-size: 11px;
      font-weight: 500;
      color: var(--al-ink-soft);
      text-decoration: none;

      ion-icon { font-size: 21px; }
      &.active { color: var(--al-blue); }
    }
    .al-nav-icon-wrap { position: relative; display: inline-flex; }
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
export class AdminNavComponent {
  @Input() overdueCount = 0;
}
