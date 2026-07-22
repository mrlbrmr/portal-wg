"use client"

import { useState, useRef } from 'react'
import { CheckCircle2, Upload, Loader2, AlertTriangle, ChevronRight, ChevronLeft } from 'lucide-react'
import {
  getVisibleDocuments,
  type FormConfig,
  type DocumentConfig,
  type ExtraFieldConfig,
} from '@/lib/admissao/form-config'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PersonalData {
  fullName: string
  cpf: string
  birthDate: string
  email: string
  phone: string
  gender: string
}

interface AdditionalData {
  maritalStatus: string
  hasChildren: boolean | null
  needsTransportVoucher: boolean | null
  transportVoucherDetails: string
  hasItauAccount: boolean | null
  bankAgency: string
  bankAccount: string
  colorDeclaration: string
  isDriverOperator: boolean | null
}

interface UploadState {
  status: 'idle' | 'uploading' | 'done' | 'error'
  fileName?: string
  error?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskCpf(v: string) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

function maskPhone(v: string) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
}

function maskPis(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length > 10) return `${d.slice(0, 3)}.${d.slice(3, 8)}.${d.slice(8, 10)}-${d.slice(10)}`
  if (d.length > 8)  return `${d.slice(0, 3)}.${d.slice(3, 8)}.${d.slice(8)}`
  if (d.length > 3)  return `${d.slice(0, 3)}.${d.slice(3)}`
  return d
}

function applyMask(mask: ExtraFieldConfig['mask'], v: string) {
  return mask === 'pis' ? maskPis(v) : v
}

