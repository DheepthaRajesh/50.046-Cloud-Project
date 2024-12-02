import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-desk-trends',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './desk-trends.component.html',
  styleUrl: './desk-trends.component.css'
})
export class DeskTrendsComponent {
  occupied: boolean | null = null;

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      this.occupied = params['occupied'] === 'true'; // Convert string to boolean
    });
  }

}
