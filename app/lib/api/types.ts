import type { components, paths } from './schema'

/** Named schema from the generated OpenAPI document: Schema<'HealthDto'>. */
export type Schemas = components['schemas']
export type Schema<K extends keyof Schemas> = Schemas[K]

export type ApiPaths = paths
