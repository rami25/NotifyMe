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
      this.router.navigateByUrl('/plan', { replaceUrl: true });
    } else {
      this.errorMessage.set(result.message);
    }
  }
}
