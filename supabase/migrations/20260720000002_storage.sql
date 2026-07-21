-- Fase 5 — Storage (Vercel Blob → Supabase Storage)
--
-- Dois buckets PRIVADOS (public = false):
--   • resumes                — currículos das candidaturas (até 5 MB)
--   • admission-attachments  — anexos das admissões (até 10 MB)
--
-- LGPD: os buckets NÃO são públicos. Todo acesso (upload/download/remove) é
-- server-side via service_role, que ignora as policies de storage.objects. O
-- download só acontece em rota autenticada, transmitindo o arquivo pelo servidor
-- (a URL/objeto bruto nunca é exposta ao cliente). Não criamos policies para a
-- chave anon: sem service_role, nada acessa estes buckets.

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('resumes', 'resumes', false, 5242880),
  ('admission-attachments', 'admission-attachments', false, 10485760)
on conflict (id) do nothing;
