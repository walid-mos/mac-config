import type { SwarmConfig, SwarmEventEmitter, AgentRole, ModelId } from '../core/types.js'
import { getModelAssignment } from '../config/config-resolver.js'
import { createClaudeDriver } from './claude-driver.js'
import { createOpenCodeDriver } from './opencode-driver.js'
import type { DriverRegistry, DriverResolution, BackendName, DriverAvailability, Driver } from './driver.js'

// ---------------------------------------------------------------------------
// createDriverRegistry
// ---------------------------------------------------------------------------

export function createDriverRegistry(
  config: SwarmConfig,
  emitter: SwarmEventEmitter
): DriverRegistry {
  // Eagerly instantiate both drivers
  const claudeDriver = createClaudeDriver(emitter)
  const openCodeDriver = createOpenCodeDriver(emitter)

  const drivers: Record<BackendName, Driver> = {
    claude: claudeDriver,
    opencode: openCodeDriver,
  }

  function getDriver(role: AgentRole, tag?: string): DriverResolution {
    const assignment = getModelAssignment(config, role, tag)
    const driver = drivers[assignment.backend]
    const model = assignment.model as ModelId

    return { driver, model, agent: assignment.agent }
  }

  async function checkAll(): Promise<Record<BackendName, DriverAvailability>> {
    const [claudeAvail, opencodeAvail] = await Promise.all([
      claudeDriver.checkAvailability(),
      openCodeDriver.checkAvailability(),
    ])

    return {
      claude: claudeAvail,
      opencode: opencodeAvail,
    }
  }

  return { getDriver, checkAll }
}
