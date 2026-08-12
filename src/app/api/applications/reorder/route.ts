import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  orders: z
    .array(z.object({ id: z.string().min(1), sortOrder: z.number().int() }))
    .min(1)
    .max(500),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const supabase = await createClient();

  await Promise.all(
    parsed.data.orders.map(({ id, sortOrder }) =>
      supabase.from("applications").update({ sort_order: sortOrder } as never).eq("id", id),
    ),
  );

  return NextResponse.json({ ok: true });
}
