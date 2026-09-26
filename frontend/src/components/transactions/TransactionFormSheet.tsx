import React, { useState } from 'react'
import { AlertCircle, Loader2, Plus, Edit2 } from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  type Transaction,
  type TransactionType,
} from '@/types/transaction'
import { transactionService } from '@/services/transactionService'
import { queryClient } from '@/lib/queryClient'
import { ApiError } from '@/services/apiClient'

interface TransactionFormSheetProps {
  isOpen?: boolean
  open?: boolean
  onClose?: () => void
  onOpenChange?: (open: boolean) => void
  initialTransaction?: Transaction | null
  defaultType?: TransactionType
  onSuccess?: () => void
}

interface FormContentProps {
  initialTransaction?: Transaction | null
  defaultType: TransactionType
  onClose: () => void
  onSuccess?: () => void
}

function TransactionFormContent({
  initialTransaction,
  defaultType,
  onClose,
  onSuccess,
}: FormContentProps) {
  const isEditing = Boolean(initialTransaction)

  // Initialize state directly from props (no useEffect cascading renders)
  const [transactionType, setTransactionType] = useState<TransactionType>(
    initialTransaction?.transaction_type ?? defaultType
  )
  const [amount, setAmount] = useState<string>(
    initialTransaction ? String(initialTransaction.amount) : ''
  )
  const [category, setCategory] = useState<string>(
    initialTransaction?.category ??
      (defaultType === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0])
  )
  const [paymentMethod, setPaymentMethod] = useState<string>(
    initialTransaction?.payment_method ?? 'UPI'
  )
  const [transactionDate, setTransactionDate] = useState<string>(
    initialTransaction
      ? initialTransaction.transaction_date.slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  )
  const [description, setDescription] = useState<string>(
    initialTransaction?.description || ''
  )

  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // When type toggles, ensure category matches current type
  const handleTypeChange = (type: TransactionType) => {
    setTransactionType(type)
    setErrorMessage(null)
    if (type === 'income') {
      if (!INCOME_CATEGORIES.includes(category as typeof INCOME_CATEGORIES[number])) {
        setCategory(INCOME_CATEGORIES[0])
      }
    } else {
      if (!EXPENSE_CATEGORIES.includes(category as typeof EXPENSE_CATEGORIES[number])) {
        setCategory(EXPENSE_CATEGORIES[0])
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    // Validate amount
    const trimmedAmount = amount.trim()
    if (!trimmedAmount) {
      setErrorMessage('Please enter an amount.')
      return
    }

    const num = Number(trimmedAmount)
    if (isNaN(num)) {
      setErrorMessage('Amount must be a valid number.')
      return
    }

    if (num <= 0) {
      setErrorMessage('Amount must be greater than zero.')
      return
    }

    if (!category) {
      setErrorMessage('Please select a category.')
      return
    }

    if (!paymentMethod) {
      setErrorMessage('Please select a payment method.')
      return
    }

    try {
      setIsSubmitting(true)

      const payload = {
        transaction_type: transactionType,
        amount: num.toFixed(2),
        category,
        description: description.trim() || undefined,
        payment_method: paymentMethod,
        transaction_date: transactionDate
          ? new Date(transactionDate).toISOString()
          : new Date().toISOString(),
      }

      if (isEditing && initialTransaction) {
        await transactionService.updateTransaction(initialTransaction.id, payload)
      } else {
        await transactionService.createTransaction(payload)
      }

      // Invalidate relevant query keys
      await queryClient.invalidateQueries({ queryKey: ['transactions'] })
      await queryClient.invalidateQueries({ queryKey: ['financial-summary'] })
      await queryClient.invalidateQueries({ queryKey: ['analytics'] })
      await queryClient.invalidateQueries({ queryKey: ['budgets'] })
      await queryClient.invalidateQueries({ queryKey: ['insights'] })

      onSuccess?.()
      onClose()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
      } else if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage('Failed to save transaction. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const activeCategories = transactionType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Error Alert */}
      {errorMessage && (
        <div
          role="alert"
          className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2 animate-in fade-in"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="leading-snug">{errorMessage}</span>
        </div>
      )}

      {/* 1. Income / Expense Segmented Toggle */}
      <div className="flex rounded-xl bg-muted/60 p-1 border border-border/60">
        <button
          type="button"
          onClick={() => handleTypeChange('expense')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all touch-target select-none ${
            transactionType === 'expense'
              ? 'bg-card text-rose-600 dark:text-rose-400 shadow-xs border border-border/80'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Expense
        </button>
        <button
          type="button"
          onClick={() => handleTypeChange('income')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all touch-target select-none ${
            transactionType === 'income'
              ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-xs border border-border/80'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Income
        </button>
      </div>

      {/* 2. Amount Input with ₹ Prefix */}
      <div className="space-y-1.5">
        <label htmlFor="tx-amount" className="text-xs font-semibold text-foreground">
          Amount (₹ INR)
        </label>
        <div className="relative flex items-center">
          <span className="absolute left-3.5 text-lg font-bold text-muted-foreground">₹</span>
          <Input
            id="tx-amount"
            type="number"
            inputMode="decimal"
            step="any"
            placeholder="0.00"
            value={amount}
            onChange={(e) => {
              setErrorMessage(null)
              setAmount(e.target.value)
            }}
            className="pl-9 text-lg font-bold h-12 rounded-xl"
          />
        </div>
      </div>

      {/* 3. Category Selection (Horizontal/Grid Chips) */}
      <div className="space-y-1.5">
        <label htmlFor="tx-category" className="text-xs font-semibold text-foreground">
          Category
        </label>
        <div className="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto pr-0.5 no-scrollbar">
          {activeCategories.map((cat) => {
            const isSelected = category === cat
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setErrorMessage(null)
                  setCategory(cat)
                }}
                className={`px-2 py-2 text-xs font-medium rounded-xl border text-center transition-all truncate touch-target ${
                  isSelected
                    ? 'bg-primary/10 border-primary text-primary font-semibold ring-1 ring-primary/40'
                    : 'bg-muted/30 border-border/70 text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                }`}
              >
                {cat}
              </button>
            )
          })}
        </div>
      </div>

      {/* 4. Payment Method Chips */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-foreground">Payment Method</label>
        <div className="flex flex-wrap gap-1.5">
          {PAYMENT_METHODS.map((method) => {
            const isSelected = paymentMethod === method
            return (
              <button
                key={method}
                type="button"
                onClick={() => {
                  setErrorMessage(null)
                  setPaymentMethod(method)
                }}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-xl border transition-all touch-target ${
                  isSelected
                    ? 'bg-primary/10 border-primary text-primary font-semibold'
                    : 'bg-muted/30 border-border/70 text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {method}
              </button>
            )
          })}
        </div>
      </div>

      {/* 5. Date Selection */}
      <div className="space-y-1.5">
        <label htmlFor="tx-date" className="text-xs font-semibold text-foreground">
          Transaction Date
        </label>
        <Input
          id="tx-date"
          type="date"
          required
          value={transactionDate}
          onChange={(e) => setTransactionDate(e.target.value)}
          className="h-11 rounded-xl"
        />
      </div>

      {/* 6. Description / Note (Optional) */}
      <div className="space-y-1.5">
        <label htmlFor="tx-desc" className="text-xs font-semibold text-foreground">
          Note / Description <span className="text-muted-foreground font-normal">(Optional)</span>
        </label>
        <Input
          id="tx-desc"
          type="text"
          placeholder="e.g. Canteen lunch, Metro recharge, Books..."
          maxLength={255}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="h-11 rounded-xl text-sm"
        />
      </div>

      {/* Action Buttons */}
      <div className="pt-2 flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isSubmitting}
          className="flex-1 h-11 rounded-xl"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 h-11 rounded-xl flex items-center justify-center gap-1.5"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : isEditing ? (
            <>
              <Edit2 className="h-4 w-4" />
              <span>Update Record</span>
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              <span>Add Record</span>
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

export function TransactionFormSheet({
  isOpen,
  open,
  onClose,
  onOpenChange,
  initialTransaction,
  defaultType = 'expense',
  onSuccess,
}: TransactionFormSheetProps) {
  const visible = isOpen ?? open ?? false
  const handleClose = () => {
    onClose?.()
    onOpenChange?.(false)
  }

  const isEditing = Boolean(initialTransaction)

  return (
    <Sheet
      isOpen={visible}
      onClose={handleClose}
      title={isEditing ? 'Edit Transaction' : 'Add Transaction'}
      description={
        isEditing
          ? 'Update transaction amount, category, or payment method'
          : 'Track a real student expenditure or incoming allowance'
      }
    >
      {visible && (
        <TransactionFormContent
          initialTransaction={initialTransaction}
          defaultType={defaultType}
          onClose={handleClose}
          onSuccess={onSuccess}
        />
      )}
    </Sheet>
  )
}
