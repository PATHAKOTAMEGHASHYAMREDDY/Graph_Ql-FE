# Student Analytics Charts

## Overview
The charts component provides comprehensive data visualization for student performance analysis.

## Features

### 1. Total Students Count (Bar Chart)
- Displays the total number of students in the system

### 2. Top 5 Students by Total Marks (Horizontal Bar Chart)
- Shows the top 5 performing students based on total marks
- Sorted in descending order by total score

### 3. Subject-wise Average Marks (Bar Chart)
- Displays average marks for each subject (English, Tamil, Maths)
- Helps identify which subjects students perform best/worst in

### 4. Pass/Fail Distribution (Pie Chart)
- Shows the ratio of students who passed all subjects vs those who failed
- A student passes if they score 40+ in all three subjects

### 5. Subject-wise Performance for All Students (Grouped Bar Chart)
- Displays marks for all three subjects for each student
- Allows comparison across students and subjects

## How to Use

1. Click the "📊 Show Charts" button in the top-right corner
2. The sidebar will slide in from the right showing all charts
3. Charts automatically update when student data changes
4. Click "✕ Close Charts" to hide the sidebar

## Technical Details

- Built with Chart.js library
- Standalone Angular component
- Responsive design with mobile support
- Real-time data updates
- Clean, modern UI with proper spacing and colors

## Chart Types Used

- **Bar Charts**: For counts, rankings, and comparisons
- **Pie Charts**: For distribution analysis
- **Grouped Bar Charts**: For multi-dimensional comparisons