function labelCls(required: boolean) {
  return `block text-sm font-medium text-gray-700 mb-1 ${required ? "after:content-['*'] after:text-red-500 after:ml-0.5" : ''}`
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-wg-green focus:border-transparent'

// ─── Sub-components ───────────────────────────────────────────────────────────

function RadioGroup({
  label, options, value, onChange, required,
}: { label: string; options: readonly string[]; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div>
      <label className={labelCls(!!required)}>{label}</label>
      <div className="flex flex-wrap gap-2 mt-1">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              value === opt
                ? 'bg-wg-green text-white border-wg-green'
                : 'bg-white text-gray-700 border-gray-300 hover:border-wg-green'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

function YesNo({
  label, value, onChange, required,
}: { label: string; value: boolean | null; onChange: (v: boolean) => void; required?: boolean }) {
  return (
    <div>
      <label className={labelCls(!!required)}>{label}</label>
      <div className="flex gap-2 mt-1">
        {[true, false].map(opt => (
          <button
            key={String(opt)}
            type="button"
            onClick={() => onChange(opt)}
            className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
              value === opt
                ? 'bg-wg-green text-white border-wg-green'
                : 'bg-white text-gray-700 border-gray-300 hover:border-wg-green'
            }`}
          >
            {opt ? 'Sim' : 'Não'}
          </button>
        ))}
      </div>
    </div>
  )
}

function FileUpload({
  docKey, label, required, token, state, onUpload,
}: {
  docKey: string
  label: string
  required: boolean
  token: string
  state: UploadState
  onUpload: (key: string, st: UploadState) => void
}) {
  const ref = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    onUpload(docKey, { status: 'uploading' })
    const fd = new FormData()
    fd.append('file', file)
    fd.append('docKey', docKey)
    try {
      const res = await fetch(`/api/admissao/${token}/upload`, { method: 'POST', body: fd })
      const body = await res.json().catch(() => ({})) as { error?: string; fileName?: string }
      if (!res.ok) { onUpload(docKey, { status: 'error', error: body.error ?? 'Erro no upload.' }); return }
      onUpload(docKey, { status: 'done', fileName: body.fileName ?? file.name })
    } catch {
      onUpload(docKey, { status: 'error', error: 'Erro de conexão. Tente novamente.' })
    }
  }

  return (
    <div>
      <label className={labelCls(required)}>{label}</label>
      <div
        className={`mt-1 border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
          state.status === 'done'
            ? 'border-green-400 bg-green-50'
            : state.status === 'error'
            ? 'border-red-300 bg-red-50'
            : 'border-gray-300 hover:border-wg-green bg-white'
        }`}
        onClick={() => state.status !== 'uploading' && ref.current?.click()}
      >
        <input
          ref={ref}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
        {state.status === 'uploading' && (
          <div className="flex items-center justify-center gap-2 text-wg-green text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Enviando...
          </div>
        )}
        {state.status === 'done' && (
          <div className="flex items-center justify-center gap-2 text-green-700 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span className="truncate max-w-xs">{state.fileName}</span>
            <span className="text-xs text-green-600 ml-1">(clique para substituir)</span>
          </div>
        )}
        {state.status === 'error' && (
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertTriangle className="w-4 h-4" /> {state.error}
            </div>
            <span className="text-xs text-gray-500">Clique para tentar novamente</span>
          </div>
        )}
        {state.status === 'idle' && (
          <div className="flex flex-col items-center gap-1 text-gray-500">
            <Upload className="w-5 h-5" />
            <span className="text-sm">Clique ou arraste o arquivo aqui</span>
            <span className="text-xs">PDF, JPG, PNG, WEBP, DOC · máx. 10 MB</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Step indicators ──────────────────────────────────────────────────────────

const STEPS = ['Dados pessoais', 'Informações', 'Documentos', 'Confirmação']

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-8">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-colors ${
            i < current ? 'bg-wg-green text-white'
            : i === current ? 'bg-wg-green text-white ring-2 ring-wg-green ring-offset-2'
            : 'bg-gray-200 text-gray-500'
          }`}>
            {i < current ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-8 h-0.5 ${i < current ? 'bg-wg-green' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DigitalForm({
  token, candidateName, config,
}: { token: string; candidateName: string; config: FormConfig }) {
  const [step, setStep]           = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]  = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [errors, setErrors]        = useState<Record<string, string>>({})

  const [personal, setPersonal]   = useState<PersonalData>({
    fullName: candidateName, cpf: '', birthDate: '', email: '', phone: '', gender: '',
  })

  const [additional, setAdditional] = useState<AdditionalData>({
    maritalStatus: '', hasChildren: null, needsTransportVoucher: null,
    transportVoucherDetails: '', hasItauAccount: null,
    bankAgency: '', bankAccount: '', colorDeclaration: '', isDriverOperator: null,
  })

  const [uploads, setUploads] = useState<Record<string, UploadState>>({})
  const [extras, setExtras]   = useState<Record<string, string>>({})

  function setUpload(key: string, st: UploadState) {
    setUploads(prev => ({ ...prev, [key]: st }))
  }

  const visibleDocs: DocumentConfig[] = getVisibleDocuments(config, {
    gender:           personal.gender,
    maritalStatus:    additional.maritalStatus,
    hasChildren:      additional.hasChildren ?? false,
    hasItauAccount:   additional.hasItauAccount ?? false,
    isDriverOperator: additional.isDriverOperator ?? false,
  })

  // ── Validation ──────────────────────────────────────────────────────────────

  function validateStep0(): boolean {
    const e: Record<string, string> = {}
    if (!personal.fullName.trim() || personal.fullName.trim().split(' ').length < 2)
      e.fullName = 'Informe o nome completo (nome e sobrenome).'
    const digits = personal.cpf.replace(/\D/g, '')
    if (digits.length !== 11) e.cpf = 'CPF deve ter 11 dígitos.'
    if (!personal.birthDate) e.birthDate = 'Informe a data de nascimento.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personal.email)) e.email = 'E-mail inválido.'
    if (personal.phone.replace(/\D/g, '').length < 10) e.phone = 'Telefone inválido.'
    if (!personal.gender) e.gender = 'Selecione o gênero.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function validateStep1(): boolean {
    const e: Record<string, string> = {}
    if (!additional.maritalStatus) e.maritalStatus = 'Selecione o estado civil.'
    if (additional.hasChildren === null) e.hasChildren = 'Responda se possui filhos.'
    if (additional.needsTransportVoucher === null) e.needsTransportVoucher = 'Responda sobre vale-transporte.'
    if (additional.needsTransportVoucher && !additional.transportVoucherDetails.trim())
      e.transportVoucherDetails = 'Informe os detalhes do vale-transporte.'
    if (additional.hasItauAccount === null) e.hasItauAccount = 'Responda sobre conta Itaú.'
    if (additional.hasItauAccount) {
      if (!additional.bankAgency.trim()) e.bankAgency = 'Informe a agência.'
      if (!additional.bankAccount.trim()) e.bankAccount = 'Informe o número da conta.'
    }
    if (!additional.colorDeclaration) e.colorDeclaration = 'Selecione a autodeclaração de cor.'
    if (additional.isDriverOperator === null) e.isDriverOperator = 'Responda sobre o cargo.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function validateStep2(): boolean {
    const e: Record<string, string> = {}
    for (const doc of visibleDocs) {
      const st = uploads[doc.key]
      if (doc.required && (!st || st.status !== 'done'))
        e[doc.key] = 'Documento obrigatório não enviado.'
      for (const f of doc.extraFields ?? []) {
        if (f.required && !(extras[f.key] ?? '').trim())
          e[`extra:${f.key}`] = 'Campo obrigatório.'
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleNext() {
    if (step === 0 && !validateStep0()) return
    if (step === 1 && !validateStep1()) return
    if (step === 2 && !validateStep2()) return
    setStep(s => s + 1)
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  function collectVisibleExtras(): Record<string, string> {
    const out: Record<string, string> = {}
    for (const doc of visibleDocs) {
      for (const f of doc.extraFields ?? []) {
        const val = (extras[f.key] ?? '').trim()
        if (val) out[f.key] = val
      }
    }
    return out
  }

  async function handleSubmit() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const formExtras = collectVisibleExtras()
      const res = await fetch(`/api/admissao/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName:               personal.fullName.trim(),
          cpf:                    personal.cpf.replace(/\D/g, ''),
          birthDate:              personal.birthDate,
          email:                  personal.email.trim(),
          phone:                  personal.phone.replace(/\D/g, ''),
          gender:                 personal.gender,
          maritalStatus:          additional.maritalStatus,
          hasChildren:            additional.hasChildren ?? false,
          needsTransportVoucher:  additional.needsTransportVoucher ?? false,
          transportVoucherDetails: additional.transportVoucherDetails || null,
          hasItauAccount:         additional.hasItauAccount ?? false,
          bankAgency:             additional.bankAgency || null,
          bankAccount:            additional.bankAccount || null,
          colorDeclaration:       additional.colorDeclaration,
          isDriverOperator:       additional.isDriverOperator ?? false,
          formExtras:             Object.keys(formExtras).length ? formExtras : null,
        }),
      })
      const body = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) { setSubmitError(body.error ?? 'Erro ao enviar. Tente novamente.'); return }
      setSubmitted(true)
    } catch {
      setSubmitError('Erro de conexão. Verifique sua internet e tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Submitted screen ────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{config.success.title}</h1>
        <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
          {config.success.body}
        </p>
        {config.success.contactPhone && (
          <p className="text-xs text-gray-400 mt-4">
            Dúvidas? WhatsApp: {config.success.contactPhone}
          </p>
        )}
      </div>
    )
  }

  // ── Form ────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold text-gray-900">{config.header.title}</h1>
        <p className="text-sm text-gray-500 mt-1">
          Bem-vindo(a), {candidateName.split(' ')[0]}! {config.header.subtitle}
        </p>
      </div>

      <StepBar current={step} />

      {/* ── Step 0: Dados pessoais ── */}
      {step === 0 && (
        <div className="space-y-4 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900">Dados pessoais</h2>

          <div>
            <label className={labelCls(true)}>Nome completo</label>
            <input className={inputCls} value={personal.fullName}
              onChange={e => setPersonal(p => ({ ...p, fullName: e.target.value }))} />
            {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
          </div>

          <div>
            <label className={labelCls(true)}>CPF</label>
            <input className={inputCls} value={personal.cpf} placeholder="000.000.000-00"
              onChange={e => setPersonal(p => ({ ...p, cpf: maskCpf(e.target.value) }))} />
            {errors.cpf && <p className="text-xs text-red-500 mt-1">{errors.cpf}</p>}
          </div>

          <div>
            <label className={labelCls(true)}>Data de nascimento</label>
            <input type="date" className={inputCls} value={personal.birthDate}
              onChange={e => setPersonal(p => ({ ...p, birthDate: e.target.value }))} />
            {errors.birthDate && <p className="text-xs text-red-500 mt-1">{errors.birthDate}</p>}
          </div>

          <div>
            <label className={labelCls(true)}>E-mail</label>
            <input type="email" className={inputCls} value={personal.email}
              onChange={e => setPersonal(p => ({ ...p, email: e.target.value }))} />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className={labelCls(true)}>Telefone / WhatsApp</label>
            <input className={inputCls} value={personal.phone} placeholder="(00) 00000-0000"
              onChange={e => setPersonal(p => ({ ...p, phone: maskPhone(e.target.value) }))} />
            {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
          </div>

          <RadioGroup label="Gênero" options={config.genderOptions} value={personal.gender}
            onChange={v => setPersonal(p => ({ ...p, gender: v }))} required />
          {errors.gender && <p className="text-xs text-red-500">{errors.gender}</p>}
        </div>
      )}

      {/* ── Step 1: Informações adicionais ── */}
      {step === 1 && (
        <div className="space-y-5 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900">Informações adicionais</h2>

          <RadioGroup label={config.labels.maritalStatus} options={config.maritalOptions}
            value={additional.maritalStatus} required
            onChange={v => setAdditional(a => ({ ...a, maritalStatus: v }))} />
          {errors.maritalStatus && <p className="text-xs text-red-500">{errors.maritalStatus}</p>}

          <YesNo label={config.labels.hasChildren} value={additional.hasChildren} required
            onChange={v => setAdditional(a => ({ ...a, hasChildren: v }))} />
          {errors.hasChildren && <p className="text-xs text-red-500">{errors.hasChildren}</p>}

          <YesNo label={config.labels.needsTransportVoucher} value={additional.needsTransportVoucher} required
            onChange={v => setAdditional(a => ({ ...a, needsTransportVoucher: v }))} />
          {errors.needsTransportVoucher && <p className="text-xs text-red-500">{errors.needsTransportVoucher}</p>}

          {additional.needsTransportVoucher && (
            <div>
              <label className={labelCls(true)}>{config.labels.transportVoucherDetails}</label>
              <textarea className={`${inputCls} resize-none h-20`}
                value={additional.transportVoucherDetails}
                onChange={e => setAdditional(a => ({ ...a, transportVoucherDetails: e.target.value }))}
                placeholder="Ex: 2 passagens por dia, R$ 5,50 cada" />
              {errors.transportVoucherDetails && <p className="text-xs text-red-500 mt-1">{errors.transportVoucherDetails}</p>}
            </div>
          )}

          <YesNo label={config.labels.hasItauAccount} value={additional.hasItauAccount} required
            onChange={v => setAdditional(a => ({ ...a, hasItauAccount: v }))} />
          {errors.hasItauAccount && <p className="text-xs text-red-500">{errors.hasItauAccount}</p>}

          {additional.hasItauAccount === true && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls(true)}>Agência</label>
                <input className={inputCls} value={additional.bankAgency}
                  onChange={e => setAdditional(a => ({ ...a, bankAgency: e.target.value }))} />
                {errors.bankAgency && <p className="text-xs text-red-500 mt-1">{errors.bankAgency}</p>}
              </div>
              <div>
                <label className={labelCls(true)}>Conta</label>
                <input className={inputCls} value={additional.bankAccount}
                  onChange={e => setAdditional(a => ({ ...a, bankAccount: e.target.value }))} />
                {errors.bankAccount && <p className="text-xs text-red-500 mt-1">{errors.bankAccount}</p>}
              </div>
            </div>
          )}

          {additional.hasItauAccount === false && (
            <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              {config.messages.itauWarning}
            </p>
          )}

          <RadioGroup label={config.labels.colorDeclaration} options={config.colorOptions}
            value={additional.colorDeclaration} required
            onChange={v => setAdditional(a => ({ ...a, colorDeclaration: v }))} />
          {errors.colorDeclaration && <p className="text-xs text-red-500">{errors.colorDeclaration}</p>}

          <YesNo label={config.labels.isDriverOperator} required
            value={additional.isDriverOperator}
            onChange={v => setAdditional(a => ({ ...a, isDriverOperator: v }))} />
          {errors.isDriverOperator && <p className="text-xs text-red-500">{errors.isDriverOperator}</p>}

          {additional.isDriverOperator && (
            <p className="text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
              {config.messages.driverInfo}
            </p>
          )}
        </div>
      )}

      {/* ── Step 2: Documentos ── */}
      {step === 2 && (
        <div className="space-y-5 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div>
            <h2 className="font-semibold text-gray-900">Envio de documentos</h2>
            <p className="text-xs text-gray-500 mt-0.5">Campos marcados com * são obrigatórios. PDF, JPG, PNG, WEBP ou DOC. Máx. 10 MB por arquivo.</p>
          </div>

          {visibleDocs.map(doc => (
            <div key={doc.key}>
              <FileUpload
                docKey={doc.key}
                label={doc.label}
                required={doc.required}
                token={token}
                state={uploads[doc.key] ?? { status: 'idle' }}
                onUpload={setUpload}
              />
              {errors[doc.key] && <p className="text-xs text-red-500 mt-1">{errors[doc.key]}</p>}

              {(doc.extraFields ?? []).map(f => (
                <div key={f.key} className="mt-3">
                  <label className={labelCls(f.required)}>{f.label}</label>
                  <input
                    className={inputCls}
                    value={extras[f.key] ?? ''}
                    placeholder={f.placeholder}
                    onChange={e => setExtras(prev => ({ ...prev, [f.key]: applyMask(f.mask, e.target.value) }))}
                  />
                  {errors[`extra:${f.key}`] && <p className="text-xs text-red-500 mt-1">{errors[`extra:${f.key}`]}</p>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Step 3: Confirmação ── */}
      {step === 3 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Confirmar e enviar</h2>
          <p className="text-sm text-gray-600">
            Revise os dados abaixo antes de confirmar. Após o envio não será possível fazer alterações.
          </p>

          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <Row label="Nome"       value={personal.fullName} />
            <Row label="CPF"        value={personal.cpf} />
            <Row label="Nascimento" value={personal.birthDate} />
            <Row label="E-mail"     value={personal.email} />
            <Row label="Telefone"   value={personal.phone} />
            <Row label="Gênero"     value={personal.gender} />
            <Row label="Est. civil" value={additional.maritalStatus} />
            <Row label="Filhos"     value={additional.hasChildren ? 'Sim' : 'Não'} />
            <Row label="Vale-transp." value={additional.needsTransportVoucher ? 'Sim' : 'Não'} />
            {additional.needsTransportVoucher && <Row label="Detalhes VT" value={additional.transportVoucherDetails} />}
            <Row label="Conta Itaú" value={additional.hasItauAccount ? 'Sim' : 'Não'} />
            {additional.hasItauAccount && <>
              <Row label="Agência" value={additional.bankAgency} />
              <Row label="Conta"   value={additional.bankAccount} />
            </>}
            <Row label="Cor"        value={additional.colorDeclaration} />
            <Row label="Motorista/Op." value={additional.isDriverOperator ? 'Sim' : 'Não'} />
            {visibleDocs.flatMap(doc =>
              (doc.extraFields ?? [])
                .filter(f => (extras[f.key] ?? '').trim())
                .map(f => <Row key={f.key} label={f.label} value={extras[f.key]} />)
            )}
          </div>

          <div className="bg-gray-50 rounded-xl p-4 space-y-1 text-sm">
            <p className="font-medium text-gray-700 mb-2">Documentos enviados</p>
            {visibleDocs.map(doc => {
              const st = uploads[doc.key]
              return (
                <div key={doc.key} className="flex items-center gap-2">
                  {st?.status === 'done'
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    : <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
                  <span className={st?.status === 'done' ? 'text-gray-700' : 'text-gray-400'}>
                    {doc.label}
                  </span>
                </div>
              )
            })}
          </div>

          {submitError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{submitError}</p>
          )}
        </div>
      )}

      {/* ── Navigation ── */}
      <div className={`flex mt-6 ${step > 0 ? 'justify-between' : 'justify-end'}`}>
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep(s => s - 1)}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Voltar
          </button>
        )}

        {step < 3 && (
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center gap-1 px-5 py-2 rounded-lg bg-wg-green text-white text-sm font-medium hover:bg-wg-green-dark transition-colors"
          >
            Continuar <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {step === 3 && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-wg-green text-white text-sm font-medium hover:bg-wg-green-dark disabled:opacity-60 transition-colors"
          >
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
              : <><CheckCircle2 className="w-4 h-4" /> Confirmar e enviar</>}
          </button>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | boolean | null | undefined }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 text-right">{String(value ?? '—')}</span>
    </div>
  )
}
