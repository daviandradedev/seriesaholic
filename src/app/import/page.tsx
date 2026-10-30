import { ImportScreen } from "@/components/ImportScreen";
import { SignInRequired } from "@/components/SignInRequired";
import { getOptionalUserId } from "@/lib/session-user";

export default async function ImportPage() {
  if (!(await getOptionalUserId())) return <SignInRequired />;
  return <ImportScreen />;
}
