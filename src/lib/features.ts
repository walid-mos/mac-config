export interface Feature {
  icon: string
  title: string
  description: string
}

export const features: Feature[] = [
  {
    icon: '🚀',
    title: 'Fast',
    description: 'Blazing fast build pipeline.',
  },
  {
    icon: '⚡',
    title: 'Parallel',
    description: 'Agents work in parallel for maximum throughput.',
  },
  {
    icon: '🛡️',
    title: 'Safe',
    description: 'Mandatory security review on every iteration.',
  },
]
