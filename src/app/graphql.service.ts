import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';

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

const API = environment.apiUrl;

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
    const data = await gql(`{ users { id name email english tamil maths total englishStatus tamilStatus mathsStatus } }`) as { users: Student[] };
    return data.users;
  }

  async createStudent(name: string, email: string): Promise<Student> {
    const data = await gql(
      `mutation Create($name: String!, $email: String!) {
        createUser(name: $name, email: $email) { id name email english tamil maths total englishStatus tamilStatus mathsStatus }
      }`,
      { name, email }
    ) as { createUser: Student };
    return data.createUser;
  }

  async updateStudent(id: number, name: string, email: string): Promise<Student> {
    const data = await gql(
      `mutation Update($id: Int!, $name: String, $email: String) {
        updateUser(id: $id, name: $name, email: $email) { id name email english tamil maths total englishStatus tamilStatus mathsStatus }
      }`,
      { id, name, email }
    ) as { updateUser: Student };
    return data.updateUser;
  }

  async updateMarks(id: number, english: number, tamil: number, maths: number): Promise<Student> {
    const data = await gql(
      `mutation UpdateMarks($id: Int!, $english: Int!, $tamil: Int!, $maths: Int!) {
        updateMarks(id: $id, english: $english, tamil: $tamil, maths: $maths) { id name email english tamil maths total englishStatus tamilStatus mathsStatus }
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
