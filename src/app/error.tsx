"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ErrorState";
import { usePreferences } from "@/components/Preferences";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = usePreferences();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      code="500"
      title={t("errorTitle")}
      description={t("errorBody")}
      action={
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/10 px-4 py-2.5 text-sm font-medium text-violet-300 hover:bg-violet-500/20"
        >
          {t("tryAgain")}
        </button>
      }
    />
  );
}
