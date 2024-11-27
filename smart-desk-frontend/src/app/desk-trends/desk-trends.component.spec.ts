import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeskTrendsComponent } from './desk-trends.component';

describe('DeskTrendsComponent', () => {
  let component: DeskTrendsComponent;
  let fixture: ComponentFixture<DeskTrendsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeskTrendsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeskTrendsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
