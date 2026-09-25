import React, { useState } from 'react'
import { AlertCircle, Loader2, Plus, Edit2, Check } from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EXPENSE_CATEGORIES } from '@/types/transaction'
import type { Budget, CreateBudgetRequest, UpdateBudgetRequest } from '@/types/budget'
import { budgetService } from '@/services/budgetService'
import { queryClient } from '@/lib/queryClient'
import { ApiError } from '@/services/apiClient'
import { cn } from '@/lib/utils'

export interface BudgetFormSheetProps {
  isOpen: boolean
  onClose: () => void
  initialBudget?: Budget | { id?: number; category: string | null; amount: string; year: number; month: number } | null
  defaultYear?: number
  defaultMonth?: number
  defaultCategory?: string | null
  onSuccess?: () => void
}

interface FormContentProps {
  initialBudget?: Budget | { id?: number; category: string | null; amount: string; year: number; month: number } | null
  defaultYear: number
  defaultMonth: number
  defaultCategory?: string | null
  onClose: () => void
  onSuccess?: () => void
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

function BudgetFormContent({
  initialBudget,
  defaultYear,
  defaultMonth,
  defaultCategory,
  onClose,
  onSuccess,
}: FormContentProps) {
  const isEditing = Boolean(initialBudget?.id)

  const [budgetType, setBudgetType] = useState<'overall' | 'category'>(
    initialBudget
      ? initialBudget.category
        ? 'category'
        : 'overall'
      : defaultCategory
      ? 'category'
      : 'overall'
  )

  const [category, setCategory] = useState<string>(
    initialBudget?.category ?? defaultCategory ?? EXPENSE_CATEGORIES[0]
  )

  const [amount, setAmount] = useState<string>(
    initialBudget ? String(initialBudget.amount) : ''
  )

  const [year] = useState<number>(initialBudget?.year ?? defaultYear)
  const [month] = useState<number>(initialBudget?.month ?? defaultMonth)

  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    // Validation
    const cleanAmount = amount.trim()
    if (!cleanAmount) {
      setErrorMessage('Please enter a budget amount.')
      return
    }

    const num = parseFloat(cleanAmount)
    if (isNaN(num) || num <= 0) {
      setErrorMessage('Budget amount must be a positive number greater than ₹0.')
      return
    }

    if (budgetType === 'category' && !category) {
      setErrorMessage('Please select an expense category.')
      return
    }

    try {
      setIsSubmitting(true)
      const targetCategory = budgetType === 'category' ? category : null
      const formattedAmount = num.toFixed(2)

      if (isEditing && initialBudget?.id) {
        const updatePayload: UpdateBudgetRequest = {
          amount: formattedAmount,
          category: targetCategory,
        }
        await budgetService.updateBudget(initialBudget.id, updatePayload)
      } else {
        const createPayload: CreateBudgetRequest = {
          year,
          month,
          category: targetCategory,
          amount: formattedAmount,
        }
        await budgetService.createBudget(createPayload)
      }

      // Invalidate relevant React Query caches
      await queryClient.invalidateQueries({ queryKey: ['budgets'] })

      onSuccess?.()
      onClose()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
      } else if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage('Failed to save budget. Please check your inputs.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

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

      {/* Target Month Context */}
      <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border border-border/60 text-xs">
        <span className="text-muted-foreground">Target Period:</span>
        <span className="font-semibold text-foreground">
          {MONTH_NAMES[month - 1]} {year}
        </span>
      </div>

      {/* 1. Budget Type Segmented Control */}
      {!isEditing && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Budget Type
          </label>
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/60">
            <button
              type="button"
              onClick={() => setBudgetType('overall')}
              className={cn(
                'py-2 px-3 rounded-lg text-xs font-semibold transition-all touch-target',
                budgetType === 'overall'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Overall Monthly
            </button>
            <button
              type="button"
              onClick={() => setBudgetType('category')}
              className={cn(
                'py-2 px-3 rounded-lg text-xs font-semibold transition-all touch-target',
                budgetType === 'category'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Category Specific
            </button>
          </div>
        </div>
      )}

      {/* 2. Category Chips (Only shown if budgetType === 'category') */}
      {budgetType === 'category' && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Expense Category
          </label>
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
            {EXPENSE_CATEGORIES.map((cat) => {
              const isSelected = category === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 touch-target',
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-card text-foreground border-border/80 hover:bg-muted/60'
                  )}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                  <span>{cat}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 3. Amount Input with ₹ Prefix */}
      <div className="space-y-1.5">
        <label
          htmlFor="budget-amount-input"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Spending Limit (₹ INR)
        </label>
        <div className="relative flex items-center">
          <span className="absolute left-3.5 text-lg font-bold text-muted-foreground">
            ₹
          </span>
          <Input
            id="budget-amount-input"
            type="number"
            step="0.01"
            min="1"
            placeholder="e.g. 3000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="pl-8 text-base font-semibold h-11 rounded-xl"
            required
            autoFocus
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          {budgetType === 'overall'
            ? 'Total monthly cap across all expenses for this month.'
            : `Monthly spending limit specifically for ${category}.`}
        </p>
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 rounded-xl font-semibold gap-2 shadow-xs"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving Budget...</span>
            </>
          ) : isEditing ? (
            <>
              <Edit2 className="h-4 w-4" />
              <span>Update Budget</span>
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              <span>Set Budget</span>
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

export function BudgetFormSheet({
  isOpen,
  onClose,
  initialBudget,
  defaultYear,
  defaultMonth,
  defaultCategory,
  onSuccess,
}: BudgetFormSheetProps) {
  const now = new Date()
  const year = defaultYear ?? now.getFullYear()
  const month = defaultMonth ?? now.getMonth() + 1
  const isEditing = Boolean(initialBudget?.id)

  const title = isEditing
    ? initialBudget?.category
      ? `Edit ${initialBudget.category} Budget`
      : 'Edit Monthly Budget'
    : 'Set Spending Budget'

  const description = isEditing
    ? 'Adjust your spending limit for this period'
    : 'Define a monthly cap to keep your student expenses under control'

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      position="bottom"
    >
      {isOpen && (
        <BudgetFormContent
          key={initialBudget?.id ? `edit-${initialBudget.id}` : 'create'}
          initialBudget={initialBudget}
          defaultYear={year}
          defaultMonth={month}
          defaultCategory={defaultCategory}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      )}
    </Sheet>
  )
}
