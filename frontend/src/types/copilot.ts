export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  isError?: boolean
}

export interface CopilotChatRequest {
  message: string
  year?: number
  month?: number
  conversation_history?: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
}

export interface CopilotChatResponse {
  answer: string
  period: string
  has_sufficient_data: boolean
  context_used?: {
    period: string
    current_balance?: string | null
    monthly_income?: string | null
    monthly_expenses?: string | null
    monthly_net_cash_flow?: string | null
    top_spending_category?: string | null
    active_goals_count?: number
    has_sufficient_data?: boolean
  }
  context_summary?: Record<string, unknown>
}
