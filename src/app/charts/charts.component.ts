import { Component, Input, OnChanges, SimpleChanges, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Student } from '../graphql.service';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-charts',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './charts.component.html',
  styleUrl: './charts.component.css'
})
export class ChartsComponent implements OnChanges, AfterViewInit {
  @Input() students: Student[] = [];

  @ViewChild('studentCountChart') studentCountCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('topStudentsChart') topStudentsCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('subjectAvgChart') subjectAvgCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('passFailChart') passFailCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('allSubjectsChart') allSubjectsCanvas!: ElementRef<HTMLCanvasElement>;

  private charts: Chart[] = [];
  private viewInitialized = false;

  ngAfterViewInit() {
    this.viewInitialized = true;
    this.renderCharts();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['students'] && this.viewInitialized) {
      this.renderCharts();
    }
  }

  private destroyCharts() {
    this.charts.forEach(chart => chart.destroy());
    this.charts = [];
  }

  private renderCharts() {
    if (!this.students || this.students.length === 0) return;

    this.destroyCharts();

    this.renderStudentCountChart();
    this.renderTopStudentsChart();
    this.renderSubjectAverageChart();
    this.renderPassFailChart();
    this.renderAllSubjectsChart();
  }

  private renderStudentCountChart() {
    const ctx = this.studentCountCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: ['Total Students'],
        datasets: [{
          label: 'Count',
          data: [this.students.length],
          backgroundColor: '#4CAF50',
          borderColor: '#45a049',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, font: { size: 10 } }
          },
          x: {
            ticks: { font: { size: 10 } }
          }
        }
      }
    };

    this.charts.push(new Chart(ctx, config));
  }

  private renderTopStudentsChart() {
    const ctx = this.topStudentsCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const sortedStudents = [...this.students]
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: sortedStudents.map(s => s.name),
        datasets: [{
          label: 'Marks',
          data: sortedStudents.map(s => s.total),
          backgroundColor: '#2196F3',
          borderColor: '#1976D2',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            beginAtZero: true,
            max: 300,
            ticks: { font: { size: 10 } }
          },
          y: {
            ticks: { font: { size: 10 } }
          }
        }
      }
    };

    this.charts.push(new Chart(ctx, config));
  }

  private renderSubjectAverageChart() {
    const ctx = this.subjectAvgCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const avgEnglish = this.students.reduce((sum, s) => sum + s.english, 0) / this.students.length;
    const avgTamil = this.students.reduce((sum, s) => sum + s.tamil, 0) / this.students.length;
    const avgMaths = this.students.reduce((sum, s) => sum + s.maths, 0) / this.students.length;

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: ['English', 'Tamil', 'Maths'],
        datasets: [{
          label: 'Avg',
          data: [avgEnglish, avgTamil, avgMaths],
          backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56'],
          borderColor: ['#FF6384', '#36A2EB', '#FFCE56'],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: { font: { size: 10 } }
          },
          x: {
            ticks: { font: { size: 10 } }
          }
        }
      }
    };

    this.charts.push(new Chart(ctx, config));
  }

  private renderPassFailChart() {
    const ctx = this.passFailCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const passCount = this.students.filter(s => 
      s.englishStatus === 'Pass' && s.tamilStatus === 'Pass' && s.mathsStatus === 'Pass'
    ).length;
    const failCount = this.students.length - passCount;

    const config: ChartConfiguration = {
      type: 'pie',
      data: {
        labels: ['Pass', 'Fail'],
        datasets: [{
          data: [passCount, failCount],
          backgroundColor: ['#4CAF50', '#F44336'],
          borderColor: ['#fff', '#fff'],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { font: { size: 10 }, padding: 8 }
          }
        }
      }
    };

    this.charts.push(new Chart(ctx, config));
  }

  private renderAllSubjectsChart() {
    const ctx = this.allSubjectsCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: this.students.map(s => s.name),
        datasets: [
          {
            label: 'English',
            data: this.students.map(s => s.english),
            backgroundColor: '#FF6384',
            borderColor: '#FF6384',
            borderWidth: 1
          },
          {
            label: 'Tamil',
            data: this.students.map(s => s.tamil),
            backgroundColor: '#36A2EB',
            borderColor: '#36A2EB',
            borderWidth: 1
          },
          {
            label: 'Maths',
            data: this.students.map(s => s.maths),
            backgroundColor: '#FFCE56',
            borderColor: '#FFCE56',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: { font: { size: 11 } }
          },
          x: {
            ticks: { font: { size: 10 } }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { size: 11 }, padding: 10 }
          }
        }
      }
    };

    this.charts.push(new Chart(ctx, config));
  }
}
