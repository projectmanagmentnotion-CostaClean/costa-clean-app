import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const v3TreeFiles = [
  'src/v3/components/V3Primitives.tsx',
  'src/v3/invoices/V3InvoicesPage.tsx',
  'src/v3/shell/V3ShellChrome.tsx',
  'src/v3/clients/V3ClientsPage.tsx',
  'src/v3/clients/V3ContactActions.tsx',
  'src/v3/clients/contactActions.ts',
  'src/v3/quotes/V3QuotesPage.tsx',
  'src/v3/documents/shareDocument.ts',
  'src/v3/leads/V3LeadsPage.tsx',
  'src/v3/leads/V3LeadRow.tsx',
  'src/v3/leads/V3LeadWorkspace.tsx',
  'src/v3/jobs/V3JobsPage.tsx',
  'src/v3/jobs/V3JobRow.tsx',
  'src/v3/jobs/V3JobWorkspace.tsx',
  'src/v3/jobs/jobWorkReport.tsx',
  'src/v3/home/V3HomePage.tsx',
  'src/v3/home/V3HomeHeroKpi.tsx',
  'src/v3/home/V3HomeMetric.tsx',
  'src/v3/home/V3HomePriorityQueue.tsx',
  'src/v3/home/homePriorities.ts',
  'src/v3/payments/V3PaymentsPage.tsx',
  'src/v3/payments/V3PaymentRow.tsx',
  'src/v3/payments/V3PaymentWorkspace.tsx',
  'src/v3/expenses/V3ExpensesPage.tsx',
  'src/v3/expenses/V3ExpenseRow.tsx',
  'src/v3/expenses/V3ExpenseWorkspace.tsx',
  'src/v3/alerts/V3AlertsPage.tsx',
  'src/v3/closing/V3ClosingPage.tsx',
  'src/v3/properties/V3PropertiesPage.tsx',
  'src/v3/properties/V3PropertyRow.tsx',
  'src/v3/properties/V3PropertyWorkspace.tsx',
  'src/v3/selection/V3SelectionPrimitives.tsx',
  'src/v3/selection/useV3Selection.ts',
  'src/v3/selection/selectionEligibility.ts',
]

const v3Styles = [
  'src/v3/design/tokens.css',
  'src/v3/design/v3.css',
].map((file) => readFileSync(join(process.cwd(), file), 'utf8')).join('\n')

function readV3Tree() {
  return v3TreeFiles.map((file) => readFileSync(join(process.cwd(), file), 'utf8')).join('\n')
}

