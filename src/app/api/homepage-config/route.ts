import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CONFIG } from "@/lib/homepage-config";

export async function GET() {
  const config = await prisma.homepageConfig.findUnique({
    where: { id: "singleton" },
  });
  return NextResponse.json(config ?? DEFAULT_CONFIG);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const body = await req.json();

  const config = await prisma.homepageConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...body },
    update: body,
  });

  return NextResponse.json(config);
}
