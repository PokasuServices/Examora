"use client";

import * as React from "react";
import type { CmsFaqItemDto } from "@examora/types";
import { cmsPublicApi } from "@/lib/cms-public-api";

export default function FaqPage() {
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<CmsFaqItemDto[]>([]);

  React.useEffect(() => {
    setLoading(true);
    cmsPublicApi
      .listFaq()
      .then(setItems)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-heading">Frequently asked questions</h1>

      {loading ? <p className="mt-6 text-sm text-neutral-500">Loading…</p> : null}

      {!loading && items.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">No FAQ items published yet.</p>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="mt-6 flex flex-col divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
          {items.map((item) => (
            <details key={item.id} className="group p-4">
              <summary className="cursor-pointer list-none font-medium text-neutral-900">
                {item.question}
              </summary>
              <p className="mt-2 text-sm text-neutral-600">{item.answer}</p>
            </details>
          ))}
        </div>
      ) : null}
    </main>
  );
}
