import { Target, Plus, Laptop, Palmtree, ShieldCheck } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatINR } from '@/lib/utils'

export function GoalsPage() {
  const studentGoals = [
    {
      id: 'g-1',
      title: 'Coding Laptop Upgrade',
      target: 25000,
      current: 12500,
      targetDate: 'Dec 2026',
      icon: Laptop,
      color: 'bg-indigo-600',
    },
    {
      id: 'g-2',
      title: 'Semester Break Trip',
      target: 6000,
      current: 3600,
      targetDate: 'Nov 2026',
      icon: Palmtree,
      color: 'bg-emerald-600',
    },
    {
      id: 'g-3',
      title: 'Emergency Textbook & Exam Reserve',
      target: 5000,
      current: 4100,
      targetDate: 'Ongoing',
      icon: ShieldCheck,
      color: 'bg-amber-600',
    },
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>Savings Goals</span>
            <Target className="h-5 w-5 text-primary" />
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Targeted allowances for student aspirations and emergency reserves
          </p>
        </div>
        <Button size="sm" className="hidden sm:inline-flex gap-1.5 rounded-xl">
          <Plus className="h-4 w-4" />
          <span>New Goal</span>
        </Button>
      </div>

      {/* Goals List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {studentGoals.map((goal) => {
          const progressPercent = Math.min(100, Math.round((goal.current / goal.target) * 100))
          const Icon = goal.icon

          return (
            <Card key={goal.id} className="rounded-2xl border-border/80 p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground line-clamp-1">{goal.title}</h3>
                    <span className="text-[11px] text-muted-foreground">Due {goal.targetDate}</span>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] font-semibold">
                  {progressPercent}%
                </Badge>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full ${goal.color} rounded-full transition-all duration-500`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">{formatINR(goal.current)}</span>
                  <span className="text-muted-foreground">of {formatINR(goal.target)}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Auto-save: ₹50/day</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">On Track</span>
              </div>
            </Card>
          )
        })}
      </div>

      <div className="text-center py-4">
        <p className="text-xs text-muted-foreground">
          Goal tracking algorithm and dynamic auto-allocations will be activated in Phase 5.
        </p>
      </div>
    </div>
  )
}
