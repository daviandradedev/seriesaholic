import { SettingsScreen } from "@/components/SettingsScreen";
import { SignInRequired } from "@/components/SignInRequired";
import { getOptionalUserId } from "@/lib/session-user";

export default async function SettingsPage() {
  if (!(await getOptionalUserId())) return <SignInRequired />;
  return <SettingsScreen />;
}
