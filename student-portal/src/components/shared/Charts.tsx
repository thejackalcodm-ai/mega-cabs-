import { useState } from 'react'
import { BarChart3, Table2 } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/EmptyState'

/**
 * Single-series bar charts (one hue, so no legend: the card title names the series).
 * Marks: <=24px bars, 4px rounded data ends, hairline recessive grid, hover tooltip,
 * values and labels in text tokens. Every chart has a table view with the same rows.
 */
export interface ChartDatum {
  label: string
  value: number
}

const BAR = 'hsl(var(--primary))'
const GRID = 'hsl(var(--border))'
const INK_MUTED = 'hsl(var(--muted-foreground))'

interface ChartCardProps {
  title: string
  description?: string
  data: ChartDatum[]
  /** How a value reads in the tooltip and table, e.g. 12 → "12 applications". */
  format?: (v: number) => string
  valueHeader?: string
  labelHeader?: string
  orientation?: 'horizontal' | 'vertical'
  emptyText?: string
  /** Extra controls in the header (e.g. a currency picker). */
  actions?: React.ReactNode
}

export function ChartCard({
  title,
  description,
  data,
  format = (v) => v.toLocaleString(),
  valueHeader = 'Count',
  labelHeader = 'Category',
  orientation = 'horizontal',
  emptyText = 'No data yet',
  actions,
}: ChartCardProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const hasData = data.some((d) => d.value > 0)
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          {hasData && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView((v) => (v === 'chart' ? 'table' : 'chart'))}
              aria-label={view === 'chart' ? `Show ${title} as a table` : `Show ${title} as a chart`}
            >
              {view === 'chart' ? <Table2 /> : <BarChart3 />}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        {!hasData ? (
          <EmptyState compact icon={BarChart3} title={emptyText} />
        ) : view === 'table' ? (
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{title}</caption>
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-1.5 font-medium">
                    {labelHeader}
                  </th>
                  <th scope="col" className="py-1.5 text-right font-medium">
                    {valueHeader}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.label} className="border-b last:border-0">
                    <td className="py-1.5">{d.label}</td>
                    <td className="tabular py-1.5 text-right">{format(d.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : orientation === 'horizontal' ? (
          <HorizontalBars data={data} format={format} title={title} />
        ) : (
          <ColumnBars data={data} format={format} title={title} />
        )}
      </CardContent>
    </Card>
  )
}

function ChartTooltip({
  active,
  payload,
  format,
}: TooltipProps<number, string> & { format: (v: number) => string }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as ChartDatum
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-raised">
      <p className="font-medium text-foreground">{d.label}</p>
      <p className="tabular text-muted-foreground">{format(d.value)}</p>
    </div>
  )
}

function HorizontalBars({
  data,
  format,
  title,
}: {
  data: ChartDatum[]
  format: (v: number) => string
  title: string
}) {
  const rows = data.slice(0, 10)
  const height = rows.length * 34 + 16
  return (
    <div role="img" aria-label={`${title}: ${rows.map((d) => `${d.label} ${format(d.value)}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
          barSize={18}
        >
          <CartesianGrid horizontal={false} stroke={GRID} strokeWidth={1} />
          <XAxis
            type="number"
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: INK_MUTED, fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={128}
            tickLine={false}
            axisLine={false}
            tick={{ fill: INK_MUTED, fontSize: 12 }}
            interval={0}
          />
          <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<ChartTooltip format={format} />} />
          <Bar dataKey="value" fill={BAR} radius={[0, 4, 4, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function ColumnBars({
  data,
  format,
  title,
}: {
  data: ChartDatum[]
  format: (v: number) => string
  title: string
}) {
  return (
    <div role="img" aria-label={`${title}: ${data.map((d) => `${d.label} ${format(d.value)}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barSize={20}>
          <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: INK_MUTED, fontSize: 11 }}
            interval={0}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: INK_MUTED, fontSize: 11 }}
            width={44}
          />
          <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<ChartTooltip format={format} />} />
          <Bar dataKey="value" fill={BAR} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
