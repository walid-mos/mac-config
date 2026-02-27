// Enable spying on native ESM module exports (node:fs, node:path, etc.)
// Without this, vi.spyOn(fs, 'writeFileSync') fails with:
// "Cannot spy on export. Module namespace is not configurable in ESM."
import { vi } from 'vitest'

vi.mock('node:fs', { spy: true })
