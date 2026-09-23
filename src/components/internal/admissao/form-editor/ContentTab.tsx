"use client";

import { Panel } from "@/components/ui/Panel";
import { SettingsField, settingsInputClass } from "@/components/internal/settings/fields";
import { cn } from "@/lib/utils";
import type { FormConfig } from "@/lib/admissao/form-config";

type Setter = (fn: (c: FormConfig) => FormConfig) => void;

/** Aba "Conteúdo": textos de abertura, orientações e mensagem final. */
export function ContentTab({ config, set }: { config: FormConfig; set: Setter }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Abertura" description="Primeira coisa que o candidato vê ao abrir o link.">
        <div className="space-y-4">
          <SettingsField id="adm-title" label="Título">
            <input
              id="adm-title"
              maxLength={120}
              value={config.header.title}
              onChange={(e) => set((c) => ({ ...c, header: { ...c.header, title: e.target.value } }))}
              className={settingsInputClass}
            />
          </SettingsField>
          <SettingsField
            id="adm-subtitle"
            label="Texto de boas-vindas"
            hint={`Exibido assim: “Bem-vindo(a), Maria! ${config.header.subtitle || "…"}”`}
          >
            <input
              id="adm-subtitle"
              maxLength={240}
              value={config.header.subtitle}
              onChange={(e) => set((c) => ({ ...c, header: { ...c.header, subtitle: e.target.value } }))}
              aria-describedby="adm-subtitle-hint"
              className={settingsInputClass}
            />
          </SettingsField>
        </div>
      </Panel>

      <Panel title="Mensagem final" description="Tela exibida depois que o candidato envia o formulário.">
        <div className="space-y-4">
          <SettingsField id="adm-success-title" label="Título">
            <input
              id="adm-success-title"
              maxLength={120}
              value={config.success.title}
              onChange={(e) => set((c) => ({ ...c, success: { ...c.success, title: e.target.value } }))}
              className={settingsInputClass}
            />
          </SettingsField>
          <SettingsField id="adm-success-body" label="Mensagem">
            <textarea
              id="adm-success-body"
              rows={4}
              maxLength={1000}
              value={config.success.body}
              onChange={(e) => set((c) => ({ ...c, success: { ...c.success, body: e.target.value } }))}
              className={cn(settingsInputClass, "resize-y")}
            />
          </SettingsField>
          <SettingsField id="adm-success-phone" label="WhatsApp para dúvidas" hint="Deixe em branco para não exibir.">
            <input
              id="adm-success-phone"
              maxLength={40}
              value={config.success.contactPhone}
              onChange={(e) => set((c) => ({ ...c, success: { ...c.success, contactPhone: e.target.value } }))}
              aria-describedby="adm-success-phone-hint"
              className={settingsInputClass}
            />
          </SettingsField>
        </div>
      </Panel>

      <Panel
        className="lg:col-span-2"
        title="Orientações"
        description="Avisos exibidos conforme as respostas do candidato (veja a aba Regras)."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <SettingsField id="adm-itau" label="Quando não possui conta Itaú">
            <textarea
              id="adm-itau"
              rows={3}
              maxLength={600}
              value={config.messages.itauWarning}
              onChange={(e) => set((c) => ({ ...c, messages: { ...c.messages, itauWarning: e.target.value } }))}
              className={cn(settingsInputClass, "resize-y")}
            />
          </SettingsField>
          <SettingsField id="adm-driver" label="Quando é Motorista, Operador ou Encarregado">
            <textarea
              id="adm-driver"
              rows={3}
              maxLength={600}
              value={config.messages.driverInfo}
              onChange={(e) => set((c) => ({ ...c, messages: { ...c.messages, driverInfo: e.target.value } }))}
              className={cn(settingsInputClass, "resize-y")}
            />
          </SettingsField>
        </div>
      </Panel>
    </div>
  );
}
