import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AppUser } from '../models/user.model';
import { Capacitor } from '@capacitor/core';

const SESSION_KEY = 'al_session_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  /** Reactive current-user signal consumed by the header, guards, and profile page */
  readonly currentUser = signal<AppUser | null>(null);
  readonly ready = signal(false);

  constructor(private http: HttpClient, private router: Router) {}

  /** Restores a previous session on app boot, before routes resolve. */
  async restoreSession(): Promise<void> {
    const token = localStorage.getItem(SESSION_KEY);
    if (token) {
      try {
        const user = await firstValueFrom(
          this.http.get<AppUser>(`${environment.apiBaseUrl}/auth/me`)
        );
        this.currentUser.set(user);
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }
    this.ready.set(true);
  }

  async signInWithGoogle(): Promise<{ ok: true } | { ok: false; message: string }> {
    if (Capacitor.getPlatform() === 'web') {
        return this.signInWithGoogleWeb();
    } else {
      let googleUser;
      try {
        googleUser = await GoogleAuth.signIn();
      } catch (err) {
        return { ok: false, message: "Sign-in was cancelled or failed. Try again." };
      }

      const email = googleUser.authentication ? googleUser.email : googleUser.email;

      if (!email || !email.toLowerCase().endsWith(`@${environment.googleWorkspaceDomain}`)) {
        await GoogleAuth.signOut();
        return {
          ok: false,
          message: `Sign in with your @${environment.googleWorkspaceDomain} account. Personal Google accounts aren't allowed.`
        };
      }

      try {
        const idToken = googleUser.authentication.idToken;
        const res = await firstValueFrom(
          this.http.post<{ token: string; user: AppUser }>(
            `${environment.apiBaseUrl}/auth/google`,
            { idToken }
          )
        );

        if (!res.user.active) {
          return { ok: false, message: 'Your account has been deactivated. Contact an admin.' };
        }

        localStorage.setItem(SESSION_KEY, res.token);
        return { ok: true };
      } catch {
        return { ok: false, message: "Couldn't reach the server. Check your connection and try again." };
      }
    }
  }

  private signInWithGoogleWeb(): Promise<{ ok: true } | { ok: false; message: string }> {
    return new Promise((resolve) => {
      // @ts-ignore - google is loaded globally by the GIS script
      google.accounts.id.initialize({
        client_id: environment.googleClientId,
        callback: async (response: any) => {
          const idToken = response.credential;

          try {
            const res = await firstValueFrom(
              this.http.post<{ token: string; user: AppUser }>(
                `${environment.apiBaseUrl}/auth/google`,
                { idToken }
              )
            );

            if (!res.user.active) {
              resolve({ ok: false, message: 'Your account has been deactivated. Contact an admin.' });
              return;
            }

            localStorage.setItem(SESSION_KEY, res.token);
            this.currentUser.set(res.user);
            console.log('check : ', res.user.role);
            resolve({ ok: true });
          } catch {
            resolve({ ok: false, message: "Couldn't reach the server. Check your connection and try again." });
          }
        }
      });

      // @ts-ignore
      google.accounts.id.prompt();
    });
  }

  async signOut(): Promise<void> {
    localStorage.removeItem(SESSION_KEY);
    this.currentUser.set(null);
    try {
      await GoogleAuth.signOut();
    } catch {
      // no-op — user is signed out locally regardless
    }
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  isAdmin(): boolean {
    return this.currentUser()?.role === 'admin';
  }
}
