import React from 'react'

interface SafeMarkdownViewProps {
  content: string
}

export function SafeMarkdownView({ content }: SafeMarkdownViewProps) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []

  let currentList: string[] = []

  const flushList = (keyPrefix: number) => {
    if (currentList.length > 0) {
      elements.push(
        <ul
          key={`ul-${keyPrefix}`}
          className="list-disc pl-5 space-y-1.5 my-2 text-sm leading-relaxed"
        >
          {currentList.map((item, idx) => (
            <li key={`li-${idx}`}>{renderFormattedText(item)}</li>
          ))}
        </ul>
      )
      currentList = []
    }
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed) {
      flushList(index)
      return
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      currentList.push(trimmed.slice(2))
    } else {
      flushList(index)
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h4
            key={`h4-${index}`}
            className="font-semibold text-sm mt-3 mb-1 text-foreground"
          >
            {renderFormattedText(trimmed.slice(4))}
          </h4>
        )
      } else if (trimmed.startsWith('## ')) {
        elements.push(
          <h3
            key={`h3-${index}`}
            className="font-bold text-base mt-3 mb-1 text-foreground"
          >
            {renderFormattedText(trimmed.slice(3))}
          </h3>
        )
      } else {
        elements.push(
          <p
            key={`p-${index}`}
            className="text-sm leading-relaxed my-1 text-foreground/90"
          >
            {renderFormattedText(trimmed)}
          </p>
        )
      }
    }
  })

  flushList(lines.length)

  return <div className="space-y-1">{elements}</div>
}

function renderFormattedText(text: string): React.ReactNode {
  // Regex to match **bold**, *italic*, or `code`
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const boldText = part.slice(2, -2)
      return (
        <strong key={idx} className="font-semibold text-foreground">
          {boldText}
        </strong>
      )
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <em key={idx} className="italic text-foreground/90">
          {part.slice(1, -1)}
        </em>
      )
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono text-foreground"
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    return part
  })
}
