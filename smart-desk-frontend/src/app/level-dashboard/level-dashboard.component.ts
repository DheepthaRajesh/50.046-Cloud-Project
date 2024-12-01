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
  level: string = ''; // Stores the current formatted level (e.g., Level 1 or Level 2)
  retrievedlevel: string = ''; // Stores the retrieved level (e.g., level1 or level2)
  desks = [
    { id: 1, available: true },
    { id: 2, available: false },
    { id: 3, available: true },
    { id: 4, available: true },
    { id: 5, available: false },
    { id: 6, available: true },
    { id: 7, available: true },
    { id: 8, available: true },
    { id: 9, available: false },
    { id: 10, available: true },
    // Add more desks as needed
  ];

  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit() {
    // Fetch the 'level' from the route parameters
    this.retrievedlevel = this.route.snapshot.paramMap.get('level') || 'Level 1';

    // Format the level and display in desired format:
    this.level =
      this.retrievedlevel.charAt(0).toUpperCase() +
      this.retrievedlevel.slice(1).replace(/\d+/, ' $&');
  }

  goToDeskTrends(deskId: number) {
    // Navigate to desk details page with the desk's ID
    this.router.navigate(['/desk-trends', deskId]);
  }
}
