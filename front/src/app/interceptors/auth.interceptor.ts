import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler
} from '@angular/common/http';
import { from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Auth } from '@angular/fire/auth';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private auth: Auth) {}

  intercept(req: HttpRequest<any>, next: HttpHandler) {

    return from(this.auth.currentUser?.getIdToken() ?? Promise.resolve(null))
      .pipe(
        switchMap(token => {

          if (!token) return next.handle(req);

          const clone = req.clone({
            setHeaders: {
              Authorization: `Bearer ${token}`
            }
          });

          return next.handle(clone);
        })
      );
  }
}