import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Building2,
  RefreshCw,
  Power,
  ShieldCheck,
  History,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  X,
  FileText,
  KeyRound,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { accountService } from '@/services/accountService'
import { queryClient } from '@/lib/queryClient'
import { formatINR } from '@/lib/utils'
import type { ConnectedAccount, SyncRun } from '@/types/account'

export function ConnectedAccountsPage() {
  const [syncingAccountId, setSyncingAccountId] = useState<number | null>(null)
  const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(null)
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<'setu_aa' | 'mock_bank'>('setu_aa')
  const [customerVpa, setCustomerVpa] = useState('student@setu')
  const [isAuthorizingAA, setIsAuthorizingAA] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  // 1. Fetch connected accounts
  const {
    data: accountsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['connected-accounts'],
    queryFn: () => accountService.getAccounts(),
  })

  // 2. Fetch sync history for expanded account
  const { data: syncHistory, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['sync-history', expandedHistoryId],
    queryFn: () =>
      expandedHistoryId ? accountService.getSyncHistory(expandedHistoryId, 10) : Promise.resolve([]),
    enabled: !!expandedHistoryId,
  })

  // 3. Detect external Account Aggregator callback on mount (?consent_id=...&state=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const consentId = params.get('consent_id')
    const state = params.get('state')
    const statusParam = params.get('status') || 'ACTIVE'

    if (consentId && state) {
      const handleCallback = async () => {
        try {
          setFeedbackMessage({
            type: 'success',
            text: 'Verifying Account Aggregator consent and discovering authorized bank accounts...',
          })
          const res = await accountService.handleConsentCallback({
            consent_id: consentId,
            state: state,
            status: statusParam,
          })

          setFeedbackMessage({
            type: 'success',
            text: res.message || 'Account successfully connected and synchronized via Account Aggregator sandbox.',
          })

          // Invalidate all financial queries across the app
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['connected-accounts'] }),
            queryClient.invalidateQueries({ queryKey: ['transactions'] }),
            queryClient.invalidateQueries({ queryKey: ['financial-summary'] }),
            queryClient.invalidateQueries({ queryKey: ['analytics'] }),
            queryClient.invalidateQueries({ queryKey: ['budgets'] }),
            queryClient.invalidateQueries({ queryKey: ['insights'] }),
          ])
        } catch (err: unknown) {
          setFeedbackMessage({
            type: 'error',
            text: err instanceof Error ? err.message : 'Failed to complete Account Aggregator consent callback.',
          })
        } finally {
          // Clean URL without refreshing page
          window.history.replaceState({}, document.title, window.location.pathname)
        }
      }

      handleCallback()
    }
  }, [])

  // Connect mock account mutation
  const connectMockMutation = useMutation({
    mutationFn: () => accountService.connectMock(),
    onSuccess: async () => {
      setIsConnectModalOpen(false)
      setFeedbackMessage({
        type: 'success',
        text: 'Demo student bank account connected successfully.',
      })
      await queryClient.invalidateQueries({ queryKey: ['connected-accounts'] })
    },
    onError: (err: unknown) => {
      setFeedbackMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to connect demo bank account.',
      })
    },
  })

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: (id: number) => accountService.disconnectAccount(id),
    onSuccess: async () => {
      setFeedbackMessage({
        type: 'success',
        text: 'Account disconnected and Account Aggregator consent revoked.',
      })
      await queryClient.invalidateQueries({ queryKey: ['connected-accounts'] })
      await queryClient.invalidateQueries({ queryKey: ['sync-history'] })
    },
    onError: (err: unknown) => {
      setFeedbackMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to disconnect account.',
      })
    },
  })

  // AA Consent flow trigger
  const handleAuthorizeAA = async () => {
    try {
      setIsAuthorizingAA(true)
      setFeedbackMessage(null)

      // Step 1: Initiate consent on backend
      const initRes = await accountService.initiateConsent({
        provider: 'setu_aa',
        customer_identifier: customerVpa.trim() || 'student@setu',
        redirect_url: window.location.origin + '/connected-accounts',
      })

      // Step 2: Handle authorization flow
      // In sandbox mode with simulation or immediate approval, complete the callback
      const callbackRes = await accountService.handleConsentCallback({
        consent_id: initRes.consent_id,
        state: initRes.state,
        status: 'ACTIVE',
      })

      setIsConnectModalOpen(false)
      setFeedbackMessage({
        type: 'success',
        text: callbackRes.message || 'Account Aggregator sandbox consent approved and account linked!',
      })

      // Invalidate all financial queries across the app
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['connected-accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['financial-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics'] }),
        queryClient.invalidateQueries({ queryKey: ['budgets'] }),
        queryClient.invalidateQueries({ queryKey: ['insights'] }),
      ])
    } catch (err: unknown) {
      setFeedbackMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to complete Account Aggregator consent flow.',
      })
    } finally {
      setIsAuthorizingAA(false)
    }
  }

  // Handle manual sync trigger
  const handleSync = async (account: ConnectedAccount) => {
    try {
      setSyncingAccountId(account.id)
      setFeedbackMessage(null)
      const result: SyncRun = await accountService.syncAccount(account.id)

      setFeedbackMessage({
        type: 'success',
        text: `Sync completed: ${result.transactions_imported} imported, ${result.transactions_skipped} duplicates skipped.`,
      })

      // Invalidate all financial queries across the app
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['connected-accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['sync-history', account.id] }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['financial-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics'] }),
        queryClient.invalidateQueries({ queryKey: ['budgets'] }),
        queryClient.invalidateQueries({ queryKey: ['insights'] }),
      ])
    } catch (err: unknown) {
      setFeedbackMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to sync account transactions.',
      })
    } finally {
      setSyncingAccountId(null)
    }
  }

  const accounts = accountsData?.items || []
  const totalBalance = accountsData?.total_connected_balance ?? '0.00'

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span>Connected Accounts</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Automated bank transaction feeds and Account Aggregator sandbox connections
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setIsConnectModalOpen(true)}
          className="gap-1.5 rounded-xl shadow-xs self-start sm:self-auto"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Connect Bank Account</span>
        </Button>
      </div>

      {/* 2. Feedback Notification */}
      {feedbackMessage && (
        <div
          role="alert"
          className={`p-3.5 rounded-xl text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
              : 'bg-destructive/10 border border-destructive/20 text-destructive'
          }`}
        >
          {feedbackMessage.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          )}
          <span className="flex-1">{feedbackMessage.text}</span>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-xs opacity-70 hover:opacity-100 font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 3. Sandbox Architecture & Security Banner */}
      <Card className="rounded-2xl border-primary/20 bg-primary/5 dark:bg-primary/10 p-4 sm:p-5">
        <div className="flex items-start space-x-3.5">
          <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider uppercase text-primary">
                Account Aggregator Sandbox Architecture
              </span>
              <Badge variant="outline" className="text-[10px] font-mono text-primary border-primary/30">
                Sandbox Mode
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Designed according to India’s RBI Account Aggregator framework (Setu AA Sandbox). Real netbanking passwords, bank login credentials, and UPI PINs are never requested or stored. All financial flows use cryptographically signed consent artifacts and user-isolated sandbox data.
            </p>
          </div>
        </div>
      </Card>

      {/* 4. Aggregate Balance Overview Card */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/80 p-4 bg-card">
            <CardContent className="p-0 space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total Connected Bank Balance
              </p>
              <p className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {formatINR(totalBalance)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Reported live by connected institutions · Independent of ledger calculations
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/80 p-4 bg-card">
            <CardContent className="p-0 space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Active Connections
              </p>
              <p className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {accounts.filter((a) => a.status === 'ACTIVE').length}{' '}
                <span className="text-sm font-normal text-muted-foreground">of {accounts.length} linked</span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                Continuous sync enabled for active accounts
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 5. Main Accounts Content */}
      {isLoading ? (
        <div className="py-12">
          <LoadingState message="Loading connected accounts..." />
        </div>
      ) : isError ? (
        <ErrorState
          title="Could not load connected accounts"
          message={error instanceof Error ? error.message : 'Please check your connection and retry.'}
          onRetry={() => refetch()}
        />
      ) : accounts.length === 0 ? (
        <EmptyState
          title="No connected bank accounts"
          description="Connect an account via Account Aggregator Sandbox to simulate automated transaction feeds, balance queries, and consent lifecycle flows."
          actionLabel="Connect Demo Bank Account"
          onAction={() => connectMockMutation.mutate()}
        />
      ) : (
        <div className="space-y-4">
          {accounts.map((account) => {
            const isSyncing = syncingAccountId === account.id
            const isDisconnecting = disconnectMutation.isPending
            const isHistoryOpen = expandedHistoryId === account.id
            const isActive = account.status === 'ACTIVE'
            const isAASandbox = account.provider.toLowerCase().includes('setu') || account.provider.toLowerCase().includes('aggregator')

            const lastSyncedDisplay = account.last_synced_at
              ? new Intl.DateTimeFormat('en-IN', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(account.last_synced_at))
              : 'Never synced'

            return (
              <Card
                key={account.id}
                className="rounded-2xl border-border/80 overflow-hidden bg-card hover:border-border transition-all"
              >
                <div className="p-4 sm:p-5 space-y-4">
                  {/* Card Header: Institution & Badges */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-semibold text-foreground truncate">
                            {account.institution_name}
                          </h2>
                          <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                            {isAASandbox ? 'AA Sandbox' : 'Sandbox'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {account.masked_account_number} · <span className="capitalize">{account.account_type}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <Badge
                        variant={
                          account.status === 'ACTIVE'
                            ? 'secondary'
                            : account.status === 'DISCONNECTED'
                            ? 'outline'
                            : 'destructive'
                        }
                        className={`text-xs capitalize ${
                          account.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : ''
                        }`}
                      >
                        {account.status.toLowerCase()}
                      </Badge>
                    </div>
                  </div>

                  {/* Card Body: Balances and Times */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Bank Balance</span>
                      <span className="text-base sm:text-lg font-bold text-foreground">
                        {formatINR(account.current_balance ?? '0.00')}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block text-[11px]">Last Synced</span>
                      <span className="text-foreground font-medium flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span>{lastSyncedDisplay}</span>
                      </span>
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <span className="text-muted-foreground block text-[11px]">Provider ID</span>
                      <span className="font-mono text-muted-foreground truncate block mt-0.5">
                        {account.provider_account_id}
                      </span>
                    </div>
                  </div>

                  {/* Card Actions: Sync, Disconnect, History */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/60">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSync(account)}
                        disabled={isSyncing || !isActive}
                        className="rounded-xl text-xs gap-1.5 h-9"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                      </Button>

                      {isActive ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => disconnectMutation.mutate(account.id)}
                          disabled={isDisconnecting || isSyncing}
                          className="rounded-xl text-xs gap-1.5 h-9 text-muted-foreground hover:text-destructive"
                        >
                          <Power className="h-3.5 w-3.5" />
                          <span>Disconnect</span>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => (isAASandbox ? setIsConnectModalOpen(true) : connectMockMutation.mutate())}
                          disabled={connectMockMutation.isPending}
                          className="rounded-xl text-xs gap-1.5 h-9"
                        >
                          <PlusCircle className="h-3.5 w-3.5" />
                          <span>Reconnect</span>
                        </Button>
                      )}
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setExpandedHistoryId(isHistoryOpen ? null : account.id)
                      }
                      className="text-xs text-muted-foreground hover:text-foreground gap-1 h-9 rounded-xl"
                    >
                      <History className="h-3.5 w-3.5" />
                      <span>Sync History</span>
                      {isHistoryOpen ? (
                        <ChevronUp className="h-3.5 w-3.5 ml-0.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 ml-0.5" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Collapsible Sync History Panel */}
                {isHistoryOpen && (
                  <div className="border-t border-border/60 bg-muted/20 p-4 space-y-3 animate-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-semibold uppercase tracking-wider text-[11px]">
                        Recent Synchronization Audit Logs
                      </span>
                      <span>Account #{account.id}</span>
                    </div>

                    {isHistoryLoading ? (
                      <div className="py-4 text-center">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
                      </div>
                    ) : !syncHistory || syncHistory.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        No previous sync runs recorded for this account. Click &quot;Sync Now&quot; to fetch feeds.
                      </p>
                    ) : (
                      <div className="divide-y divide-border/50 text-xs">
                        {syncHistory.map((run) => {
                          const runTime = new Intl.DateTimeFormat('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          }).format(new Date(run.started_at))

                          return (
                            <div
                              key={run.id}
                              className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                            >
                              <div className="flex items-center space-x-2">
                                <Badge
                                  variant={
                                    run.status === 'SUCCESS'
                                      ? 'secondary'
                                      : run.status === 'FAILED'
                                      ? 'destructive'
                                      : 'outline'
                                  }
                                  className="text-[10px] py-0 px-1.5"
                                >
                                  {run.status}
                                </Badge>
                                <span className="text-muted-foreground">{runTime}</span>
                              </div>

                              <div className="flex items-center gap-3 text-muted-foreground text-[11px]">
                                <span className="flex items-center gap-1">
                                  <ArrowDownLeft className="h-3 w-3 text-emerald-500" />
                                  <span>{run.transactions_imported} imported</span>
                                </span>
                                <span className="flex items-center gap-1">
                                  <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                                  <span>{run.transactions_skipped} skipped</span>
                                </span>
                                {run.error_message && (
                                  <span className="text-destructive truncate max-w-xs" title={run.error_message}>
                                    {run.error_message}
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* 6. Connect Account Modal Dialog */}
      {isConnectModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="connect-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in"
        >
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 id="connect-dialog-title" className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Landmark className="h-5 w-5 text-primary" />
                  <span>Connect Bank Account</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select a sandbox integration method below
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsConnectModalOpen(false)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              {/* Provider Selection */}
              <div className="space-y-2.5">
                <span className="font-semibold text-foreground block">
                  Select Sandbox Provider:
                </span>

                {/* Option 1: Setu AA Sandbox */}
                <div
                  onClick={() => setSelectedProvider('setu_aa')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    selectedProvider === 'setu_aa'
                      ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                      : 'border-border/80 hover:border-border text-muted-foreground'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-sm">
                          Account Aggregator Sandbox
                        </span>
                        <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                          Setu / RBI AA Standard
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Simulates India’s RBI Account Aggregator consent flow, financial account discovery, and periodic automated data synchronization.
                      </p>
                    </div>
                  </div>

                  {selectedProvider === 'setu_aa' && (
                    <div className="mt-3.5 pt-3 border-t border-primary/20 space-y-2 text-xs">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <FileText className="h-3.5 w-3.5 text-primary" />
                        <span>Purpose: <strong>Personal Finance Management</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Scope: <strong>Deposit Accounts & 12 Months Transactions</strong></span>
                      </div>

                      <div className="space-y-1 pt-1">
                        <label className="text-[11px] font-medium text-foreground block">
                          Student Sandbox AA Handle / Phone:
                        </label>
                        <input
                          type="text"
                          value={customerVpa}
                          onChange={(e) => setCustomerVpa(e.target.value)}
                          placeholder="student@setu"
                          className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Option 2: Quick Demo Bank */}
                <div
                  onClick={() => setSelectedProvider('mock_bank')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    selectedProvider === 'mock_bank'
                      ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                      : 'border-border/80 hover:border-border text-muted-foreground'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-sm">
                          Quick Demo Student Bank
                        </span>
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Mock Sandbox
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Instantly links a pre-configured sandbox bank account for offline UI and ledger verification.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security & Regulatory Notice */}
              <div className="p-3 bg-muted/40 rounded-xl flex items-start space-x-2 text-[11px] text-muted-foreground border border-border/50">
                <KeyRound className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p>
                  Zero credential collection: Student Financial Copilot never asks for netbanking passwords, debit card PINs, or UPI PINs.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-muted/20 border-t border-border flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsConnectModalOpen(false)}
                disabled={isAuthorizingAA || connectMockMutation.isPending}
                className="rounded-xl text-xs h-9"
              >
                Cancel
              </Button>

              {selectedProvider === 'setu_aa' ? (
                <Button
                  size="sm"
                  onClick={handleAuthorizeAA}
                  disabled={isAuthorizingAA}
                  className="rounded-xl text-xs gap-1.5 h-9"
                >
                  {isAuthorizingAA ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Authorizing in AA Sandbox...</span>
                    </>
                  ) : (
                    <span>Authorize in AA Sandbox</span>
                  )}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => connectMockMutation.mutate()}
                  disabled={connectMockMutation.isPending}
                  className="rounded-xl text-xs gap-1.5 h-9"
                >
                  {connectMockMutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <span>Connect Demo Bank</span>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
