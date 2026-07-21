"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import JobCard from "@/components/public/JobCard";
import { AnimateIn } from "@/components/ui/AnimateIn";
import type { Job } from "@/types/domain";
import type { HomepageConfigData } from "@/lib/homepage-config";

interface Props {
  initialJobs: Job[];
  total: number;
  filters: {
    city?: string;
    modality?: string;
    department?: string;
    query?: string;
  };
  config: HomepageConfigData;
  pageSize: number;
}

export function LoadMoreJobs({ initialJobs, total, filters, config, pageSize }: Props) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const hasMore = jobs.length < total;

  async function loadMore() {
    setLoading(true);
    const nextPage = page + 1;
    const params = new URLSearchParams({ page: String(nextPage), limit: String(pageSize) });
    if (filters.city) params.set("city", filters.city);
    if (filters.modality) params.set("modality", filters.modality);
    if (filters.department) params.set("department", filters.department);
    if (filters.query) params.set("query", filters.query);

    try {
      const res = await fetch(`/api/jobs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setJobs((prev) => [...prev, ...(data.jobs as Job[])]);
        setPage(nextPage);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {jobs.map((job, i) => (
          <AnimateIn key={job.id} delay={Math.min(i, 8) * 60}>
            <JobCard job={job} config={config} />
          </AnimateIn>
        ))}
      </div>

      {hasMore && (
        <div className="mt-8 text-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="inline-flex items-center gap-2 border border-wg-border hover:border-wg-green/50 text-wg-gray hover:text-wg-green px-7 py-2.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando...
              </>
            ) : (
              `Carregar mais (${total - jobs.length} restantes)`
            )}
          </button>
        </div>
      )}
    </>
  );
}
