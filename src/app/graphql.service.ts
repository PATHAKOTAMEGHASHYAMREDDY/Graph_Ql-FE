import { Injectable } from '@angular/core';

export interface Student {
  id: number;
  name: string;
  email: string;
}

const API = 'http://localhost:4000/graphql';

async function gql(query: string, variables: Record<string, unknown> = {}): Promise<unknown> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

@Injectable({ providedIn: 'root' })
export class GraphqlService {

  async getStudents(): Promise<Student[]> {
    console.log('[FETCH] Getting all students...');
    const data = await gql(`{ users { id name email } }`) as { users: Student[] };
    console.log('[FETCH] Students:', data.users);
    return data.users;
  }

  async createStudent(name: string, email: string): Promise<Student> {
    console.log('[CREATE] Creating student:', { name, email });
    const data = await gql(
      `mutation Create($name: String!, $email: String!) {
        createUser(name: $name, email: $email) { id name email }
      }`,
      { name, email }
    ) as { createUser: Student };
    console.log('[CREATE] Created:', data.createUser);
    return data.createUser;
  }

  async updateStudent(id: number, name: string, email: string): Promise<Student> {
    console.log('[UPDATE] Updating student:', { id, name, email });
    const data = await gql(
      `mutation Update($id: Int!, $name: String, $email: String) {
        updateUser(id: $id, name: $name, email: $email) { id name email }
      }`,
      { id, name, email }
    ) as { updateUser: Student };
    console.log('[UPDATE] Updated:', data.updateUser);
    return data.updateUser;
  }

  async deleteStudent(id: number): Promise<void> {
    console.log('[DELETE] Deleting student id:', id);
    const data = await gql(
      `mutation Delete($id: Int!) { deleteUser(id: $id) }`,
      { id }
    ) as { deleteUser: string };
    console.log('[DELETE]', data.deleteUser);
  }
}
