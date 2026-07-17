import type { ChannelAdapter } from "../types";
import { createOrganizationPost } from "../linkedin";

// Canal LinkedIn (página): posta a vaga no feed da organização. Toda a lógica
// de token/conexão/API fica em ../linkedin; o adapter só delega.
export const linkedinAdapter: ChannelAdapter = {
  channel: "LINKEDIN_PAGE",
  async publish(job) {
    return createOrganizationPost(job);
  },
};
