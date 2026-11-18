import { SettingsScreen } from "@/components/SettingsScreen";
import { SignInRequired } from "@/components/SignInRequired";
import { getOptionalUserId } from "@/lib/session-user";
import { pageMetadata } from "@/lib/i18n";

export function generateMetadata() {
  return pageMetadata("settingsPage");
}

export default async function SettingsPage() {
  if (!(await getOptionalUserId())) return <SignInRequired />;
  return <SettingsScreen />;
}
