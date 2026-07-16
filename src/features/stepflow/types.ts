import type { ReactNode } from 'react'

export type StepFlowStatus = 'complete' | 'current' | 'blocked' | 'pending'

export interface StepFlowStep {
  id: string
  label: string
  description: string
}

export interface StepFlowAction {
  label: string
  onClick?: () => void
  tone?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
}

export interface StepFlowValidationResult {
  status: 'valid' | 'invalid' | 'warning'
  message?: string
}

export interface StepFlowSummaryItem {
  label: string
  value: string
  hint?: string
}

export interface StepFlowSurfaceProps {
  eyebrow: string
  title: string
  description: string
  steps: StepFlowStep[]
  currentStep: number
  stepStates?: StepFlowStatus[]
  onStepSelect?: (stepIndex: number) => void
  children: ReactNode
  sideContent?: ReactNode
  footerContent?: ReactNode
  contextItems?: StepFlowSummaryItem[]
  hideCurrentStepSummary?: boolean
  hideHeroMeta?: boolean
}
