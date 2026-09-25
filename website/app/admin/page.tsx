import { redirect } from 'next/navigation';

// The admin's only section today is the blog.
export default function AdminIndex() {
  redirect('/admin/blog');
}
