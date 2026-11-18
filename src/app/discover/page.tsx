import { DiscoverCatalog } from "@/components/DiscoverCatalog";
import { getCurrentUser } from "@/lib/api/auth";
import { pageMetadata } from "@/lib/i18n";

export function generateMetadata() {
  return pageMetadata("discoverTitle");
}

export default async function DiscoverPage() {
  const user = await getCurrentUser();
  return <DiscoverCatalog signedIn={user !== null} />;
}
