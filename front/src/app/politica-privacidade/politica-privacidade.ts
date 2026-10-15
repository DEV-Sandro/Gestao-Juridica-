import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-politica-privacidade',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './politica-privacidade.html',
  styleUrls: ['./politica-privacidade.scss']
})
export class PoliticaPrivacidadeComponent implements OnInit {
  ngOnInit(): void {
    document.body.setAttribute('data-theme', 'light');
    document.documentElement.style.colorScheme = 'light';
  }
}
