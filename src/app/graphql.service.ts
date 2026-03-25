import { Injectable } from '@angular/core';

export interface Student {
  id: number;
  name: string;
  email: string;
  english: number;
  tamil: number;
  maths: number;
  total: number;
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
    const data = await gql(`{ users { id name email english tamil maths total } }`) as { users: Student[] };
    return data.users;
  }

  async createStudent(name: string, email: string): Promise<Student> {
    const data = await gql(
      `mutation Create($name: String!, $email: String!) {
        createUser(name: $name, email: $email) { id name email english tamil maths total }
      }`,
      { name, email }
    ) as { createUser: Student };
    return data.createUser;
  }

  async updateStudent(id: number, name: string, email: string): Promise<Student> {
    const data = await gql(
      `mutation Update($id: Int!, $name: String, $email: String) {
        updateUser(id: $id, name: $name, email: $email) { id name email english tamil maths total }
      }`,
      { id, name, email }
    ) as { updateUser: Student };
    return data.updateUser;
  }

  async updateMarks(id: number, english: number, tamil: number, maths: number): Promise<Student> {
    const data = await gql(
      `mutation UpdateMarks($id: Int!, $english: Int!, $tamil: Int!, $maths: Int!) {
        updateMarks(id: $id, english: $english, tamil: $tamil, maths: $maths) { id name email english tamil maths total }
      }`,
      { id, english, tamil, maths }
    ) as { updateMarks: Student };
    return data.updateMarks;
  }

  async deleteStudent(id: number): Promise<void> {
    await gql(
      `mutation Delete($id: Int!) { deleteUser(id: $id) }`,
      { id }
    );
  }
}
