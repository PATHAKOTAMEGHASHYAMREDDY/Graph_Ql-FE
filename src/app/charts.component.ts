import { Component, Input, OnChanges, SimpleChanges, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Student } from './graphql.service';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-charts',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="charts-container">
      <div class="charts-grid">
        <div class="chart-section">
          <h3>Total Students</h3>
          <canvas #studentCountChart></canvas>
        </div>

        <div class="chart-section">
          <h3>Top 5 Students</h3>
          <canvas #topStudentsChart></canvas>
        </div>

        <div class="chart-section">
          <h3>Subject Average</h3>
          <canvas #subjectAvgChart></canvas>
        </div>

        <div class="chart-section">
          <h3>Pass/Fail</h3>
          <canvas #passFailChart></canvas>
        </div>
      </div>

      <div class="chart-section-full">
        <h3>All Students Performance</h3>
        <canvas #allSubjectsChart></canvas>
      </div>
    </div>
  `,
  styles: [`
    .charts-container {
      padding: 0;
      background: transparent;
    }

    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }

    .chart-section {
      background: white;
      padding: 16px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    .chart-section h3 {
      margin: 0 0 12px 0;
      color: #1a1a2e;
      font-size: 0.95rem;
      font-weight: 600;
    }

    .chart-section-full {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    .chart-section-full h3 {
      margin: 0 0 16px 0;
      color: #1a1a2e;
      font-size: 1.1rem;
      font-weight: 600;
    }

    canvas {
      max-height: 200px;
      width: 100% !important;
      height: auto !important;
    }

    .chart-section-full canvas {
      max-height: 280px;
    }

    @media (max-width: 768px) {
      .charts-grid {
        grid-template-columns: 1fr;
      }

      canvas {
        max-height: 180px;
      }

      .chart-section-full canvas {
        max-height: 240px;
      }
    }
  `]
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
