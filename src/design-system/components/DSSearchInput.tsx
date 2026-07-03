import { SearchBar } from '../../components/SearchBar'

interface DSSearchInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function DSSearchInput(props: DSSearchInputProps) {
  return <SearchBar {...props} />
}
