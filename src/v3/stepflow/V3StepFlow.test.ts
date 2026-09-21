import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { V3StepFlow } from './V3StepFlow'

describe('V3StepFlow monostep governance', () => {
  it('renders one current step with progress and stable actions', () => {
    const html = renderToStaticMarkup(createElement(V3StepFlow, { title: 'Prueba', steps: [{ id: 'one', title: 'Uno', content: createElement('input', { 'aria-label': 'Campo' }) }, { id: 'two', title: 'Dos', content: createElement('p', null, 'Segundo') }], onCancel: () => undefined, onComplete: () => undefined, completeLabel: 'Guardar' }))
    expect(html).toContain('Paso 1 de 2')
    expect(html).toContain('data-step-body-scroll="0"')
    expect(html).toContain('Continuar')
    expect(html).not.toContain('Segundo')
  })

  it('keeps every governed V3 create/edit surface on the shared primitive', () => {
    const files = [
      'src/v3/clients/V3ClientWriteFlow.tsx', 'src/v3/expenses/V3ExpenseFormFlow.tsx', 'src/v3/invoices/V3InvoiceCreateFlow.tsx', 'src/v3/invoices/V3InvoiceEditFlow.tsx',
      'src/v3/jobs/V3JobCreateFlow.tsx', 'src/v3/jobs/V3JobWorkspace.tsx', 'src/v3/leads/V3LeadCreateFlow.tsx', 'src/v3/leads/V3LeadWorkspace.tsx',
      'src/v3/payments/V3PaymentCreateFlow.tsx', 'src/v3/properties/V3PropertyWriteFlow.tsx', 'src/v3/quotes/V3QuoteCreateFlow.tsx', 'src/v3/quotes/V3QuoteEditFlow.tsx', 'src/v3/recurring/V3RecurringPlans.tsx',
    ]
    for (const file of files) expect(readFileSync(resolve(process.cwd(), file), 'utf8')).toContain('V3StepFlow')
  })

  it('does not provide an internal step scrollbar workaround', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/v3/design/v3.css'), 'utf8')
    expect(css).toContain('.v3-step-flow__body')
    expect(css).toContain('.v3-step-flow__step-body')
    expect(css).not.toMatch(/\.v3-step-flow__step-body[^}]*overflow-y\s*:\s*(auto|scroll)/u)
  })
})
