import type { TechStack } from '../../detect/tech-stack.js'

export const renderTechStackSection = (techStack: TechStack): string => {
  const lines = [
    `- Languages: ${techStack.languages.join(', ')}`,
    `- Frameworks: ${techStack.frameworks.join(', ')}`,
    `- Test runner: ${techStack.testRunner ?? 'none'}`,
    `- Package manager: ${techStack.packageManager}`,
    `- Build tool: ${techStack.buildTool ?? 'none'}`,
    `- Test command: ${techStack.testCommand}`,
  ]

  if (techStack.buildCommand) {
    lines.push(`- Build command: ${techStack.buildCommand}`)
  }

  if (techStack.typecheckCommand) {
    lines.push(`- Typecheck command: ${techStack.typecheckCommand}`)
  }

  if (techStack.lintCommand) {
    lines.push(`- Lint command: ${techStack.lintCommand}`)
  }

  return `# Tech Stack\n\n${lines.join('\n')}`
}

export const buildStructuredJsonOutputSection = (title: string, payload: string): string => [
  title,
  '```json',
  payload,
  '```',
].join('\n')
