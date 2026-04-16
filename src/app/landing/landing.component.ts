import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
})
export class LandingComponent {
  constructor(private router: Router) {}

  goToFacultyLogin() {
    this.router.navigate(['/login']);
  }

  goToStudentLogin() {
    this.router.navigate(['/student/login']);
  }
}
