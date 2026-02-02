import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth, user } from '@angular/fire/auth';
import { map, take } from 'rxjs/operators';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);

  // Verifica se existe usuário logado (user$)
  return user(auth).pipe(
    take(1), // Pega apenas o primeiro valor e completa
    map(usuario => {
      if (usuario) {
        return true; // Deixa passar
      } else {
        // Se não estiver logado, chuta para o login
        router.navigate(['/login']);
        return false;
      }
    })
  );
};