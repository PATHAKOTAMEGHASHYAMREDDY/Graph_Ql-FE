import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GraphqlService, Student } from './graphql.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  students: Student[] = [];
  loading = false;
  error = '';

  // Add form
  newName = '';
  newEmail = '';

  // Edit state
  editingId: number | null = null;
  editName = '';
  editEmail = '';

  constructor(private gql: GraphqlService) {}

  ngOnInit() {
    this.loadStudents();
  }

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
      this.students = [...this.students, student];
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
