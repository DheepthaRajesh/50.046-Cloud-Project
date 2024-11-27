import { Component, OnInit} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-level-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './level-dashboard.component.html',
  styleUrl: './level-dashboard.component.css'
})
export class LevelDashboardComponent implements OnInit{
  level: string = ''; // Stores the current level (e.g., 1 or 2)
  desks = [
    { id: 1, available: true },
    { id: 2, available: false },
    { id: 3, available: true },
    // Add more desks as needed
  ];

  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit() {
    // Fetch the 'level' from the route parameters
    this.level = this.route.snapshot.paramMap.get('level') || '1';
  }

  goToDeskTrends(deskId: number) {
    // Navigate to desk details page with the desk's ID
    this.router.navigate(['/desk-trends', deskId]);
  }
}
