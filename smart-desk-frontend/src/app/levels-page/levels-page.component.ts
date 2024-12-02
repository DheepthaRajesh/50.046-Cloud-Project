import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-levels-page',
  imports: [],
  templateUrl: './levels-page.component.html',
  styleUrl: './levels-page.component.css'
})
export class LevelsPageComponent {
  level1Seats = 40; // Placeholder
  level2Seats = 60; // Placeholder

  constructor(private router: Router) {}

  goToDashboard(level: string) {
    this.router.navigate(['/dashboard', level]);
  }
}
