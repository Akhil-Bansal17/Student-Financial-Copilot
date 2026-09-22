import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Sparkles, CheckCircle2, Shield, Smartphone } from 'lucide-react'

export function OnboardingPage() {
  const steps = [
    {
      title: 'Set Your Monthly Pocket Allowance',
      desc: 'Tell Copilot your typical monthly income or allowance from family/stipend.',
      icon: CheckCircle2,
    },
    {
      title: 'Register Fixed Student Expenses',
      desc: 'Hostel rent, mess bills, and internet fees are locked in first to protect your savings.',
      icon: Shield,
    },
    {
      title: 'Install PWA for 1-Tap Access',
      desc: 'Add Copilot to your mobile home screen for instantaneous daily expense tracking.',
      icon: Smartphone,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-2">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Student Setup</span>
        </div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Welcome to Financial Copilot
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          In 3 simple steps, establish stress-free financial discipline.
        </p>
      </div>

      <div className="space-y-3.5">
        {steps.map((step, idx) => {
          const Icon = step.icon
          return (
            <div
              key={step.title}
              className="p-3.5 rounded-2xl bg-muted/30 border border-border/70 flex items-start space-x-3"
            >
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                {idx + 1}
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <span>{step.title}</span>
                  <Icon className="h-3.5 w-3.5 text-emerald-500" />
                </h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            </div>
          )
        })}
      </div>

      <Link to="/" className="block">
        <Button className="w-full h-11 rounded-xl">
          Complete Tour & Open Dashboard
        </Button>
      </Link>
    </div>
  )
}
