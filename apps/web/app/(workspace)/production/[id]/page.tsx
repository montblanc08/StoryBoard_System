import { redirect } from 'next/navigation';

export default async function ProductionEntry({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/production/${encodeURIComponent(id)}/shots`);
}
