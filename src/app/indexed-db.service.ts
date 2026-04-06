import { Injectable } from '@angular/core';

/**
 * IndexedDbService
 * ─────────────────────────────────────────────────────────────────────────────
 * Mirrors data from the PostgreSQL backend into the browser's IndexedDB so it
 * is visible under Application → Storage → IndexedDB in DevTools.
 *
 * Database : FacultyPortalDB  (version 1)
 * Stores   :
 *   • "faculty"  — one record per login session (keyPath: "id")
 *   • "students" — all students fetched from the backend (keyPath: "id")
 */
@Injectable({ providedIn: 'root' })
export class IndexedDbService {

  private readonly DB_NAME    = 'FacultyPortalDB';
  private readonly DB_VERSION = 1;
  private db: IDBDatabase | null = null;

  // ── Open / initialise ─────────────────────────────────────────────────────

  private openDb(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db);

    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      req.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Faculty store — holds logged-in faculty profile + token
        if (!db.objectStoreNames.contains('faculty')) {
          db.createObjectStore('faculty', { keyPath: 'id' });
        }

        // Students store — mirrors all rows from the "users" table in PostgreSQL
        if (!db.objectStoreNames.contains('students')) {
          const store = db.createObjectStore('students', { keyPath: 'id' });
          store.createIndex('by_name',  'name',  { unique: false });
          store.createIndex('by_email', 'email', { unique: false });
        }
      };

      req.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      req.onerror = () => reject(req.error);
    });
  }

  // ── Generic helpers ───────────────────────────────────────────────────────

  private put<T>(storeName: string, record: T): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const db  = await this.openDb();
      const tx  = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).put(record);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  private deleteRecord(storeName: string, key: IDBValidKey): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const db  = await this.openDb();
      const tx  = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).delete(key);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  private clearStore(storeName: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const db  = await this.openDb();
      const tx  = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).clear();
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  // ── Public: Faculty ───────────────────────────────────────────────────────

  /**
   * Saves logged-in faculty profile along with their JWT token into IndexedDB.
   * Visible in DevTools → Application → IndexedDB → FacultyPortalDB → faculty
   */
  async saveFaculty(faculty: object, token: string): Promise<void> {
    await this.put('faculty', { ...faculty, token });
  }

  /** Removes the faculty record on logout / session expiry. */
  async clearFaculty(): Promise<void> {
    await this.clearStore('faculty');
  }

  // ── Public: Students ──────────────────────────────────────────────────────

  /**
   * Replaces the entire students store with the latest list from the backend.
   * Call this whenever you fetch / refresh the student list.
   */
  async saveStudents(students: object[]): Promise<void> {
    await this.clearStore('students');
    for (const student of students) {
      await this.put('students', student);
    }
  }

  /** Upserts a single student (after create / update / marks change). */
  async saveStudent(student: object): Promise<void> {
    await this.put('students', student);
  }

  /** Removes a student record after deletion. */
  async removeStudent(id: number): Promise<void> {
    await this.deleteRecord('students', id);
  }
}
