import { Component } from '@angular/core';
import { CommonModule } from '@angular/common'; // Importante
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';

// 👇 Importando os módulos visuais bonitos
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon'; // Para colocar ícones se quiser

@Component({
  selector: 'app-login',
  standalone: true,
  // 👇 Adicione os módulos aqui na lista de imports
  imports: [
    CommonModule, 
    FormsModule, 
    MatCardModule, 
    MatInputModule, 
    MatButtonModule, 
    MatFormFieldModule,
    MatIconModule 
  ],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class LoginComponent {
  email = '';
  password = '';
  carregando = false; // Para mostrar um spinner no botão

  constructor(private authService: AuthService, private router: Router) {}

  async entrar() {
    this.carregando = true;
    try {
      await this.authService.loginEmail(this.email, this.password);
      const token = await this.authService.getAuthToken();
      
      if (token) {
        this.authService.enviarTokenParaBackend(token).subscribe({
          next: (resposta: any) => { 
            console.log('Resposta do Servidor:', resposta);
            
            // 👇 O DIVISOR DE ÁGUAS
            if (resposta.role === 'ADMIN') {
              this.router.navigate(['/advogado']); // Vai pra mesa do chefe
            } else {
              this.router.navigate(['/cliente']); // Vai pra área do cliente
            }
          },
          error: () => {
            alert('Erro de conexão com o servidor.');
            this.carregando = false;
          }
        });
      }
    } catch (e) {
      alert('Email ou senha inválidos.');
      this.carregando = false;
    }
  }
}