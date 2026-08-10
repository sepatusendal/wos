interface Props {
  checked: boolean
  onChange: () => void
}

export function NeubruCheckbox({ checked, onChange }: Props) {
  return (
    <div
      className={`nb-checkbox ${checked ? 'nb-checkbox-checked' : ''}`}
      onClick={onChange}
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === ' ') { e.preventDefault(); onChange() } }}
    >
      {checked && (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 7l3 3 7-7" stroke="#1a1a1c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  )
}
