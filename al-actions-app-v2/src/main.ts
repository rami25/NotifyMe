import { bootstrapApplication } from '@angular/platform-browser';
import { SplashScreen } from '@capacitor/splash-screen';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { AuthService } from './app/services/auth.service';

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
