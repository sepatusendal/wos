interface Props {
  label: string
  color?: 'yellow' | 'blue' | 'green' | 'pink' | 'orange' | 'purple' | 'red'
}

const bgMap: Record<string, string> = {
  yellow: 'bg-nb-yellow', blue: 'bg-nb-blue', green: 'bg-nb-green',
  pink: 'bg-nb-pink', orange: 'bg-nb-orange', purple: 'bg-nb-purple', red: 'bg-nb-red',
}

export function NeubruTag({ label, color }: Props) {
  return <span className={`nb-tag ${color ? bgMap[color] : ''}`}>{label}</span>
}
