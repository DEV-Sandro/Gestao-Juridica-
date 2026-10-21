import { Location } from '@angular/common';
import { Router } from '@angular/router';

/** Retorna à rota interna anterior quando ela é conhecida. */
export function voltarOuIrParaInicio(location: Location, router: Router): void {
  const retornoExplicito = window.history.state?.returnTo;
  if (typeof retornoExplicito === 'string' && /^\/(?:$|advogado\/(dashboard|processos|clientes|agenda|documentos|financeiro|calculadoras)(\?.*)?$|ajuda$|politica-de-privacidade$)/.test(retornoExplicito) && retornoExplicito !== router.url) {
    void router.navigateByUrl(retornoExplicito, { replaceUrl: true });
    return;
  }
  const anterior = sessionStorage.getItem('justapro-rota-anterior');
  const rotaInterna = anterior && anterior.startsWith('/') && !anterior.startsWith('//') && !anterior.startsWith('/login') && anterior !== router.url;
  if (rotaInterna && window.history.length > 1) {
    location.back();
  } else {
    void router.navigateByUrl('/');
  }
}

export function rotaDeRetornoAoEscritorio(): string {
  const retornoExplicito = window.history.state?.returnTo;
  if (typeof retornoExplicito === 'string' && /^\/advogado\/(dashboard|processos|clientes|agenda|documentos|financeiro|calculadoras)(\?.*)?$/.test(retornoExplicito)) return retornoExplicito;
  const anterior = sessionStorage.getItem('justapro-rota-anterior');
  return anterior && /^\/advogado\/(dashboard|processos|clientes|agenda|documentos|financeiro|calculadoras)(\?.*)?$/.test(anterior)
    ? anterior : '/advogado/dashboard';
}
