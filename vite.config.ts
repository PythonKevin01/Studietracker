import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { defineConfig, type Plugin } from 'vitest/config';
import { leesCurriculum } from './src/curriculum/schema.ts';

const CURRICULUM_PAD = resolve(import.meta.dirname, 'curriculum/demo.yaml');
const VIRTUEEL = 'virtual:curriculum';

/**
 * Leest /curriculum/demo.yaml, controleert het tegen het schema en biedt het
 * aan als module 'virtual:curriculum'. Een fout in het curriculum breekt de build.
 */
function curriculumPlugin(): Plugin {
  const laad = () => leesCurriculum(parseYaml(readFileSync(CURRICULUM_PAD, 'utf8')));
  return {
    name: 'studietracker-curriculum',
    buildStart() {
      this.addWatchFile(CURRICULUM_PAD);
      laad();
    },
    resolveId(id) {
      return id === VIRTUEEL ? '\0' + VIRTUEEL : null;
    },
    load(id) {
      if (id !== '\0' + VIRTUEEL) return null;
      return `export default ${JSON.stringify(laad())};`;
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [curriculumPlugin()],
  test: { include: ['src/**/*.test.ts'] },
});
