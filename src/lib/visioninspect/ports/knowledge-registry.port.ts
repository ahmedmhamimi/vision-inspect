/**
 * knowledge-registry.port.ts
 * Outbound port: how the application obtains the approved taxonomy, without the domain
 * layer knowing it currently lives in a JSON file on disk.
 *
 * Owned by: Ali (Knowledge, Tools & Quality Engineer) — she also owns the
 * implementing adapter (taxonomy-registry.adapter.ts) and the taxonomy data itself
 * (knowledge/visioninspect/taxonomy.json).
 *
 * Swapping the taxonomy source later (e.g. to a database or an admin-editable store)
 * requires a new adapter and one line in composition-root.ts — nothing in taxonomy.ts,
 * tool-rules.ts, or service.ts changes.
 */
import type { Taxonomy } from '../taxonomy';

export interface KnowledgeRegistryPort {
  /** Returns the current approved taxonomy. Adapters are responsible for validating the
   *  data against TaxonomySchema before returning it — the domain layer trusts that
   *  anything returned here is already schema-valid. */
  getTaxonomy(): Promise<Taxonomy>;
}
