import { Injectable, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

export interface JpNavigationLink {
  label: string;
  path: string;
  icon: string;
  exact?: boolean;
}

interface NavigationSection {
  title: string;
  paths: string[];
  links: JpNavigationLink[];
}

const NAVIGATION_SECTIONS: NavigationSection[] = [
  {
    title: 'Operacao',
    paths: ['/advogado/dashboard', '/advogado/processos', '/advogado/agenda'],
    links: [
      { label: 'Visao geral', path: '/advogado/dashboard', icon: 'dashboard', exact: true },
      { label: 'Processos', path: '/advogado/processos', icon: 'folder_special' },
      { label: 'Agenda e prazos', path: '/advogado/agenda', icon: 'calendar_month' }
    ]
  },
  {
    title: 'Clientes',
    paths: ['/advogado/clientes'],
    links: [{ label: 'Base de clientes', path: '/advogado/clientes', icon: 'people' }]
  },
  {
    title: 'Financeiro',
    paths: ['/advogado/financeiro', '/advogado/rentabilidade'],
    links: [
      { label: 'Visao financeira', path: '/advogado/financeiro', icon: 'account_balance_wallet' },
      { label: 'Rentabilidade', path: '/advogado/rentabilidade', icon: 'insights' }
    ]
  },
  {
    title: 'Documentos',
    paths: ['/advogado/documentos'],
    links: [{ label: 'Central de documentos', path: '/advogado/documentos', icon: 'description' }]
  },
  {
    title: 'Conta',
    paths: ['/perfil', '/equipe', '/auditoria', '/ajuda'],
    links: [
      { label: 'Meu perfil', path: '/perfil', icon: 'person' },
      { label: 'Equipe', path: '/equipe', icon: 'groups' },
      { label: 'Auditoria', path: '/auditoria', icon: 'fact_check' },
      { label: 'Central de ajuda', path: '/ajuda', icon: 'help_outline' }
    ]
  }
];

@Injectable({ providedIn: 'root' })
export class NavigationStateService {
  readonly sectionTitle = signal('Operacao');
  readonly subnavLinks = signal<JpNavigationLink[]>(NAVIGATION_SECTIONS[0].links);

  constructor(private readonly router: Router) {
    this.atualizar(this.router.url);
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.atualizar(event.urlAfterRedirects));
  }

  private atualizar(url: string): void {
    const section = NAVIGATION_SECTIONS.find((item) => item.paths.some((path) => url.startsWith(path))) ??
      NAVIGATION_SECTIONS[0];

    this.sectionTitle.set(section.title);
    this.subnavLinks.set(section.links);
  }
}
