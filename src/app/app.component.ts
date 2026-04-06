import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './auth/auth.service';

/**
 * Root component — the single entry point rendered in index.html.
 *
 * Starts the global token watcher on init so that manual localStorage
 * deletion is detected immediately (within 1.5 s), no matter which route
 * the user is currently on.
 */
@Component({
  selector   : 'app-root',
  standalone : true,
  imports    : [RouterOutlet],
  template   : '<router-outlet></router-outlet>',
  styles     : [],
})
export class AppComponent implements OnInit {
  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    /**
     * Start the localStorage polling watcher.
     * - Checks every 1500 ms whether `faculty_token` still exists.
     * - If it has been removed (e.g. via DevTools) while the user is logged
     *   in, `AuthService.expireSession()` is called automatically, which:
     *     1. Stops the watcher
     *     2. Clears localStorage
     *     3. Redirects to /login?expired=true
     *     4. Shows an alert: "Session expired. Please log in again."
     *     5. Restarts the watcher for the next login
     */
    this.authService.startTokenWatch();
  }
}
