import { Component, OnInit} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';


@Component({
  selector: 'app-level-dashboard',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './level-dashboard.component.html',
  styleUrl: './level-dashboard.component.css'
})
export class LevelDashboardComponent implements OnInit{
  level: string = ''; // Stores the current formatted level (e.g., Level 1 or Level 2)
  retrievedlevel: string = ''; // Stores the retrieved level (e.g., level1 or level2)
  // desks = [
  //   { id: 1, available: true },
  //   { id: 2, available: true },
  //   { id: 3, available: true },
  //   { id: 4, available: true },
  //   { id: 5, available: true },
  //   { id: 6, available: true },
  //   { id: 7, available: true },
  //   { id: 8, available: true },
  //   { id: 9, available: true },
  //   { id: 10, available: true },
  //   // Add more desks as needed
  // ];

  private apiUrl = 'http://localhost:3000/table-status';

  desks: { id: number; occupied: boolean | null }[] = [];

  occupancy: boolean | null = null;

  constructor(private route: ActivatedRoute, private router: Router, private http: HttpClient) {}

  ngOnInit() {
    // Fetch the 'level' from the route parameters
    this.retrievedlevel = this.route.snapshot.paramMap.get('level') || 'Level 1';

    // Format the level and display in desired format:
    this.level =
      this.retrievedlevel.charAt(0).toUpperCase() +
      this.retrievedlevel.slice(1).replace(/\d+/, ' $&');
    
    // Fetch desk occupancy from backend:
    this.fetchDataOccupancy([1,2,3]);
  }

  getTableStatus(tableId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/${tableId}`);
  }

  fetchDataOccupancy(tableIds: number[]): void {
    // Create an array of observables for each table ID
    const tableStatusRequests = tableIds.map((id) => this.getTableStatus(id));

    // Use forkJoin to execute all requests concurrently
    forkJoin(tableStatusRequests).subscribe({
      next: (responses) => {
        console.log('Backend Responses:', responses);
        // Map responses to the desks array
        this.desks = responses.map((response, index) => ({
          id: tableIds[index],
          occupied: response?.occupancy?.Occupancy === true,
        }));
      },
      error: (error) => {
        console.error('Error fetching table statuses:', error);
      },
    });
  }

  goToDeskTrends(deskId: number) {
    const desk = this.desks.find((d) => d.id === deskId);
    if (desk) {
      this.router.navigate(['/desk-trends', deskId], { queryParams: { occupied: desk.occupied } });
    }
  }
}
