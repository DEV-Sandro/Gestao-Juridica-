import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet], // <--- Importante
  // 👇 AQUI ESTÁ O SEGREDO: O template TEM que ter isso
  template: `
    <router-outlet></router-outlet>
  `,
  styleUrls: ['./app.scss']
})
export class AppComponent {
  title = 'front';
}