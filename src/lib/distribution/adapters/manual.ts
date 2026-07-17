import type { ChannelAdapter } from "../types";

// Canal "manual": não chama API nenhuma. Publicar = registrar que a vaga foi
// divulgada manualmente (o RH copia o texto pronto e cola onde quiser). O
// externalUrl é a própria URL pública da vaga.
export const manualAdapter: ChannelAdapter = {
  channel: "MANUAL",
  async publish(job) {
    return { ok: true, externalUrl: job.url };
  },
  async remove() {
    return { ok: true };
  },
};
