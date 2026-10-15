import { Location } from '@angular/common';
import { Router } from '@angular/router';

/** Retorna à aba anterior do aplicativo; um acesso direto volta à página inicial. */
export function voltarOuIrParaInicio(location: Location, router: Router): void {
  const navegacaoInterna = Number(window.history.state?.navigationId) > 1;
  if (navegacaoInterna && window.history.length > 1) {
    location.back();
  } else {
    void router.navigateByUrl('/');
  }
}
