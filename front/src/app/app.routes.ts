import { Routes } from '@angular/router';
import { LoginComponent } from './login/login';
import { AjudaComponent } from './ajuda/ajuda';
import { DetalhesProcessoComponent } from './detalhes-processo/detalhes-processo';
import { ModuloAdvogadoComponent } from './modulo-advogado/modulo-advogado';
import { ModuloClienteComponent } from './modulo-cliente/modulo-cliente';
import { AcceptInviteComponent } from './features/invite/accept-invite.component';
import { authGuard, roleGuard } from './guards/role.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'convite/aceitar', component: AcceptInviteComponent },
  { path: 'ajuda', component: AjudaComponent },

  // Rotas da Jornada
  { path: 'advogado', redirectTo: 'advogado/dashboard', pathMatch: 'full' },
  {
    path: 'advogado/dashboard',
    component: ModuloAdvogadoComponent,
    canActivate: [authGuard],
    data: { sidebarSection: 'dashboard' }
  },
  {
    path: 'advogado/processos',
    component: ModuloAdvogadoComponent,
    canActivate: [authGuard],
    data: { sidebarSection: 'processos' }
  },
  {
    path: 'advogado/clientes',
    component: ModuloAdvogadoComponent,
    canActivate: [authGuard],
    data: { sidebarSection: 'clientes' }
  },
  {
    path: 'advogado/agenda',
    component: ModuloAdvogadoComponent,
    canActivate: [authGuard],
    data: { sidebarSection: 'agenda' }
  },
  {
    path: 'advogado/documentos',
    component: ModuloAdvogadoComponent,
    canActivate: [authGuard],
    data: { sidebarSection: 'documentos' }
  },
  { path: 'cliente', component: ModuloClienteComponent, canActivate: [authGuard] },
  { path: 'processo/:id', component: DetalhesProcessoComponent, canActivate: [authGuard] },

  // Perfil & Equipe (lazy loading)
  {
    path: 'perfil',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/perfil/meu-perfil/meu-perfil.component').then(
        (m) => m.MeuPerfilComponent
      )
  },
  {
    path: 'equipe',
    canActivate: [roleGuard('ADMIN')],
    loadComponent: () =>
      import('./features/perfil/equipe/equipe.component').then((m) => m.EquipeComponent)
  },

  // Rota antiga (vamos desativar em breve)
  { path: 'dashboard', redirectTo: 'advogado/dashboard', pathMatch: 'full' }
];
