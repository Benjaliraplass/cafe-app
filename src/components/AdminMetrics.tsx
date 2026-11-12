import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { adminInviteStats, adminDailyMetrics, adminFunnel, adminRetention, adminTop, adminUserFacts, type InviteStats } from '@/lib/api'
import type { DailyMetric, FunnelStep, RetentionCell, TopItem, UserFacts } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { ErrorBox, SectionTitle, Spinner, StatTile } from '@/components/primitives'

export type MetricsPeriod = 7 | 30 | 90

export interface MetricsData {
  users: UserFacts[]
  daily: DailyMetric[]
  funnel: FunnelStep[]
  retention: RetentionCell[]
  top: TopItem[]
  invites?: InviteStats | null
}

/** Contenedor: carga las funciones admin_* para el período elegido. */
export function AdminMetrics() {
  const [period, setPeriod] = useState<MetricsPeriod>(30)
  const [data, setData] = useState<MetricsData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    Promise.all([adminUserFacts(), adminDailyMetrics(period), adminFunnel(period), adminRetention(12), adminTop(period, 8), adminInviteStats().catch(() => [])])
      .then(([users, daily, funnel, retention, top, inv]) => {
        if (!cancelled) setData({ users, daily, funnel, retention, top, invites: inv[0] ?? null })
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudieron cargar las métricas')
      })
    return () => {
      cancelled = true
    }
  }, [period])

  return <AdminMetricsView period={period} onPeriod={setPeriod} data={data} error={error} />
}

const STEP_LABEL: Record<string, string> = {
  app_opened: 'Abrió la app',
  signup_completed: 'Se registró',
  scan_started: 'Inició escaneo',
  scan_completed: 'Escaneo leído',
  log_saved: 'Guardó un café',
  recipe_requested: 'Pidió receta',
  share_clicked: 'Compartió',
}

const TOP_LABEL: Record<TopItem['kind'], string> = {
  coffee_logged: 'Cafés más registrados',
  roaster_logged: 'Tostadores más registrados',
  coffee_viewed: 'Fichas públicas más vistas',
  cafe_viewed: 'Cafeterías más vistas',
}

