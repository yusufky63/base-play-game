import { ProfileClient } from "@/components/profile/ProfileClient";

export default async function PublicProfilePage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  return <ProfileClient address={address} />;
}
