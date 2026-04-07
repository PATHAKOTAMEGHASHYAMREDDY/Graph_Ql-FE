import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GraphqlService, Student } from '../graphql.service';
import { AuthService, Faculty } from '../auth/auth.service';
import { ChartsComponent } from '../charts/charts.component';

export interface StoredFile {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  uploadedAt: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ChartsComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  students: Student[] = [];
  filteredStudents: Student[] = [];
  paginatedStudents: Student[] = [];
  loading = false;
  error = '';
  showCharts = false;

  faculty: Faculty | null = null;

  // Search
  searchQuery = '';

  // Pagination
  currentPage = 1;
  pageSize = 5;
  totalPages = 1;

  newName = '';
  newEmail = '';

  editingId: number | null = null;
  editName = '';
  editEmail = '';

  marksEditingId: number | null = null;
  editEnglish = 0;
  editTamil = 0;
  editMaths = 0;

  // File upload — stored in localStorage keyed as 'student_files_<id>'
  uploadedFiles: Map<number, StoredFile[]> = new Map();
  expandedFilesId: number | null = null; // which student's file panel is open

  constructor(
    private gql: GraphqlService,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.faculty = this.auth.getFaculty();
    this.loadStudents();
  }

  // ── File helpers ──────────────────────────────────────────────────────────

  private storageKey(studentId: number): string {
    return `student_files_${studentId}`;
  }

  private loadFilesFromStorage(studentId: number): StoredFile[] {
    const raw = localStorage.getItem(this.storageKey(studentId));
    return raw ? (JSON.parse(raw) as StoredFile[]) : [];
  }

  private saveFilesToStorage(studentId: number, files: StoredFile[]): void {
    localStorage.setItem(this.storageKey(studentId), JSON.stringify(files));
  }

  getFiles(studentId: number): StoredFile[] {
    if (!this.uploadedFiles.has(studentId)) {
      this.uploadedFiles.set(studentId, this.loadFilesFromStorage(studentId));
    }
    return this.uploadedFiles.get(studentId) ?? [];
  }

  fileCount(studentId: number): number {
    return this.getFiles(studentId).length;
  }

  toggleFilesPanel(studentId: number): void {
    this.expandedFilesId = this.expandedFilesId === studentId ? null : studentId;
  }

  handleFileUpload(event: Event, studentId: number): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const existingFiles = this.getFiles(studentId);
    const maxFiles = 3;
    const remaining = maxFiles - existingFiles.length;

    if (remaining <= 0) {
      alert('Maximum 3 documents allowed per student. Please remove a file before adding more.');
      input.value = '';
      return;
    }

    const filesToProcess = Array.from(input.files).slice(0, remaining);

    if (input.files.length > remaining) {
      alert(`Only ${remaining} more file(s) can be added (max 3). Extra files were skipped.`);
    }

    let pending = filesToProcess.length;

    filesToProcess.forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        alert(`"${file.name}" exceeds 5 MB and was skipped.`);
        pending--;
        if (pending === 0) {
          this.uploadedFiles.set(studentId, [...existingFiles]);
          this.saveFilesToStorage(studentId, existingFiles);
          this.expandedFilesId = studentId;
        }
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        existingFiles.push({
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: reader.result as string,
          uploadedAt: new Date().toISOString()
        });
        pending--;
        if (pending === 0) {
          this.uploadedFiles.set(studentId, [...existingFiles]);
          this.saveFilesToStorage(studentId, existingFiles);
          this.expandedFilesId = studentId; // auto-open panel to show uploaded files
        }
      };
      reader.readAsDataURL(file);
    });

    input.value = '';
  }

  removeFile(studentId: number, index: number): void {
    const files = this.getFiles(studentId);
    files.splice(index, 1);
    this.uploadedFiles.set(studentId, [...files]);
    this.saveFilesToStorage(studentId, files);
  }

  downloadFile(file: StoredFile): void {
    const a = document.createElement('a');
    a.href = file.dataUrl;
    a.download = file.name;
    a.click();
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  toggleCharts() { this.showCharts = !this.showCharts; }

  logout() { this.auth.logout(); }

  onSearch() {
    this.currentPage = 1;
    this.applyFilters();
  }

  clearSearch() {
    this.searchQuery = '';
    this.onSearch();
  }

  applyFilters() {
    // Filter students based on search query
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      this.filteredStudents = this.students.filter(s => 
        s.name.toLowerCase().includes(query) ||
        s.email.toLowerCase().includes(query) ||
        s.id.toString().includes(query)
      );
    } else {
      this.filteredStudents = [...this.students];
    }

    // Calculate pagination
    this.totalPages = Math.ceil(this.filteredStudents.length / this.pageSize);
    if (this.totalPages === 0) this.totalPages = 1;
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
    this.updatePagination();
  }

  updatePagination() {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedStudents = this.filteredStudents.slice(startIndex, endIndex);
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  get pageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    
    if (this.totalPages <= maxVisible) {
      return Array.from({ length: this.totalPages }, (_, i) => i + 1);
    }
    
    let start = Math.max(1, this.currentPage - 2);
    let end = Math.min(this.totalPages, start + maxVisible - 1);
    
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  get showingFrom(): number {
    return this.filteredStudents.length === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }

  get showingTo(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredStudents.length);
  }

  async loadStudents() {
    this.loading = true;
    this.error = '';
    try {
      this.students = (await this.gql.getStudents()).sort((a, b) => a.id - b.id);
      this.applyFilters();
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
      this.applyFilters();
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
      this.applyFilters();
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
      this.applyFilters();
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
      this.applyFilters();
    } catch (e: unknown) {
      this.error = (e as Error).message;
    } finally {
      this.loading = false;
    }
  }
}
