import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonHeader, IonToolbar, IonContent, IonIcon, AlertController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { logOutOutline, mailOutline, shieldCheckmarkOutline, chevronForwardOutline } from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';
import { HeaderBrandComponent } from '../../shared/header-brand/header-brand.component';
import { BottomNavComponent } from '../../shared/bottom-nav/bottom-nav.component';
import { ActionsService } from '../../services/actions.service';

addIcons({ logOutOutline, mailOutline, shieldCheckmarkOutline, chevronForwardOutline });

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule, RouterLink, IonHeader, IonToolbar, IonContent, IonIcon,
    HeaderBrandComponent, BottomNavComponent
  ],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss'
})
export class ProfilePage {
  constructor(
    public auth: AuthService,
    public actionsService: ActionsService,
    private alertCtrl: AlertController
  ) {}

  async confirmSignOut(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Sign out?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Sign out', role: 'destructive', handler: () => this.auth.signOut() }
      ]
    });
    await alert.present();
  }
}
