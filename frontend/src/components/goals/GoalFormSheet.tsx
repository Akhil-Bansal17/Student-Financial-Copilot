import React, { useState } from 'react'
import { AlertCircle, Loader2, Plus, Edit2, Calendar } from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Goal, CreateGoalRequest, UpdateGoalRequest } from '@/types/goal'
import { goalService } from '@/services/goalService'
import { queryClient } from '@/lib/queryClient'
import { ApiError } from '@/services/apiClient'
import { formatINR } from '@/lib/utils'

export interface GoalFormSheetProps {
  isOpen: boolean
  onClose: () => void
  initialGoal?: Goal | null
  onSuccess?: () => void
}

interface FormContentProps {
  initialGoal?: Goal | null
  onClose: () => void
  onSuccess?: () => void
}

function GoalFormContent({ initialGoal, onClose, onSuccess }: FormContentProps) {
  const isEditing = Boolean(initialGoal?.id)

  const [name, setName] = useState(initialGoal?.name ?? '')
  const [description, setDescription] = useState(initialGoal?.description ?? '')
  const [targetAmount, setTargetAmount] = useState(
    initialGoal ? String(initialGoal.target_amount) : ''
  )
  const [targetDate, setTargetDate] = useState(initialGoal?.target_date ?? '')

  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    const cleanName = name.trim()
    if (!cleanName) {
      setErrorMessage('Please enter a goal name.')
      return
    }

    const cleanAmount = targetAmount.trim()
    if (!cleanAmount) {
      setErrorMessage('Please enter a target savings amount.')
      return
    }

    const num = parseFloat(cleanAmount)
    if (isNaN(num) || num <= 0) {
      setErrorMessage('Target amount must be a positive number greater than ₹0.')
      return
    }

    if (isEditing && initialGoal) {
      const savedNum = parseFloat(initialGoal.current_amount)
      if (num < savedNum) {
        setErrorMessage(
          `Target amount cannot be less than currently saved amount (${formatINR(savedNum)}).`
        )
        return
      }
    }

    try {
      setIsSubmitting(true)
      const formattedAmount = num.toFixed(2)
      const cleanDesc = description.trim() || null
      const cleanDate = targetDate.trim() || null

      if (isEditing && initialGoal) {
        const updatePayload: UpdateGoalRequest = {
          name: cleanName,
          description: cleanDesc,
          target_amount: formattedAmount,
          target_date: cleanDate,
        }
        await goalService.updateGoal(initialGoal.id, updatePayload)
      } else {
        const createPayload: CreateGoalRequest = {
          name: cleanName,
          description: cleanDesc,
          target_amount: formattedAmount,
          target_date: cleanDate,
        }
        await goalService.createGoal(createPayload)
      }

      await queryClient.invalidateQueries({ queryKey: ['goals'] })
      await queryClient.invalidateQueries({ queryKey: ['insights'] })

      onSuccess?.()
      onClose()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
      } else if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage('Failed to save goal. Please check your inputs.')
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

      {/* Goal Title */}
      <div className="space-y-1.5">
        <label
          htmlFor="goal-name-input"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Goal Title *
        </label>
        <Input
          id="goal-name-input"
          type="text"
          placeholder="e.g. Coding Laptop, Semester Trip, Emergency Reserve"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          className="h-11 rounded-xl"
          required
          autoFocus
        />
      </div>

      {/* Target Amount */}
      <div className="space-y-1.5">
        <label
          htmlFor="goal-target-amount-input"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Target Amount (₹ INR) *
        </label>
        <div className="relative flex items-center">
          <span className="absolute left-3.5 text-lg font-bold text-muted-foreground">
            ₹
          </span>
          <Input
            id="goal-target-amount-input"
            type="number"
            step="0.01"
            min="1"
            placeholder="e.g. 50000"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            className="pl-8 text-base font-semibold h-11 rounded-xl"
            required
          />
        </div>
        {isEditing && initialGoal && (
          <p className="text-[11px] text-muted-foreground">
            Currently saved: <span className="font-semibold text-foreground">{formatINR(initialGoal.current_amount)}</span>
          </p>
        )}
      </div>

      {/* Optional Target Date */}
      <div className="space-y-1.5">
        <label
          htmlFor="goal-target-date-input"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
        >
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Target Date (Optional)</span>
        </label>
        <Input
          id="goal-target-date-input"
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          className="h-11 rounded-xl"
        />
        <p className="text-[11px] text-muted-foreground">
          Leave blank for an ongoing savings target.
        </p>
      </div>

      {/* Optional Description */}
      <div className="space-y-1.5">
        <label
          htmlFor="goal-desc-input"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Note / Motivation (Optional)
        </label>
        <Input
          id="goal-desc-input"
          type="text"
          placeholder="e.g. High-performance machine for CS semester project"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={255}
          className="h-11 rounded-xl"
        />
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
              <span>Saving Goal...</span>
            </>
          ) : isEditing ? (
            <>
              <Edit2 className="h-4 w-4" />
              <span>Update Goal</span>
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              <span>Create Savings Goal</span>
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

export function GoalFormSheet({
  isOpen,
  onClose,
  initialGoal,
  onSuccess,
}: GoalFormSheetProps) {
  const isEditing = Boolean(initialGoal?.id)

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit ${initialGoal?.name}` : 'New Savings Goal'}
      description={
        isEditing
          ? 'Update target parameters for your savings goal'
          : 'Define a dedicated savings target for campus life and personal aspirations'
      }
      position="bottom"
    >
      {isOpen && (
        <GoalFormContent
          key={initialGoal?.id ? `edit-${initialGoal.id}` : 'create'}
          initialGoal={initialGoal}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      )}
    </Sheet>
  )
}
