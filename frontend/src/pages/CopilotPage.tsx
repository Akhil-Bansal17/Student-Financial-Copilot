import { useState, useRef, useEffect } from 'react'
import {
  Sparkles,
  Send,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  Calendar,
  ShieldCheck,
  User,
  Bot,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SafeMarkdownView } from '@/components/copilot/SafeMarkdownView'
import { copilotService } from '@/services/copilotService'
import type { ChatMessage, CopilotChatResponse } from '@/types/copilot'

const SUGGESTED_PROMPTS = [
  'Summarize my finances this month',
  'Where did most of my money go?',
  'Am I close to any budget limits?',
  'How are my savings goals going?',
  'What changed this month?',
  'Explain my biggest spending pattern',
]

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

let messageIdCounter = 0
function createMessageId(prefix: string): string {
  messageIdCounter += 1
  return `${prefix}-${messageIdCounter}`
}

export function CopilotPage() {
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1)

  const [inputMessage, setInputMessage] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  const handleSend = async (messageToSend?: string) => {
    const text = (messageToSend ?? inputMessage).trim()
    if (!text || isLoading) return

    const userMessageId = createMessageId('user')
    const userMsg: ChatMessage = {
      id: userMessageId,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    // Add user message to UI
    setMessages((prev) => [...prev, userMsg])
    if (!messageToSend) {
      setInputMessage('')
    }
    setIsLoading(true)
    setLastFailedMessage(null)

    try {
      // Build conversation history for multi-turn context (last 6 turns)
      const history = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const response: CopilotChatResponse = await copilotService.sendMessage({
        message: text,
        year: selectedYear,
        month: selectedMonth,
        conversation_history: history,
      })

      const assistantMsg: ChatMessage = {
        id: createMessageId('assistant'),
        role: 'assistant',
        content: response.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch {
      setLastFailedMessage(text)
      const errorMsg: ChatMessage = {
        id: createMessageId('error'),
        role: 'assistant',
        content:
          'Unable to reach the Financial Copilot right now. Please check your connection or retry in a moment.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClearChat = () => {
    setMessages([])
    setLastFailedMessage(null)
  }

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-6.5rem)] animate-in fade-in duration-200">
      {/* Top Header Card */}
      <Card className="rounded-2xl border-border/80 p-4 bg-card shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center text-white shadow-md shadow-primary/20 shrink-0">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base sm:text-lg font-bold text-foreground">
                  Financial Copilot
                </h1>
                <Badge variant="outline" className="text-[10px] gap-1 text-primary border-primary/30">
                  <ShieldCheck className="h-3 w-3" />
                  Ledger Grounded
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Natural-language explanations of your authenticated student finances
              </p>
            </div>
          </div>

          {/* Period Selector & Clear Button */}
          <div className="flex items-center space-x-2 self-end sm:self-auto">
            <div className="flex items-center space-x-1.5 bg-muted/50 rounded-xl px-2.5 py-1 text-xs border border-border/60">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                aria-label="Select Month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-transparent text-foreground font-medium text-xs focus:outline-none cursor-pointer"
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name.slice(0, 3)}
                  </option>
                ))}
              </select>
              <select
                aria-label="Select Year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent text-foreground font-medium text-xs focus:outline-none cursor-pointer"
              >
                {[2025, 2026, 2027].map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearChat}
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-destructive"
                title="Clear conversation"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Main Chat Thread Area */}
      <Card className="flex-1 rounded-2xl border-border/80 bg-card p-4 overflow-y-auto flex flex-col space-y-4">
        {messages.length === 0 ? (
          /* Empty State: Warm greeting + suggested questions */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4 sm:p-8 space-y-6 my-auto">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
              <Sparkles className="h-7 w-7" />
            </div>

            <div className="max-w-md space-y-2">
              <h2 className="text-lg font-bold text-foreground">
                How can I help with your finances today?
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                I am connected strictly to your verified database records for{' '}
                <strong className="text-foreground">
                  {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                </strong>
                . Ask me anything about your spending, budget limits, or savings progress.
              </p>
            </div>

            {/* Suggested Chips */}
            <div className="w-full max-w-lg space-y-2 text-left">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block text-center">
                Suggested Questions
              </span>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleSend(prompt)}
                    className="inline-flex items-center text-xs font-medium bg-muted/60 hover:bg-primary/10 hover:text-primary text-foreground border border-border/70 rounded-xl px-3 py-2 transition-all cursor-pointer text-left shadow-xs hover:border-primary/30"
                  >
                    <Sparkles className="h-3 w-3 mr-1.5 text-primary shrink-0" />
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Chat Message Thread */
          <div className="space-y-4 flex-1">
            {messages.map((msg) => {
              const isUser = msg.role === 'user'

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1 animate-in fade-in duration-150`}
                >
                  <div className="flex items-center space-x-1.5 px-1 text-[11px] text-muted-foreground">
                    {isUser ? (
                      <>
                        <span>{msg.timestamp}</span>
                        <User className="h-3 w-3" />
                      </>
                    ) : (
                      <>
                        <Bot className="h-3 w-3 text-primary" />
                        <span className="font-semibold text-primary">Copilot</span>
                        <span>•</span>
                        <span>{msg.timestamp}</span>
                      </>
                    )}
                  </div>

                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[90%] sm:max-w-[80%] ${
                      isUser
                        ? 'bg-primary text-primary-foreground rounded-br-xs shadow-sm font-medium'
                        : msg.isError
                        ? 'bg-destructive/10 border border-destructive/30 text-destructive rounded-bl-xs'
                        : 'bg-muted/40 border border-border/80 text-foreground rounded-bl-xs shadow-xs'
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    ) : (
                      <div className="space-y-2">
                        <SafeMarkdownView content={msg.content} />

                        {/* Action footer for assistant messages */}
                        <div className="flex items-center justify-between pt-2 border-t border-border/40 mt-2 text-[11px] text-muted-foreground">
                          {msg.isError ? (
                            <button
                              type="button"
                              onClick={() => lastFailedMessage && handleSend(lastFailedMessage)}
                              className="inline-flex items-center text-xs font-semibold text-destructive hover:underline cursor-pointer"
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Retry Question
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleCopy(msg.id, msg.content)}
                              className="inline-flex items-center space-x-1 hover:text-foreground transition-colors cursor-pointer"
                              title="Copy answer"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-500" />
                                  <span className="text-emerald-500 font-medium">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Thinking / Loading Indicator */}
            {isLoading && (
              <div className="flex flex-col items-start space-y-1 animate-in fade-in">
                <div className="flex items-center space-x-1.5 px-1 text-[11px] text-muted-foreground">
                  <Bot className="h-3 w-3 text-primary" />
                  <span className="font-semibold text-primary">Copilot</span>
                  <span>is analyzing...</span>
                </div>
                <div className="bg-muted/40 border border-border/80 rounded-2xl rounded-bl-xs px-4 py-3 shadow-xs flex items-center space-x-2">
                  <div className="flex space-x-1.5">
                    <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 rounded-full bg-primary animate-bounce" />
                  </div>
                  <span className="text-xs text-muted-foreground ml-1">
                    Checking verified database ledger...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </Card>

      {/* Suggested chips row if chat is in progress */}
      {messages.length > 0 && !isLoading && (
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 px-1 scrollbar-none shrink-0">
          <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
            Suggestions:
          </span>
          {SUGGESTED_PROMPTS.slice(0, 3).map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handleSend(prompt)}
              className="text-xs font-medium bg-muted/60 hover:bg-primary/10 hover:text-primary text-foreground border border-border/70 rounded-full px-3 py-1 transition-all whitespace-nowrap cursor-pointer shrink-0"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Bottom Message Input Area */}
      <Card className="rounded-2xl border-border/80 p-2 sm:p-2.5 bg-card shrink-0 shadow-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex items-center space-x-2"
        >
          <div className="relative flex-1">
            <input
              id="copilot-input"
              ref={inputRef}
              type="text"
              value={inputMessage}
              maxLength={1000}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder={`Ask about your ${MONTH_NAMES[selectedMonth - 1]} finances...`}
              className="w-full bg-background rounded-xl border border-input px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-50"
            />
            {inputMessage.length > 800 && (
              <span className="absolute right-3 top-2.5 text-[10px] text-muted-foreground font-mono">
                {inputMessage.length}/1000
              </span>
            )}
          </div>

          <Button
            id="copilot-send-button"
            type="submit"
            disabled={!inputMessage.trim() || isLoading}
            className="rounded-xl px-4 h-10 shrink-0 font-semibold"
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span className="hidden sm:inline mr-1">Ask</span>
                <Send className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        <p className="text-[10px] text-muted-foreground text-center mt-1.5">
          AI Financial Copilot answers using your recorded ledger data. Not certified financial advice.
        </p>
      </Card>
    </div>
  )
}
