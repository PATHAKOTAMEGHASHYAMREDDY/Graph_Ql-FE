import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GraphqlService, Student, PaginationInfo } from '../graphql.service';
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
  loading = false;
  error = '';
  showCharts = false;

  faculty: Faculty | null = null;

  // Search
  searchQuery = '';

  // Backend Pagination
  pagination: PaginationInfo = {
    currentPage: 1,
    pageSize: 5,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
    hasPreviousPage: false
  };

  // Sorting
  sortBy: string = 'id';
  sortOrder: string = 'ASC';

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

  // ── Backend Pagination & Search ───────────────────────────────────────────

  async onSearch() {
    this.pagination.currentPage = 1;
    await this.loadStudents();
  }

  clearSearch() {
    this.searchQuery = '';
    this.onSearch();
  }

  // ── Sorting ────────────────────────────────────────────────────────────────

  async sortByColumn(column: string) {
    if (this.sortBy === column) {
      // Toggle sort order if clicking same column
      this.sortOrder = this.sortOrder === 'ASC' ? 'DESC' : 'ASC';
    } else {
      // New column, default to ASC
      this.sortBy = column;
      this.sortOrder = 'ASC';
    }
    this.pagination.currentPage = 1; // Reset to first page when sorting
    await this.loadStudents();
  }

  getSortIcon(column: string): string {
    if (this.sortBy !== column) {
      return '↕'; // Both arrows when not sorted by this column
    }
    return this.sortOrder === 'ASC' ? '↑' : '↓';
  }

  // ── Pagination ─────────────────────────────────────────────────────────────

  async goToPage(page: number) {
    if (page >= 1 && page <= this.pagination.totalPages) {
      this.pagination.currentPage = page;
      await this.loadStudents();
    }
  }

  async nextPage() {
    if (this.pagination.hasNextPage) {
      this.pagination.currentPage++;
      await this.loadStudents();
    }
  }

  async previousPage() {
    if (this.pagination.hasPreviousPage) {
      this.pagination.currentPage--;
      await this.loadStudents();
    }
  }

  get pageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    
    if (this.pagination.totalPages <= maxVisible) {
      return Array.from({ length: this.pagination.totalPages }, (_, i) => i + 1);
    }
    
    let start = Math.max(1, this.pagination.currentPage - 2);
    let end = Math.min(this.pagination.totalPages, start + maxVisible - 1);
    
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  get showingFrom(): number {
    return this.pagination.totalCount === 0 ? 0 : (this.pagination.currentPage - 1) * this.pagination.pageSize + 1;
  }

  get showingTo(): number {
    return Math.min(this.pagination.currentPage * this.pagination.pageSize, this.pagination.totalCount);
  }

  async loadStudents() {
    this.loading = true;
    this.error = '';
    try {
      const result = await this.gql.getPaginatedStudents(
        this.pagination.currentPage,
        this.pagination.pageSize,
        this.searchQuery.trim(),
        this.sortBy,
        this.sortOrder
      );
      this.students = result.users;
      this.pagination = result.pagination;
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
      await this.gql.createStudent(this.newName.trim(), this.newEmail.trim());
      this.newName = '';
      this.newEmail = '';
      // Reload current page to show new student
      await this.loadStudents();
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
      await this.gql.updateStudent(id, this.editName.trim(), this.editEmail.trim());
      this.cancelEdit();
      // Reload current page to show updated student
      await this.loadStudents();
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
      await this.gql.updateMarks(id, this.editEnglish, this.editTamil, this.editMaths);
      this.cancelMarksEdit();
      // Reload current page to show updated marks
      await this.loadStudents();
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
      // Reload current page after deletion
      await this.loadStudents();
    } catch (e: unknown) {
      this.error = (e as Error).message;
    } finally {
      this.loading = false;
    }
  }
}
