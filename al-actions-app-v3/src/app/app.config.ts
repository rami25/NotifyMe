import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { routes } from './app.routes';
import { authInterceptor } from './services/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideIonicAngular({ mode: 'md' }), // one consistent look on iOS + Android for a corporate app
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor]))
  ]
};
