-- ════════════════════════════════════════════════════════════════════════════
-- Portal de Carreiras — WG Baterias
-- Novo status de vaga: FILLED ("Finalizada").
--
-- Estado terminal POSITIVO — o processo de R&S foi concluído (vaga preenchida),
-- distinto de CLOSED ("Cancelada", encerramento sem contratação). Como não está
-- em PUBLIC_JOB_STATUSES nem na policy de leitura anônima, a vaga sai do portal
-- automaticamente. Alimenta os KPIs de "Vagas Finalizadas" e "tempo de fechamento".
-- ════════════════════════════════════════════════════════════════════════════

alter type "JobStatus" add value if not exists 'FILLED' after 'CLOSED';
