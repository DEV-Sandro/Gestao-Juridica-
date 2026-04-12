import { ApplicationConfig, provideZoneChangeDetection, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  provideHttpClient,
  withInterceptors,
  HttpInterceptorFn
} from '@angular/common/http';

import { from } from 'rxjs';
import { switchMap } from 'rxjs/operators';

// Firebase
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth, Auth } from '@angular/fire/auth';
import { provideStorage, getStorage } from '@angular/fire/storage';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';

import { routes } from './app.routes';
import { environment } from '../environments/environment';

const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);

  return from(auth.currentUser?.getIdToken() ?? Promise.resolve(null)).pipe(
    switchMap((token) => {
      if (!token) {
        return next(req);
      }

      const clonedReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });

      return next(clonedReq);
    })
  );
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideAnimations(),
    provideRouter(routes),
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: {
        appearance: 'outline',
        floatLabel: 'always'
      }
    },
    provideHttpClient(
      withInterceptors([authInterceptor])
    ),

    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    provideStorage(() => getStorage())
  ]
};
