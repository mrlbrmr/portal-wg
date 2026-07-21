import type { JobStatus } from "@/types/domain";
import { PUBLIC_JOB_STATUSES } from "@/lib/utils";

// Lista tipada para uso em queries Prisma (where: { status: { in: PUBLIC_JOB_STATUS_LIST } }).
// Deriva de PUBLIC_JOB_STATUSES (utils, client-safe) para manter uma única fonte de verdade.
export const PUBLIC_JOB_STATUS_LIST = [...PUBLIC_JOB_STATUSES] as JobStatus[];
