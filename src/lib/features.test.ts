import { describe, it, expect } from 'vitest'
import { features, type Feature } from './features'

describe('features module', () => {
  // Tracer bullet: the module exports a features array with the correct count
  it('exports a features array with exactly 3 items', () => {
    expect(features).toBeInstanceOf(Array)
    expect(features).toHaveLength(3)
  })

  describe('feature shape validation', () => {
    it('every feature has non-empty icon, title, and description', () => {
      for (const feature of features) {
        expect(feature.icon).toBeTruthy()
        expect(typeof feature.icon).toBe('string')
        expect(feature.icon.length).toBeGreaterThan(0)

        expect(feature.title).toBeTruthy()
        expect(typeof feature.title).toBe('string')
        expect(feature.title.length).toBeGreaterThan(0)

        expect(feature.description).toBeTruthy()
        expect(typeof feature.description).toBe('string')
        expect(feature.description.length).toBeGreaterThan(0)
      }
    })
  })

  describe('feature data matches spec', () => {
    it('first feature is Fast with rocket emoji', () => {
      expect(features[0]).toEqual({
        icon: '\u{1F680}',
        title: 'Fast',
        description: 'Blazing fast build pipeline.',
      })
    })

    it('second feature is Parallel with lightning emoji', () => {
      expect(features[1]).toEqual({
        icon: '\u26A1',
        title: 'Parallel',
        description: 'Agents work in parallel for maximum throughput.',
      })
    })

    it('third feature is Safe with shield emoji', () => {
      expect(features[2]).toEqual({
        icon: '\u{1F6E1}\uFE0F',
        title: 'Safe',
        description: 'Mandatory security review on every iteration.',
      })
    })
  })

  describe('type export', () => {
    it('Feature type matches the expected shape', () => {
      // Verify the shape is correct by asserting on a known item
      const feature: Feature = features[0]

      expect(feature).toEqual(
        expect.objectContaining({
          icon: expect.any(String),
          title: expect.any(String),
          description: expect.any(String),
        }),
      )
    })
  })
})
