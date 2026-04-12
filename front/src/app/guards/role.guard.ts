import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom, filter, take } from 'rxjs';
import { AuthService } from '../auth.service';
import { UserRole } from '../models/app-user.model';

/**
 * Guard funcional que aceita uma lista de roles permitidos.
 * Aguarda a primeira emissão de um usuário não-nulo no AuthService antes de decidir
 * (necessário porque o BehaviorSubject pode emitir null durante o boot inicial).
 */
export function roleGuard(...rolesPermitidos: UserRole[]): CanActivateFn {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const user = await firstValueFrom(
      auth.currentUser$.pipe(
        filter((u) => u !== null),
        take(1)
      )
    );

    if (user && rolesPermitidos.includes(user.role)) {
      return true;
    }
    return router.createUrlTree(['/login']);
  };
}

/** Guard simples: exige apenas estar autenticado. */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const user = await firstValueFrom(
    auth.currentUser$.pipe(
      filter((u) => u !== null),
      take(1)
    )
  );

  if (user) return true;
  return router.createUrlTree(['/login']);
};
