import { useMemo, useState } from 'react'
import {
  Award,
  BookOpen,
  FileClock,
  Hourglass,
  Plane,
  Send,
  UserCheck,
  Users,
  Wallet,
  WalletCards,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/native-select'
import { ChartCard, type ChartDatum } from '@/components/shared/Charts'
import { ErrorState } from '@/components/shared/ErrorState'
import { CardSkeleton } from '@/components/shared/Skeletons'
import { StatCard } from '@/components/shared/StatCard'
import { useAdminMetrics } from '@/features/admin/queries'
import { APPLICATION_STATUS, DOCUMENT_CATEGORY_LABEL } from '@/lib/constants'
import { formatDate, formatMoney } from '@/lib/format'
import type { AdminMetrics, CurrencyAmount } from '@/services/admin'

const money = (rows: CurrencyAmount[]) =>
  rows.length === 0 ? formatMoney(0) : rows.map((r) => formatMoney(Number(r.amount), r.currency)).join(' · ')

const monthLabel = (ym: string) => formatDate(`${ym}-01`, 'MMM')

/** Admin overview: every value comes from admin_dashboard_metrics() (no client-side counting). */
export function AdminOverview() {
  const metrics = useAdminMetrics()
  if (metrics.isPending)
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Loading metrics">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <CardSkeleton key={i} lines={1} />
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <CardSkeleton lines={6} />
          <CardSkeleton lines={6} />
        </div>
      </div>
    )
  if (metrics.isError)
    return (
      <Card>
        <ErrorState error={metrics.error} onRetry={() => void metrics.refetch()} />
      </Card>
    )
  return <Overview m={metrics.data} />
}

function Overview({ m }: { m: AdminMetrics }) {
  const currencies = useMemo(() => {
    const set = new Set<string>()
    m.revenue_by_month.forEach((r) => Object.keys(r.amounts).forEach((c) => set.add(c)))
    m.payments_30d.forEach((r) => set.add(r.currency))
    return [...set].sort()
  }, [m])
  const [currency, setCurrency] = useState<string>('')
  const activeCurrency = currency || currencies[0] || 'GBP'

  const byStatus: ChartDatum[] = m.applications_by_status.map((r) => ({
    label: APPLICATION_STATUS[r.status]?.label ?? r.status,
    value: Number(r.count),
  }))
  const monthly: ChartDatum[] = m.monthly_applications.map((r) => ({
    label: monthLabel(r.month),
    value: Number(r.count),
  }))
  const countries: ChartDatum[] = m.students_by_country.map((r) => ({
    label: r.country,
    value: Number(r.count),
  }))
  const awaiting: ChartDatum[] = m.documents_awaiting.map((r) => ({
    label: DOCUMENT_CATEGORY_LABEL[r.category] ?? r.category,
    value: Number(r.count),
  }))
  const revenue: ChartDatum[] = m.revenue_by_month.map((r) => ({
    label: monthLabel(r.month),
    value: Number(r.amounts[activeCurrency] ?? 0),
  }))
  const engagement: ChartDatum[] = m.course_engagement.map((r) => ({
    label: r.course,
    value: Number(r.enrollments),
  }))

  return (
    <div className="space-y-5">
      <section aria-labelledby="kpi-heading">
        <h2 id="kpi-heading" className="sr-only">
          Key figures
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatCard label="Total students" value={m.total_students} icon={Users} to="/admin/students" />
          <StatCard
            label="Active students"
            value={m.active_students}
            icon={UserCheck}
            hint="Signed in within 30 days"
          />
          <StatCard label="New applications" value={m.new_applications} icon={Send} hint="Last 30 days" />
          <StatCard label="Applications in progress" value={m.applications_pending} icon={Hourglass} />
          <StatCard
            label="Documents to review"
            value={m.documents_pending}
            icon={FileClock}
            to="/admin/documents"
          />
          <StatCard label="Offers received" value={m.offers_received} icon={Award} />
          <StatCard label="Visa applications" value={m.visa_applications} icon={Plane} />
          <StatCard label="Course enrollments" value={m.course_enrollments} icon={BookOpen} />
          <StatCard
            label="Payments received"
            value={money(m.payments_30d)}
            icon={Wallet}
            hint="Last 30 days"
          />
          <StatCard label="Outstanding invoices" value={money(m.outstanding)} icon={WalletCards} />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Applications per month"
          description="New applications, last 12 months"
          data={monthly}
          orientation="vertical"
          labelHeader="Month"
          valueHeader="Applications"
          emptyText="No applications in the last 12 months"
        />
        <ChartCard
          title="Applications by status"
          description="Every application, current status"
          data={byStatus}
          labelHeader="Status"
          valueHeader="Applications"
          emptyText="No applications yet"
        />
        <ChartCard
          title="Students by country"
          description="Country of residence (top 10)"
          data={countries}
          labelHeader="Country"
          valueHeader="Students"
          emptyText="No students yet"
        />
        <ChartCard
          title="Documents waiting for review"
          description="By category"
          data={awaiting}
          labelHeader="Category"
          valueHeader="Documents"
          emptyText="Nothing waiting for review"
        />
        <ChartCard
          title="Revenue per month"
          description={`Paid, last 12 months · ${activeCurrency}`}
          data={revenue}
          orientation="vertical"
          labelHeader="Month"
          valueHeader={`Amount (${activeCurrency})`}
          format={(v) => formatMoney(v, activeCurrency)}
          emptyText="No payments in the last 12 months"
          actions={
            currencies.length > 1 ? (
              <NativeSelect
                aria-label="Revenue currency"
                value={activeCurrency}
                onChange={(e) => setCurrency(e.target.value)}
                className="h-8 w-24 sm:h-8"
              >
                {currencies.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </NativeSelect>
            ) : undefined
          }
        />
        <ChartCard
          title="Course enrollments"
          description="Active and completed learners per course"
          data={engagement}
          labelHeader="Course"
          valueHeader="Learners"
          emptyText="No course enrollments yet"
        />
      </div>
    </div>
  )
}
