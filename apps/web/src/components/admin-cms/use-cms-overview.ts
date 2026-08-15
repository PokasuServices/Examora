"use client";

import * as React from "react";
import { useCmsApi } from "@/lib/cms-api";

type Status = "loading" | "ready" | "error";

export interface CmsTypeCounts {
  total: number;
  published: number;
}

export function useCmsOverview() {
  const api = useCmsApi();
  const [status, setStatus] = React.useState<Status>("loading");
  const [pages, setPages] = React.useState<CmsTypeCounts>({ total: 0, published: 0 });
  const [faq, setFaq] = React.useState<CmsTypeCounts>({ total: 0, published: 0 });
  const [announcements, setAnnouncements] = React.useState<CmsTypeCounts>({
    total: 0,
    published: 0,
  });
  const [banners, setBanners] = React.useState<CmsTypeCounts>({ total: 0, published: 0 });
  const [mediaTotal, setMediaTotal] = React.useState(0);

  const load = React.useCallback(() => {
    setStatus("loading");
    Promise.all([
      api.pages.list({ pageSize: 1 }),
      api.pages.list({ pageSize: 1, status: "PUBLISHED" }),
      api.faq.list({ pageSize: 1 }),
      api.faq.list({ pageSize: 1, status: "PUBLISHED" }),
      api.announcements.list({ pageSize: 1 }),
      api.announcements.list({ pageSize: 1, status: "PUBLISHED" }),
      api.banners.list({ pageSize: 1 }),
      api.banners.list({ pageSize: 1, status: "PUBLISHED" }),
      api.assets.list({ pageSize: 1 }),
    ])
      .then(
        ([
          pagesTotal,
          pagesPublished,
          faqTotal,
          faqPublished,
          announcementsTotal,
          announcementsPublished,
          bannersTotal,
          bannersPublished,
          assetsTotal,
        ]) => {
          setPages({ total: pagesTotal.total, published: pagesPublished.total });
          setFaq({ total: faqTotal.total, published: faqPublished.total });
          setAnnouncements({
            total: announcementsTotal.total,
            published: announcementsPublished.total,
          });
          setBanners({ total: bannersTotal.total, published: bannersPublished.total });
          setMediaTotal(assetsTotal.total);
          setStatus("ready");
        },
      )
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return { status, pages, faq, announcements, banners, mediaTotal, retry: load };
}
