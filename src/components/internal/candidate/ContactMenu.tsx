"use client";

import { ChevronDown, Copy, Mail, MessageCircle, Phone } from "lucide-react";
import { buttonVariants } from "@/components/ui/Button";
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/DropdownMenu";
import { whatsappUrl } from "./types";

interface Props {
  email: string;
  phone: string;
  onCopy: (label: "E-mail" | "Telefone", value: string) => Promise<boolean>;
}

/** "Contatar ▾": canais reais do candidato (WhatsApp, e-mail) + copiar dados. */
export function ContactMenu({ email, phone, onCopy }: Props) {
  const wa = whatsappUrl(phone);
  const items: DropdownMenuItem[] = [];
  if (wa) items.push({ label: "WhatsApp", icon: MessageCircle, href: wa, external: true });
  if (email) items.push({ label: "E-mail", icon: Mail, href: `mailto:${email}` });
  if (items.length > 0) items.push({ type: "separator" });
  if (phone) items.push({ label: "Copiar telefone", icon: Phone, onSelect: () => onCopy("Telefone", phone) });
  if (email) items.push({ label: "Copiar e-mail", icon: Copy, onSelect: () => onCopy("E-mail", email) });

  if (items.length === 0) return null;

  return (
    <DropdownMenu
      items={items}
      ariaLabel="Contatar candidato"
      triggerClassName={buttonVariants({ variant: "secondary", size: "sm", className: "px-2.5 sm:px-3" })}
      trigger={
        <>
          <MessageCircle className="sm:hidden" aria-hidden />
          <span className="hidden sm:inline">Contatar</span>
          <ChevronDown aria-hidden />
        </>
      }
    />
  );
}
