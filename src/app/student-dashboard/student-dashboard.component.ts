import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { StudentAuthService, Student } from '../auth/student-auth.service';
import { WebSocketService, MarksUpdate } from '../websocket.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './student-dashboard.component.html',
  styleUrl: './student-dashboard.component.css'
})
export class StudentDashboardComponent implements OnInit, OnDestroy {
  student: Student | null = null;
  loading = false;
  wsConnected = false;
  showUpdateNotification = false;
  updateMessage = 'Your profile has been updated!';
  
  private marksSubscription?: Subscription;
  private connectionSubscription?: Subscription;

  constructor(
    private auth: StudentAuthService,
    private router: Router,
    private wsService: WebSocketService
  ) {}

  ngOnInit() {
    this.student = this.auth.getStudent();
    
    // Connect to WebSocket for real-time updates
    const token = this.auth.getToken();
    if (token) {
      this.wsService.connect(token);
      
      // Subscribe to connection status
      this.connectionSubscription = this.wsService.connected$.subscribe(connected => {
        this.wsConnected = connected;
        console.log(`🔌 WebSocket ${connected ? 'connected' : 'disconnected'}`);
      });
      
      // Subscribe to marks updates
      this.marksSubscription = this.wsService.marksUpdate$.subscribe(update => {
        if (!update) return;
        
        // Handle account deletion
        if ((update as any).type === 'account_deleted') {
          console.log('🚫 Account deleted by faculty');
          alert('Your account has been deleted by faculty. You will be logged out.');
          this.wsService.disconnect();
          this.auth.logout();
          return;
        }
        
        // Handle profile/marks updates
        if (this.student && update.id === this.student.id) {
          console.log('📊 Received profile/marks update:', update);
          
          // Check what changed
          const nameChanged = update.name !== this.student.name;
          const marksChanged = update.english !== this.student.english || 
                              update.tamil !== this.student.tamil || 
                              update.maths !== this.student.maths;
          
          // Update student data
          this.student = {
            ...this.student,
            name: update.name,
            email: update.email,
            english: update.english,
            tamil: update.tamil,
            maths: update.maths,
            total: update.total,
            englishStatus: update.englishStatus,
            tamilStatus: update.tamilStatus,
            mathsStatus: update.mathsStatus
          };
          
          // Update localStorage
          localStorage.setItem('student_data', JSON.stringify(this.student));
          
          // Set notification message based on what changed
          if (nameChanged && marksChanged) {
            this.updateMessage = 'Your name and marks have been updated!';
          } else if (nameChanged) {
            this.updateMessage = 'Your name has been updated!';
          } else if (marksChanged) {
            this.updateMessage = 'Your marks have been updated!';
          }
          
          // Show notification
          this.showUpdateNotification = true;
          setTimeout(() => {
            this.showUpdateNotification = false;
          }, 5000);
          
          // Log what changed
          if (nameChanged && marksChanged) {
            console.log('✨ Name and marks updated');
          } else if (nameChanged) {
            console.log('✨ Name updated');
          } else if (marksChanged) {
            console.log('✨ Marks updated');
          }
        }
      });
    }
  }

  ngOnDestroy() {
    if (this.marksSubscription) {
      this.marksSubscription.unsubscribe();
    }
    if (this.connectionSubscription) {
      this.connectionSubscription.unsubscribe();
    }
    this.wsService.disconnect();
  }

  logout() {
    this.wsService.disconnect();
    this.auth.logout();
  }

  getInitial(): string {
    return this.student?.name ? this.student.name.charAt(0).toUpperCase() : 'S';
  }

  get totalPercentage(): number {
    if (!this.student) return 0;
    return Math.round((this.student.total / 300) * 100);
  }

  get overallStatus(): string {
    if (!this.student) return 'N/A';
    const allPass = this.student.englishStatus === 'Pass' && 
                    this.student.tamilStatus === 'Pass' && 
                    this.student.mathsStatus === 'Pass';
    return allPass ? 'Pass' : 'Fail';
  }

  getStatusClass(status: string): string {
    return status === 'Pass' ? 'status-pass' : 'status-fail';
  }

  getGrade(): string {
    const percentage = this.totalPercentage;
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 40) return 'D';
    return 'F';
  }

  getGradeClass(): string {
    const grade = this.getGrade();
    if (grade.startsWith('A')) return 'grade-a';
    if (grade.startsWith('B')) return 'grade-b';
    if (grade.startsWith('C')) return 'grade-c';
    if (grade.startsWith('D')) return 'grade-d';
    return 'grade-f';
  }
}
