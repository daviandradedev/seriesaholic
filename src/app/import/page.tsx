import { ImportScreen } from "@/components/ImportScreen";
import { SignInRequired } from "@/components/SignInRequired";
import { getOptionalUserId } from "@/lib/session-user";
import { pageMetadata } from "@/lib/i18n";

export function generateMetadata() {
  return pageMetadata("importTitle");
}

export default async function ImportPage() {
  if (!(await getOptionalUserId())) return <SignInRequired />;
  return <ImportScreen />;
}
