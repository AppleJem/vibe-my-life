import { useState } from 'react'

interface CalculatorProps {
  value: number
  onChange: (amount: number) => void
}

export function Calculator({ value, onChange }: CalculatorProps) {
  const [expression, setExpression] = useState(value > 0 ? String(value) : '')
  const [result, setResult] = useState<number | null>(null)

  const evaluateExpression = (expr: string): number | null => {
    try {
      // Replace × with * and ÷ with /
      const sanitized = expr.replace(/×/g, '*').replace(/÷/g, '/')
      // Simple eval (safe for personal use)
      // eslint-disable-next-line no-eval
      const result = Function(`"use strict"; return (${sanitized})`)()
      if (typeof result === 'number' && isFinite(result)) {
        return Math.round(result * 100) / 100
      }
      return null
    } catch {
      return null
    }
  }

  const handleButton = (btn: string) => {
    if (btn === 'C') {
      setExpression('')
      setResult(null)
      onChange(0)
      return
    }

    if (btn === '⌫') {
      const newExpr = expression.slice(0, -1)
      setExpression(newExpr)
      const newResult = evaluateExpression(newExpr)
      setResult(newResult)
      if (newResult !== null) onChange(newResult)
      return
    }

    if (btn === '=') {
      const finalResult = evaluateExpression(expression)
      if (finalResult !== null) {
        setResult(finalResult)
        setExpression(String(finalResult))
        onChange(finalResult)
      }
      return
    }

    // Prevent multiple operators in a row
    const lastChar = expression.slice(-1)
    const isOperator = ['+', '-', '×', '÷'].includes(btn)
    const lastIsOperator = ['+', '-', '×', '÷'].includes(lastChar)

    if (isOperator && lastIsOperator) {
      setExpression(expression.slice(0, -1) + btn)
      return
    }

    // Prevent multiple dots in same number
    if (btn === '.') {
      const parts = expression.split(/[+\-×÷]/)
      const currentNumber = parts[parts.length - 1]
      if (currentNumber.includes('.')) return
    }

    const newExpr = expression + btn
    setExpression(newExpr)

    const newResult = evaluateExpression(newExpr)
    setResult(newResult)
    if (newResult !== null) onChange(newResult)
  }

  const buttons = [
    ['C', '⌫', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['0', '.', '='],
  ]

  const getButtonStyle = (btn: string) => {
    const base = 'w-full h-14 rounded-xl text-lg font-semibold transition-colors active:scale-95 '

    if (btn === 'C' || btn === '⌫') {
      return base + 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
    }
    if (['÷', '×', '-', '+', '='].includes(btn)) {
      return base + 'bg-rose-400/20 text-rose-400 hover:bg-rose-400/30'
    }
    return base + 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
  }

  return (
    <div>
      {/* Display */}
      <div className="bg-zinc-800 rounded-xl p-4 mb-4">
        <div className="text-right text-zinc-400 text-sm h-6 overflow-hidden">
          {expression || '0'}
        </div>
        <div className="text-right text-zinc-100 text-2xl font-bold">
          {result !== null ? `$${result.toFixed(2)}` : '$0.00'}
        </div>
      </div>

      {/* Button grid */}
      <div className="space-y-2">
        {buttons.map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-4 gap-2">
            {row.map((btn) => (
              <button
                key={btn}
                onClick={() => handleButton(btn)}
                className={getButtonStyle(btn)}
              >
                {btn}
              </button>
            ))}
            {/* Fill empty cells in last row */}
            {rowIndex === buttons.length - 1 && <div />}
          </div>
        ))}
      </div>
    </div>
  )
}
