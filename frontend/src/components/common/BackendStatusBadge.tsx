import { useBackendHealth } from '@/services/healthService'
import { Badge } from '@/components/ui/badge'
import { Activity, RefreshCw } from 'lucide-react'

export function BackendStatusBadge() {
  const { data, isLoading, isError, refetch } = useBackendHealth()

  if (isLoading) {
    return (
      <Badge variant="outline" className="flex items-center gap-1.5 py-1 px-2.5 text-xs text-muted-foreground border-border/80">
        <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
        <span>Connecting API</span>
      </Badge>
    )
  }

  if (isError || !data || data.status !== 'ok') {
    return (
      <button
        onClick={() => refetch()}
        title="Click to retry connecting to FastAPI"
        className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900"
      >
        <span className="h-2 w-2 rounded-full bg-rose-500" />
        <span>API Offline</span>
        <RefreshCw className="h-3 w-3 ml-0.5" />
      </button>
    )
  }

  return (
    <Badge
      variant="success"
      className="flex items-center gap-1.5 py-1 px-2.5 text-xs cursor-default font-medium"
      title={`Backend v${data.version} (${data.environment}) operational`}
    >
      <span className="h-2 w-2 rounded-full bg-emerald-500" />
      <span className="hidden xs:inline">Backend API:</span>
      <span className="capitalize">{data.status}</span>
      <Activity className="h-3 w-3 opacity-70 hidden sm:inline" />
    </Badge>
  )
}
