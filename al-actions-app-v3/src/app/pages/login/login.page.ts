import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonContent, IonSpinner
} from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [IonContent, IonSpinner],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss'
})
export class LoginPage {
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  constructor(private auth: AuthService, private router: Router) {}

  async signIn(): Promise<void> {
    this.errorMessage.set(null);
    this.submitting.set(true);
    const result = await this.auth.signInWithGoogle();
    this.submitting.set(false);

    if (result.ok) {
      // Admins land on the Dashboard, not the employee Plan — they still
      // reach their own Plan via the "My Plan" tab (see BottomNavComponent).
      const landingRoute = this.auth.isAdmin() ? '/admin' : '/plan';
      this.router.navigateByUrl(landingRoute, { replaceUrl: true });
    } else {
      this.errorMessage.set(result.message);
    }
  }
}
