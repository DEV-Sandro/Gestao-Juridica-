import { Routes } from '@angular/router';
import { LoginComponent } from './login/login';
import { DashboardComponent } from './dashboard/dashboard'; // Vamos manter por enquanto
import { AjudaComponent } from './ajuda/ajuda';
import { DetalhesProcessoComponent } from './detalhes-processo/detalhes-processo';
import { ModuloAdvogadoComponent } from './modulo-advogado/modulo-advogado';
import { ModuloClienteComponent } from './modulo-cliente/modulo-cliente';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'ajuda', component: AjudaComponent },
  
  // Rotas da Jornada
  { path: 'advogado', component: ModuloAdvogadoComponent },
  { path: 'cliente', component: ModuloClienteComponent },
  { path: 'processo/:id', component: DetalhesProcessoComponent },
  // Rota antiga (vamos desativar em breve)
  { path: 'dashboard', component: DashboardComponent } 
];