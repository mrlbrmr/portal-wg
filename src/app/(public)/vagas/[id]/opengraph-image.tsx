import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { MODALITY_LABELS } from "@/lib/utils";
import { PUBLIC_JOB_STATUS_LIST } from "@/lib/job-visibility";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function findJob(slugOrId: string) {
  return (
    (await prisma.job.findFirst({
      where: { slug: slugOrId, status: { in: PUBLIC_JOB_STATUS_LIST } },
      select: { title: true, city: true, state: true, department: true, modality: true },
    })) ??
    (await prisma.job.findFirst({
      where: { id: slugOrId, status: { in: PUBLIC_JOB_STATUS_LIST } },
      select: { title: true, city: true, state: true, department: true, modality: true },
    }))
  );
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await findJob(id);

  const title = job?.title ?? "Vaga de Emprego";
  const location = job ? `${job.city} / ${job.state}` : "Brasil";
  const modality = job ? MODALITY_LABELS[job.modality] : "";
  const department = job?.department ?? "";

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://carreiraswg.vercel.app";

  let logoSrc: string | undefined;
  try {
    const res = await fetch(`${baseUrl}/logo-wg-branca.png`);
    if (res.ok) {
      const buf = await res.arrayBuffer();
      logoSrc = `data:image/png;base64,${Buffer.from(buf).toString("base64")}`;
    }
  } catch {
    // logo not critical
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0f1117",
          display: "flex",
          flexDirection: "column",
          padding: "56px 80px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Barra verde no topo */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 10,
            background: "#96DB4F",
          }}
        />

        {/* Logo */}
        {logoSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoSrc}
            width={148}
            height={74}
            alt=""
            style={{ objectFit: "contain", objectPosition: "left center" }}
          />
        )}

        {/* Conteúdo principal */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            paddingTop: 16,
          }}
        >
          <span
            style={{
              color: "#96DB4F",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              marginBottom: 20,
            }}
          >
            Vaga aberta — Grupo WG Baterias
          </span>

          <span
            style={{
              color: "#ffffff",
              fontSize: title.length > 44 ? 52 : 66,
              fontWeight: 900,
              lineHeight: 1.1,
              marginBottom: 30,
              maxWidth: "92%",
            }}
          >
            {title}
          </span>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span
              style={{
                background: "#96DB4F",
                color: "#000000",
                padding: "9px 24px",
                borderRadius: 40,
                fontSize: 20,
                fontWeight: 700,
              }}
            >
              {location}
            </span>

            {modality && (
              <span
                style={{
                  border: "2px solid #374151",
                  color: "#9ca3af",
                  padding: "9px 24px",
                  borderRadius: 40,
                  fontSize: 20,
                  fontWeight: 500,
                }}
              >
                {modality}
              </span>
            )}

            {department && (
              <span
                style={{
                  border: "2px solid #374151",
                  color: "#9ca3af",
                  padding: "9px 24px",
                  borderRadius: 40,
                  fontSize: 20,
                  fontWeight: 500,
                }}
              >
                {department}
              </span>
            )}
          </div>
        </div>

        {/* URL */}
        <span style={{ color: "#4b5563", fontSize: 17 }}>
          carreiraswg.vercel.app
        </span>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
