import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-landing-page',
  imports: [],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.css'
})
export class LandingPageComponent {
  totalSeats = 100; // Placeholder
  level1Seats = 40; // Placeholder
  level2Seats = 60; // Placeholder

  constructor(private router: Router) {}

  goToLevels() {
    this.router.navigate(['/levels']); // Navigate to the levels page
  }
}
