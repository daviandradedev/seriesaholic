import { DiscoverCatalog } from "@/components/DiscoverCatalog";
import { getCurrentUser } from "@/lib/api/auth";

export default async function DiscoverPage() {
  const user = await getCurrentUser();
  return <DiscoverCatalog signedIn={user !== null} />;
}
