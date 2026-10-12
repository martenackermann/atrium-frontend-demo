import type { components, operations, paths } from './schema'

/** Named schema from the OpenAPI document: Schema<'TrainingRequest'>. */
export type Schemas = components['schemas']
export type Schema<K extends keyof Schemas> = Schemas[K]

export type ApiPaths = paths
export type ApiOperations = operations
