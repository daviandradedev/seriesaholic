"use client";

import NextTopLoader from "nextjs-toploader";

export function TopLoader() {
  return (
    <NextTopLoader
      color="#8b5cf6"
      initialPosition={0.08}
      crawlSpeed={200}
      height={3}
      crawl
      showSpinner={false}
      easing="ease"
      speed={200}
      shadow="0 0 10px #8b5cf6,0 0 5px #8b5cf6"
    />
  );
}
