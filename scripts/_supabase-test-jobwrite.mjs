import { createClient } from "@supabase/supabase-js";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const pass = (c) => (c ? "✅ PASS" : "❌ FAIL");

// admin logado
const adm = createClient(URL, ANON, { auth: { persistSession: false } });
const si = await adm.auth.signInWithPassword({ email: "murilo.bremer@wgbaterias.com.br", password: "WgTeste#2026" });
if (si.error) throw new Error("login: " + si.error.message);

const base = { title: "Write RLS", city: "SP", state: "SP", modality: "PRESENTIAL", description: "d", responsibilities: "r", requiredRequirements: "req", status: "DRAFT", slug: "write-rls-" + Date.now() };

const ins = await adm.from("jobs").insert(base).select().single();
console.log("admin INSERT:", pass(!ins.error && ins.data?.id), ins.error?.message ?? "");
const id = ins.data?.id;

const upd = await adm.from("jobs").update({ title: "Write RLS v2" }).eq("id", id).select().single();
console.log("admin UPDATE:", pass(!upd.error && upd.data?.title === "Write RLS v2"), upd.error?.message ?? "");

// anon NÃO pode inserir
const anon = createClient(URL, ANON, { auth: { persistSession: false } });
const anonIns = await anon.from("jobs").insert({ ...base, slug: "anon-" + Date.now() }).select().single();
console.log("anon INSERT negado:", pass(!!anonIns.error), `(err=${anonIns.error?.code ?? "NENHUM — FALHA"})`);

const del = await adm.from("jobs").delete().eq("id", id);
console.log("admin DELETE:", pass(!del.error), del.error?.message ?? "");
