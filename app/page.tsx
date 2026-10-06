import { redirect } from 'next/navigation';

export default function HomePage() {
  // Root redirects to login page for supervisors/HR
  // Trainees access via /a/[cycle-slug]
  redirect('/login');
}