describe('V3 Design Guardian structural checks', () => {
  it('keeps the dedicated V3 tree free of legacy visual composition names', () => {
    const source = readV3Tree()
    for (const forbiddenName of ['hero-card', 'cc-master-layout', 'OperationalListItem', 'cc-record-card', 'cc-list-toolbar', 'BulkSelectionToolbar', 'LegacySelectionToolbar']) {
      expect(source).not.toContain(forbiddenName)
    }
  })

  it('keeps global selection UI token-based and limited to approved modules', () => {
    const source = readV3Tree()
    expect(v3Styles).toContain('v3-bottom-nav-clearance')
    expect(source).not.toContain('localStorage')
    expect(source).toContain('V3SelectionPrimitives')
    expect(source).not.toContain('V3SelectionToolbar')
  })

  it('keeps hardcoded colors inside the token file only', () => {
    expect(readV3Tree()).not.toMatch(/#[0-9a-f]{3,8}\b/i)
  })

  it('keeps quote presentation free of private geometry and legacy composition', () => {
    const source = readV3Tree()
    expect(source).not.toMatch(/border-radius\s*:/i)
    expect(source).not.toMatch(/height\s*:\s*\d+px/i)
    expect(source).not.toContain('QuotesList')
    expect(source).not.toContain('QuoteDetailCard')
  })

  it('keeps lead presentation free of legacy composition and fake review state', () => {
    const source = readV3Tree()
    expect(source).not.toMatch(/border-radius\s*:/i)
    expect(source).not.toMatch(/height\s*:\s*\d+px/i)
    expect(source).not.toContain('LeadsList')
    expect(source).not.toContain('LeadDetailCard')
    expect(source).not.toContain('reviewed_at')
    expect(source).not.toContain('reviewed_by')
  })

  it('keeps services presentation free of legacy composition and fictional work claims', () => {
    const source = [
      'src/v3/jobs/V3JobsPage.tsx',
      'src/v3/jobs/V3JobRow.tsx',
      'src/v3/jobs/V3JobWorkspace.tsx',
      'src/v3/jobs/jobWorkReport.tsx',
    ].map((file) => readFileSync(join(process.cwd(), file), 'utf8')).join('\n').replaceAll('V3JobWorkspace', '')
    expect(source).not.toMatch(/border-radius\s*:/i)
    expect(source).not.toMatch(/height\s*:\s*\d+px/i)
    for (const forbiddenName of ['JobsList', 'JobWorkspace', 'JobDetailCard', 'Firmado por cliente', 'Servicio verificado', 'GPS completado', 'biometría']) {
      expect(source).not.toContain(forbiddenName)
    }
    expect(source).toContain('No es un certificado de ejecución')
  })

  it('keeps home presentation free of legacy dashboard, motion and fake metric composition', () => {
    const homeFiles = [
      'src/v3/home/V3HomePage.tsx',
      'src/v3/home/V3HomeHeroKpi.tsx',
      'src/v3/home/V3HomeMetric.tsx',
      'src/v3/home/V3HomePriorityQueue.tsx',
      'src/v3/home/homePriorities.ts',
    ]
    const source = homeFiles.map((file) => readFileSync(join(process.cwd(), file), 'utf8')).join('\n')
    for (const forbiddenName of ['DSPageHeader', 'HomeFiscalKpiGrid', 'HomeQuickActionsPanel', 'HomeAlertSummaryStrip', 'HomeMotionSection', 'home-gsap-dashboard', 'monthlyGoal', 'target', 'LTV', 'margen', 'beneficio']) {
      expect(source).not.toContain(forbiddenName)
    }
    expect(source).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(source).not.toMatch(/border-radius\s*:/i)
    expect(source).not.toMatch(/height\s*:\s*\d+px/i)
  })

  it('keeps payments and expenses presentation free of legacy master/detail and invented finance UI', () => {
    const source = [
      'src/v3/payments/V3PaymentsPage.tsx',
      'src/v3/payments/V3PaymentRow.tsx',
      'src/v3/payments/V3PaymentWorkspace.tsx',
      'src/v3/expenses/V3ExpensesPage.tsx',
      'src/v3/expenses/V3ExpenseRow.tsx',
      'src/v3/expenses/V3ExpenseWorkspace.tsx',
    ].map((file) => readFileSync(join(process.cwd(), file), 'utf8')).join('\n')
    for (const forbiddenName of ['PaymentsList', 'PaymentDetailCard', 'ExpensesList', 'ExpenseDetailCard', 'ExecutiveHeader', 'VisualKpiCard', 'cc-master-layout', 'saldo bancario', 'SEPA', 'conciliación bancaria']) {
      expect(source).not.toContain(forbiddenName)
    }
    expect(source).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(source).not.toMatch(/border-radius\s*:/i)
    expect(source).not.toMatch(/height\s*:\s*\d+px/i)
    expect(source).toContain('Estimación fiscal asistida')
    expect(source).toContain('Origen automático')
  })

  it('keeps alerts and closings on real contracts without fake state or settings', () => {
    const source = [
      'src/v3/alerts/V3AlertsPage.tsx',
      'src/v3/closing/V3ClosingPage.tsx',
    ].map((file) => readFileSync(join(process.cwd(), file), 'utf8')).join('\n')
    for (const forbiddenName of ['NotificationsSettings', 'SettingsPage', 'delivered', 'verified', 'GPS', 'eIDAS', 'biometría', 'AEAT', 'certificado oficial']) {
      expect(source).not.toContain(forbiddenName)
    }
    expect(source).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(source).not.toMatch(/border-radius\s*:/i)
    expect(source).not.toMatch(/height\s*:\s*\d+px/i)
    expect(source).toContain('buildClosingSummary')
    expect(source).toContain('Guardar preparación')
  })

  it('keeps properties on native V3 presentation and real property contracts', () => {
    const source = readV3Tree().replaceAll('PropertyWorkspace', '')
    for (const forbiddenName of ['PropertiesList', 'PropertyWorkspace', 'PropertyDetailCard', 'DSPageHeader', 'VisualKpiCard', 'cc-master-page', 'PropertyCreateFlow', 'FullscreenStepFlow', 'DSSmartLocationFields', 'ClientCreateForm', 'lead-form', 'form-field']) {
      expect(source).not.toContain(forbiddenName)
    }
    expect(source).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(source).not.toMatch(/border-radius\s*:/i)
    expect(source).not.toMatch(/height\s*:\s*\d+px/i)
    expect(source).toContain('findPropertyDuplicateGroups')
    expect(source).toContain('createProperty')
    expect(source).toContain('updateProperty')
  })

  it('uses one tokenized opaque dock clearance contract', () => {
    expect(v3Styles).toContain('--v3-bottom-nav-clearance')
    expect(v3Styles).toContain('padding: calc(var(--v3-space-7) + var(--v3-safe-top)) var(--v3-space-6) var(--v3-bottom-nav-clearance)')
    expect(v3Styles).toContain('background: var(--v3-color-surface)')
    expect(v3Styles).not.toMatch(/calc\(96px|padding-bottom:\s*96px/i)
  })
})
