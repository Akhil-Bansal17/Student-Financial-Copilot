import { useState } from 'react'
import { Search, Filter, ArrowDownLeft, ArrowUpRight, PlusCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatINR } from '@/lib/utils'
import { MOCK_RECENT_TRANSACTIONS } from '@/mock/dashboardData'

const filterCategories = ['All', 'Food & Dining', 'Transit', 'Allowance', 'Academic', 'Subscriptions']

export function ActivityPage() {
  const [selectedFilter, setSelectedFilter] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Activity & Transactions
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Track student expenditures, UPI transfers, and pocket money
          </p>
        </div>
        <Button size="sm" className="hidden sm:inline-flex gap-1.5 rounded-xl">
          <PlusCircle className="h-4 w-4" />
          <span>Add Record</span>
        </Button>
      </div>

      {/* Search and Category Filter Chips */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search expenses, canteen meals, UPI..."
            className="pl-10 h-11 rounded-xl"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filter chips - horizontally scrollable without breaking viewport */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar text-xs">
          <span className="text-muted-foreground flex items-center gap-1 pl-1 shrink-0 font-medium">
            <Filter className="h-3.5 w-3.5" />
          </span>
          {filterCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedFilter(cat)}
              className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition-colors touch-target ${
                selectedFilter === cat
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction List Card */}
      <Card className="rounded-2xl border-border/80 overflow-hidden">
        <div className="p-4 border-b border-border/60 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
          <span>Transactions ({MOCK_RECENT_TRANSACTIONS.length} items)</span>
          <span>September 2026</span>
        </div>

        <div className="divide-y divide-border/60">
          {MOCK_RECENT_TRANSACTIONS.map((tx) => {
            const isExpense = tx.type === 'expense'
            return (
              <div
                key={tx.id}
                className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div
                    className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 ${
                      isExpense
                        ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                        : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                    }`}
                  >
                    {isExpense ? (
                      <ArrowUpRight className="h-5 w-5" />
                    ) : (
                      <ArrowDownLeft className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{tx.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{tx.date}</span>
                      <span>·</span>
                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                        {tx.category}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="text-right pl-3 shrink-0">
                  <p
                    className={`text-sm sm:text-base font-bold tracking-tight ${
                      isExpense
                        ? 'text-foreground'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {isExpense ? `-${formatINR(tx.amount)}` : `+${formatINR(tx.amount)}`}
                  </p>
                  <span className="text-[10px] text-muted-foreground">Settled</span>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="text-center py-4">
        <p className="text-xs text-muted-foreground">
          Financial ledger integration is scheduled for Phase 3.
        </p>
      </div>
    </div>
  )
}
