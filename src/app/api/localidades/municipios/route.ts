import { NextResponse } from "next/server";

// GET /api/localidades/municipios — nomes dos municípios brasileiros (IBGE) para o
// autocompletar de cidade do formulário público de candidatura. Busca no servidor
// para a CSP não precisar liberar o domínio do IBGE no connect-src do navegador.
// A lista quase nunca muda: cache de 1 dia no Data Cache e na CDN.

const IBGE_MUNICIPIOS_URL =
  "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome";
const ONE_DAY = 24 * 60 * 60;

export async function GET() {
  try {
    const res = await fetch(IBGE_MUNICIPIOS_URL, { next: { revalidate: ONE_DAY } });
    if (!res.ok) throw new Error(`IBGE respondeu ${res.status}`);

    const municipios = (await res.json()) as Array<{ nome: string }>;
    // Há homônimos em UFs diferentes; o datalist só precisa do nome uma vez.
    const nomes = [...new Set(municipios.map((m) => m.nome))];

    return NextResponse.json(nomes, {
      headers: {
        "Cache-Control": `public, max-age=${ONE_DAY}, s-maxage=${ONE_DAY}, stale-while-revalidate=${7 * ONE_DAY}`,
      },
    });
  } catch (err) {
    console.error("[localidades/municipios] falha ao buscar no IBGE:", err);
    return NextResponse.json([], { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
