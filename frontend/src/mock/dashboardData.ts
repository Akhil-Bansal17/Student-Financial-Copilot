import { FinancialSummary, TransactionItem, UpcomingExpense, MoneyInsight } from '@/types'

/**
 * MOCK DATA NOTICE:
 * These values represent the visual foundation for Phase 1.
 * They are intentionally decoupled from any backend logic and will be replaced
 * by verified domain API endpoints in future phases.
 */

export const MOCK_FINANCIAL_SUMMARY: FinancialSummary = {
  safeToSpend: 243,
  statusNote: "You're on track this month",
  availableBalance: 4280,
  spentThisMonth: 5720,
  savings: 1280,
}

export const MOCK_RECENT_TRANSACTIONS: TransactionItem[] = [
  {
    id: 'tx-1',
    title: 'Food',
    amount: 250,
    type: 'expense',
    category: 'Food & Dining',
    date: 'Today, 1:15 PM',
  },
  {
    id: 'tx-2',
    title: 'Metro',
    amount: 60,
    type: 'expense',
    category: 'Transit',
    date: 'Today, 8:40 AM',
  },
  {
    id: 'tx-3',
    title: 'Pocket Money',
    amount: 5000,
    type: 'income',
    category: 'Allowance',
    date: 'Yesterday',
  },
]

export const MOCK_MONEY_INSIGHT: MoneyInsight = {
  id: 'ins-1',
  message: 'Food spending is higher than your usual monthly average.',
  type: 'warning',
  badgeText: 'Spending Insight',
}

export const MOCK_UPCOMING_EXPENSES: UpcomingExpense[] = [
  {
    id: 'exp-1',
    title: 'Netflix',
    amount: 149,
    dueDate: 'Sep 24',
    category: 'Subscription',
  },
  {
    id: 'exp-2',
    title: 'Hostel',
    amount: 2000,
    dueDate: 'Sep 28',
    category: 'Rent & Living',
  },
]
