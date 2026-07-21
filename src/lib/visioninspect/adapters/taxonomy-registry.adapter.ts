/**
 * taxonomy-registry.adapter.ts
 * Implements KnowledgeRegistryPort by reading knowledge/visioninspect/taxonomy.json.
 * This is the ONLY file in the codebase that knows the taxonomy lives on disk as JSON —
 * taxonomy.ts (the domain layer) only knows the Taxonomy TypeScript shape.
 *
 * Caches the parsed, validated taxonomy in memory after first load, since it changes
 * only when a maintainer edits the file and redeploys, not per-request.
 */
import { readFile } from 'fs/promises';
import { join } from 'path';
import { TaxonomySchema, type Taxonomy } from '../taxonomy';
import type { KnowledgeRegistryPort } from '../ports/knowledge-registry.port';

const TAXONOMY_PATH = join(process.cwd(), 'knowledge', 'visioninspect', 'taxonomy.json');

export class TaxonomyRegistryAdapter implements KnowledgeRegistryPort {
  private cached: Taxonomy | null = null;

  async getTaxonomy(): Promise<Taxonomy> {
    if (this.cached) return this.cached;

    let raw: string;
    try {
      raw = await readFile(TAXONOMY_PATH, 'utf-8');
    } catch (cause) {
      throw new Error(
        `Could not read the approved taxonomy at ${TAXONOMY_PATH}. This file is required ` +
          `for the application to route any defect — see knowledge/visioninspect/taxonomy.json.`,
        { cause },
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch (cause) {
      throw new Error(`The taxonomy file at ${TAXONOMY_PATH} is not valid JSON.`, { cause });
    }

    const validated = TaxonomySchema.safeParse(parsedJson);
    if (!validated.success) {
      throw new Error(
        `The taxonomy file at ${TAXONOMY_PATH} does not match the expected schema: ` +
          `${validated.error.message}`,
      );
    }

    this.cached = validated.data;
    return this.cached;
  }
}
