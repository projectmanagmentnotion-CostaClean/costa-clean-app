import type { SelectHTMLAttributes } from 'react'
import type { ListSortOption } from '../../features/lists/types'
import { DSSelect } from './DSSelect'

interface DSSortMenuProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label: string
  options: ListSortOption[]
}

export function DSSortMenu({ label, options, ...props }: DSSortMenuProps) {
  return (
    <DSSelect label={label} {...props}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </DSSelect>
  )
}
