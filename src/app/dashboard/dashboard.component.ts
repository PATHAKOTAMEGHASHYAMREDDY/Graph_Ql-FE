import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GraphqlService, Student } from '../graphql.service';
import { AuthService, Faculty } from '../auth/auth.service';
import { ChartsComponent } from '../charts/charts.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ChartsComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  students: Student[] = [];
  loading = false;
  error = '';
  showCharts = false;

  faculty: Faculty | null = null;

  newName = '';
  newEmail = '';

  editingId: number | null = null;
  editName = '';
  editEmail = '';

  marksEditingId: number | null = null;
  editEnglish = 0;
  editTamil = 0;
  editMaths = 0;

  constructor(
    private gql: GraphqlService,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.faculty = this.auth.getFaculty();
    this.loadStudents();
  }

  toggleCharts() { this.showCharts = !this.showCharts; }

  logout() { this.auth.logout(); }

  async loadStudents() {
    this.loading = true;
    this.error = '';
    try {
      this.students = (await this.gql.getStudents()).sort((a, b) => a.id - b.id);
    } catch (e: unknown) {
      this.error = (e as Error).message;
    } finally {
      this.loading = false;
    }
  }

  async addStudent() {
    if (!this.newName.trim() || !this.newEmail.trim()) return;
    this.loading = true;
    this.error = '';
    try {
      const student = await this.gql.createStudent(this.newName.trim(), this.newEmail.trim());
      this.students = [...this.students, student].sort((a, b) => a.id - b.id);
      this.newName = '';
      this.newEmail = '';
    } catch (e: unknown) {
      this.error = (e as Error).message;
    } finally {
      this.loading = false;
    }
  }

  startEdit(student: Student) {
    this.editingId = student.id;
    this.editName = student.name;
    this.editEmail = student.email;
    this.marksEditingId = null;
  }

  cancelEdit() {
    this.editingId = null;
    this.editName = '';
    this.editEmail = '';
  }

  async saveEdit(id: number) {
    if (!this.editName.trim() || !this.editEmail.trim()) return;
    this.loading = true;
    this.error = '';
    try {
      const updated = await this.gql.updateStudent(id, this.editName.trim(), this.editEmail.trim());
      this.students = this.students.map(s => s.id === id ? updated : s);
      this.cancelEdit();
    } catch (e: unknown) {
      this.error = (e as Error).message;
    } finally {
      this.loading = false;
    }
  }

  startMarksEdit(student: Student) {
    this.marksEditingId = student.id;
    this.editEnglish = student.english;
    this.editTamil = student.tamil;
    this.editMaths = student.maths;
    this.editingId = null;
  }

  cancelMarksEdit() {
    this.marksEditingId = null;
    this.editEnglish = 0;
    this.editTamil = 0;
    this.editMaths = 0;
  }

  async saveMarks(id: number) {
    if (this.editEnglish < 0 || this.editEnglish > 100 ||
        this.editTamil < 0 || this.editTamil > 100 ||
        this.editMaths < 0 || this.editMaths > 100) {
      this.error = 'Marks must be between 0 and 100';
      return;
    }
    this.loading = true;
    this.error = '';
    try {
      const updated = await this.gql.updateMarks(id, this.editEnglish, this.editTamil, this.editMaths);
      this.students = this.students.map(s => s.id === id ? updated : s);
      this.cancelMarksEdit();
    } catch (e: unknown) {
      this.error = (e as Error).message;
    } finally {
      this.loading = false;
    }
  }

  async deleteStudent(id: number) {
    if (!confirm('Delete this student?')) return;
    this.loading = true;
    this.error = '';
    try {
      await this.gql.deleteStudent(id);
      this.students = this.students.filter(s => s.id !== id);
    } catch (e: unknown) {
      this.error = (e as Error).message;
    } finally {
      this.loading = false;
    }
  }
}
