import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';
import { IndexedDbService } from './indexed-db.service';

export interface Student {
  id: number;
  name: string;
  email: string;
  english: number;
  tamil: number;
  maths: number;
  total: number;
  englishStatus: string;
  tamilStatus: string;
  mathsStatus: string;
}

export interface PaginationInfo {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedStudents {
  users: Student[];
  pagination: PaginationInfo;
}

const API = environment.apiUrl;
const TOKEN_KEY = 'faculty_token';

async function gql(query: string, variables: Record<string, unknown> = {}): Promise<unknown> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(API, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables })
  });

  // Handle rate limiting errors
  if (res.status === 429) {
    const errorData = await res.json();
    throw new Error(errorData.message || 'Too many requests. Please try again later.');
  }

  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

@Injectable({ providedIn: 'root' })
export class GraphqlService {

  constructor(private idb: IndexedDbService) {}

  /** Fetches all students from the backend and mirrors them into IndexedDB. */
  async getStudents(): Promise<Student[]> {
    const data = await gql(`{ users { id name email english tamil maths total englishStatus tamilStatus mathsStatus } }`) as { users: Student[] };
    // Sync full list into IndexedDB — visible in DevTools → Application → IndexedDB → FacultyPortalDB → students
    this.idb.saveStudents(data.users).catch(console.warn);
    return data.users;
  }

  /** Fetches paginated students with optional search and sorting from the backend. */
  async getPaginatedStudents(
    page: number = 1, 
    pageSize: number = 5, 
    search: string = '',
    sortBy: string = 'id',
    sortOrder: string = 'ASC'
  ): Promise<PaginatedStudents> {
    const data = await gql(
      `query GetPaginatedUsers($page: Int, $pageSize: Int, $search: String, $sortBy: String, $sortOrder: String) {
        paginatedUsers(page: $page, pageSize: $pageSize, search: $search, sortBy: $sortBy, sortOrder: $sortOrder) {
          users { id name email english tamil maths total englishStatus tamilStatus mathsStatus }
          pagination {
            currentPage
            pageSize
            totalPages
            totalCount
            hasNextPage
            hasPreviousPage
          }
        }
      }`,
      { page, pageSize, search: search || null, sortBy, sortOrder }
    ) as { paginatedUsers: PaginatedStudents };
    
    // Optionally sync to IndexedDB
    this.idb.saveStudents(data.paginatedUsers.users).catch(console.warn);
    
    return data.paginatedUsers;
  }

  /** Creates a student in the DB and upserts the new record into IndexedDB. */
  async createStudent(name: string, email: string): Promise<Student> {
    const data = await gql(
      `mutation Create($name: String!, $email: String!) {
        createUser(name: $name, email: $email) { id name email english tamil maths total englishStatus tamilStatus mathsStatus }
      }`,
      { name, email }
    ) as { createUser: Student };
    this.idb.saveStudent(data.createUser).catch(console.warn);
    return data.createUser;
  }

  /** Updates student info and syncs the updated record into IndexedDB. */
  async updateStudent(id: number, name: string, email: string | null): Promise<Student> {
    const data = await gql(
      `mutation Update($id: Int!, $name: String, $email: String) {
        updateUser(id: $id, name: $name, email: $email) { id name email english tamil maths total englishStatus tamilStatus mathsStatus }
      }`,
      { id, name, email }
    ) as { updateUser: Student };
    this.idb.saveStudent(data.updateUser).catch(console.warn);
    return data.updateUser;
  }

  /** Updates marks and syncs the updated record into IndexedDB. */
  async updateMarks(id: number, english: number, tamil: number, maths: number): Promise<Student> {
    const data = await gql(
      `mutation UpdateMarks($id: Int!, $english: Int!, $tamil: Int!, $maths: Int!) {
        updateMarks(id: $id, english: $english, tamil: $tamil, maths: $maths) { id name email english tamil maths total englishStatus tamilStatus mathsStatus }
      }`,
      { id, english, tamil, maths }
    ) as { updateMarks: Student };
    this.idb.saveStudent(data.updateMarks).catch(console.warn);
    return data.updateMarks;
  }

  /** Deletes a student from the DB and removes them from IndexedDB. */
  async deleteStudent(id: number): Promise<void> {
    await gql(
      `mutation Delete($id: Int!) { deleteUser(id: $id) }`,
      { id }
    );
    this.idb.removeStudent(id).catch(console.warn);
  }
}