/** Vista presentacional (también en /preview?v=metrics). */
export function AdminMetricsView({
  period,
  onPeriod,
  data,
  error,
}: {
  period: MetricsPeriod
  onPeriod: (p: MetricsPeriod) => void
  data: MetricsData | null
  error: string | null
}) {
  const kpi = useMemo(() => (data ? computeKpis(data, period) : null), [data, period])

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          {([7, 30, 90] as MetricsPeriod[]).map((p) => (
            <Chip key={p} active={period === p} onClick={() => onPeriod(p)}>
              {p} días
            </Chip>
          ))}
        </div>
        {data && (
          <Button variant="outline" size="sm" onClick={() => downloadCsv(data.users)}>
            <Download className="size-4" strokeWidth={1.8} /> CSV
          </Button>
        )}
      </div>

      <ErrorBox message={error} />
      {!data && !error && <Spinner label="Calculando..." />}

      {data && kpi && (
        <>
          <section className="flex flex-col gap-3">
            <SectionTitle>Usuarios</SectionTitle>
            <div className="flex gap-2">
              <StatTile value={String(kpi.totalUsers)} label="Registrados" />
              <StatTile value={`${kpi.signupsPeriod}`} label={`Nuevos ${period} d`} />
              <StatTile value={String(kpi.active7)} label="Activos 7 d" />
            </div>
            <div className="flex gap-2">
              <StatTile value={pct(kpi.activationRate)} label="Activación" />
              <StatTile value={kpi.medianHoursToLog != null ? `${fmtHours(kpi.medianHoursToLog)}` : '—'} label="Hasta 1er café" />
              <StatTile value={pct(kpi.googleShare)} label="Con Google" />
            </div>
            <p className="text-xs text-muted-foreground">
              Activación = registrados que guardaron al menos un café. "Hasta 1er café" es la mediana desde el registro.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <SectionTitle>Viralidad</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <StatTile value={String(kpi.shares)} label="Compartidos" />
              <StatTile value={String(kpi.shareOpens)} label="Aperturas de enlaces" />
              <StatTile value={String(kpi.referred)} label="Registros referidos" />
              <StatTile value={kpi.kFactor.toFixed(2)} label="Factor K" />
            </div>
            <p className="text-xs text-muted-foreground">
              Factor K = compartidos por usuario activado x registros por compartido. Sobre 1 la app crece sola.
            </p>
          </section>

          {data.invites && (
            <section className="flex flex-col gap-3">
              <SectionTitle>Invitaciones</SectionTitle>
              <div className="grid grid-cols-3 gap-2">
                <StatTile value={String(data.invites.founders)} label="Fundadores" />
                <StatTile value={String(data.invites.invited)} label="Entraron invitados" />
                <StatTile value={String(data.invites.unlocked)} label="Cupo desbloqueado" />
                <StatTile value={String(data.invites.allowlist)} label="Lista blanca" />
                <StatTile value={String(data.invites.waitlist)} label="Lista de espera" />
                <StatTile value={data.invites.unlocked ? `${Math.round((data.invites.used / data.invites.unlocked) * 100)} %` : '—'} label="Cupo usado" />
              </div>
              <p className="text-xs text-muted-foreground">
                Lista blanca = clientes de Tostado Club (Shopify, se sincroniza a diario). Lista de espera = correos sin invitación todavía.
              </p>
            </section>
          )}

          <section className="flex flex-col gap-3">
            <SectionTitle>Actividad diaria</SectionTitle>
            <DailyChart rows={data.daily} />
            <div className="flex gap-2">
              <StatTile value={String(sum(data.daily, 'scans'))} label="Escaneos" />
              <StatTile value={String(sum(data.daily, 'logs'))} label="Cafés" />
              <StatTile value={String(sum(data.daily, 'recipes'))} label="Recetas" />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionTitle>Embudo</SectionTitle>
            <Funnel steps={data.funnel} />
          </section>

          <section className="flex flex-col gap-3">
            <SectionTitle>Retención semanal</SectionTitle>
            <Retention cells={data.retention} />
          </section>

          <section className="flex flex-col gap-5">
            <SectionTitle>Top del período</SectionTitle>
            {(Object.keys(TOP_LABEL) as TopItem['kind'][]).map((kind) => {
              const items = data.top.filter((t) => t.kind === kind)
              if (!items.length) return null
              return (
                <div key={kind} className="flex flex-col gap-2">
                  <p className="eyebrow">{TOP_LABEL[kind]}</p>
                  <ul className="divide-y divide-border">
                    {items.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span className="truncate">{t.label}</span>
                        <span className="shrink-0 font-medium tabular-nums">{t.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </section>

          <section className="flex flex-col gap-3">
            <SectionTitle>Usuarios ({data.users.length})</SectionTitle>
            <ul className="divide-y divide-border">
              {data.users.map((u) => (
                <li key={u.user_id} className="flex flex-col gap-0.5 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-medium">{u.display_name || u.email || u.user_id.slice(0, 8)}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(u.created_at)}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <span>{u.logs_count} cafés</span>
                    <span>{u.scans_count} escaneos</span>
                    <span>{u.recipes_count} recetas</span>
                    <span>{u.shares_sent} compartidos</span>
                    {u.utm?.source && <span>utm: {u.utm.source}</span>}
                    {u.ref && <span>ref: {u.ref}</span>}
                    <span>{u.last_active_at ? `activo ${fmtDate(u.last_active_at)}` : 'sin eventos'}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}

// ---------------- cálculo ----------------

function computeKpis(d: MetricsData, period: number) {
  const since = Date.now() - period * 86400 * 1000
  const totalUsers = d.users.length
  const activated = d.users.filter((u) => u.first_log_at)
  const hours = activated.map((u) => u.hours_to_first_log).filter((h): h is number => h != null && h >= 0).sort((a, b) => a - b)
  const active7 = d.users.filter((u) => u.active_days_7d > 0).length
  const shares = d.users.reduce((a, u) => a + u.shares_sent, 0)
  const shareOpens = d.users.reduce((a, u) => a + u.share_opens, 0)
  const referred = d.users.reduce((a, u) => a + u.signups_referred, 0)
  const sharesPerActivated = activated.length ? shares / activated.length : 0
  const signupsPerShare = shares ? referred / shares : 0
  return {
    totalUsers,
    signupsPeriod: d.users.filter((u) => Date.parse(u.created_at) >= since).length,
    active7,
    activationRate: totalUsers ? activated.length / totalUsers : 0,
    medianHoursToLog: hours.length ? hours[Math.floor(hours.length / 2)] : null,
    googleShare: totalUsers ? d.users.filter((u) => u.provider === 'google').length / totalUsers : 0,
    shares,
    shareOpens,
    referred,
    kFactor: sharesPerActivated * signupsPerShare,
  }
}

function sum<K extends keyof DailyMetric>(rows: DailyMetric[], k: K): number {
  return rows.reduce((a, r) => a + (Number(r[k]) || 0), 0)
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`
}

function fmtHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} min`
  if (h < 48) return `${Math.round(h)} h`
  return `${Math.round(h / 24)} d`
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
}

// ---------------- gráficos (SVG simple, escala de grises) ----------------

function DailyChart({ rows }: { rows: DailyMetric[] }) {
  const w = 320
  const h = 96
  const max = Math.max(1, ...rows.map((r) => Math.max(r.active_users, r.signups)))
  const n = rows.length || 1
  const bw = w / n
  return (
    <div className="rounded-2xl bg-card p-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-24 w-full" role="img" aria-label="Usuarios activos y registros por día">
        {rows.map((r, i) => {
          const ah = (r.active_users / max) * (h - 8)
          const sh = (r.signups / max) * (h - 8)
          return (
            <g key={r.day}>
              <rect x={i * bw + 1} y={h - ah} width={Math.max(1, bw - 2)} height={ah} fill="var(--color-border-strong)" rx={1} />
              <rect x={i * bw + 1} y={h - sh} width={Math.max(1, bw - 2)} height={sh} fill="var(--color-foreground)" rx={1} />
            </g>
          )
        })}
      </svg>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{rows[0] ? fmtDate(rows[0].day) : ''}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <i className="inline-block size-2 rounded-sm bg-border-strong" /> activos
          </span>
          <span className="flex items-center gap-1">
            <i className="inline-block size-2 rounded-sm bg-foreground" /> registros
          </span>
        </span>
        <span>{rows.length ? fmtDate(rows[rows.length - 1].day) : ''}</span>
      </div>
    </div>
  )
}

function Funnel({ steps }: { steps: FunnelStep[] }) {
  const base = steps[0]?.users || 0
  return (
    <ul className="flex flex-col gap-2">
      {steps.map((s, i) => {
        const prev = i === 0 ? s.users : steps[i - 1].users
        const widthPct = base ? Math.max(2, (s.users / base) * 100) : 0
        const conv = prev ? Math.round((s.users / prev) * 100) : 0
        return (
          <li key={s.step} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-sm">
              <span>{STEP_LABEL[s.step] ?? s.step}</span>
              <span className="tabular-nums text-muted-foreground">
                {s.users}
                {i > 0 && <span className="ml-2 text-xs">({conv}%)</span>}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-card">
              <div className="h-2 rounded-full bg-foreground" style={{ width: `${widthPct}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function Retention({ cells }: { cells: RetentionCell[] }) {
  const cohorts = Array.from(new Set(cells.map((c) => c.cohort_week))).sort()
  const maxWeek = Math.min(8, Math.max(0, ...cells.map((c) => c.week_n)))
  if (!cohorts.length) return <p className="text-sm text-muted-foreground">Aún no hay cohortes con actividad.</p>
  const lookup = new Map(cells.map((c) => [`${c.cohort_week}:${c.week_n}`, c]))
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-tertiary">
            <th className="py-1 pr-2 font-medium">Cohorte</th>
            <th className="py-1 pr-2 font-medium">N</th>
            {Array.from({ length: maxWeek + 1 }, (_, i) => (
              <th key={i} className="py-1 pr-1 text-center font-medium">
                S{i}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((w) => {
            const size = cells.find((c) => c.cohort_week === w)?.cohort_size ?? 0
            return (
              <tr key={w}>
                <td className="py-1 pr-2 whitespace-nowrap">{fmtDate(w)}</td>
                <td className="py-1 pr-2 tabular-nums text-muted-foreground">{size}</td>
                {Array.from({ length: maxWeek + 1 }, (_, i) => {
                  const c = lookup.get(`${w}:${i}`)
                  const p = c ? Number(c.pct) : null
                  return (
                    <td key={i} className="p-0.5">
                      <div
                        className="flex h-7 items-center justify-center rounded-md tabular-nums"
                        style={{
                          background: p == null ? 'var(--color-card)' : `color-mix(in oklab, var(--color-foreground) ${Math.round(p)}%, var(--color-card))`,
                          color: p != null && p > 55 ? 'var(--color-background)' : 'var(--color-foreground)',
                        }}
                      >
                        {p == null ? '' : `${Math.round(p)}`}
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---------------- export ----------------

function downloadCsv(users: UserFacts[]) {
  const cols: (keyof UserFacts)[] = [
    'user_id', 'email', 'provider', 'display_name', 'country', 'role', 'created_at', 'ref', 'first_path', 'device', 'display_mode',
    'first_scan_at', 'first_log_at', 'first_recipe_at', 'first_share_at', 'hours_to_first_log',
    'logs_count', 'scans_count', 'recipes_count', 'saved_recipes_count', 'favorites_count', 'public_logs_count', 'cafes_proposed',
    'distinct_roasters', 'distinct_origins', 'avg_rating', 'last_active_at', 'active_days_7d', 'active_days_30d', 'events_count',
    'shares_sent', 'share_opens', 'signups_referred',
  ]
  const esc = (v: unknown) => {
    if (v == null) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [
    [...cols, 'utm_source', 'utm_medium', 'utm_campaign'].join(','),
    ...users.map((u) => [...cols.map((c) => esc(u[c])), esc(u.utm?.source), esc(u.utm?.medium), esc(u.utm?.campaign)].join(',')),
  ]
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `dripo-usuarios-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
