import { bootstrapApplication } from '@angular/platform-browser';
import { SplashScreen } from '@capacitor/splash-screen';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { AuthService } from './app/services/auth.service';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

if (Capacitor.getPlatform() !== 'web') {
  GoogleAuth.initialize({
  clientId: '271237633904-k8mihjqai35i3pl6hrosk615sdp2mkec.apps.googleusercontent.com',
  scopes: ['profile', 'email'],
  grantOfflineAccess: true 
  });
}

bootstrapApplication(AppComponent, appConfig)
  .then(async appRef => {
    // Keep the native splash (logo on white) up until we know whether
    // there's a valid session, so the app never flashes the login
    // screen for an already-signed-in employee.
    const auth = appRef.injector.get(AuthService);
    await auth.restoreSession();
    await SplashScreen.hide();
  })
  .catch(err => console.error(err));
