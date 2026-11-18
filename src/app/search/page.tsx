import { SearchScreen } from "@/components/SearchScreen";
import { pageMetadata } from "@/lib/i18n";

export function generateMetadata() {
  return pageMetadata("searchTitle");
}

export default function SearchPage() {
  return <SearchScreen />;
}
