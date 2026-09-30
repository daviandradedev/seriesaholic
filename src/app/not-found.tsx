import { ErrorState } from "@/components/ErrorState";
import { getTranslator } from "@/lib/i18n";

export default async function NotFound() {
  const { t } = await getTranslator();

  return (
    <ErrorState
      code="404"
      title={t("notFoundTitle")}
      description={t("notFoundBody")}
    />
  );
}
