import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IonIcon, IonBadge } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { listOutline, checkmarkDoneOutline, personOutline } from 'ionicons/icons';

addIcons({ listOutline, checkmarkDoneOutline, personOutline });

@Component({
  selector: 'al-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IonIcon, IonBadge],
  template: `
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

      ion-icon {
        font-size: 22px;
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
}
