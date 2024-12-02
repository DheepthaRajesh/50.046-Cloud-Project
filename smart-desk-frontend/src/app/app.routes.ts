import { Routes } from '@angular/router';
import { LandingPageComponent } from './landing-page/landing-page.component';
import { LevelsPageComponent } from './levels-page/levels-page.component';
import { LevelDashboardComponent } from './level-dashboard/level-dashboard.component';
import { DeskTrendsComponent } from './desk-trends/desk-trends.component';

export const routes: Routes = [
    { path: '', component: LandingPageComponent },
    { path: 'levels', component: LevelsPageComponent },
    { path: 'dashboard/:level', component: LevelDashboardComponent },
    { path: 'desk-trends/:id', component: DeskTrendsComponent },
];
