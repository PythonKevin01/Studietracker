import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { parse as parseYaml } from 'yaml';
import { defineConfig, type Plugin } from 'vitest/config';
import { leesCurriculum } from './src/curriculum/schema.ts';
import { leesPubliekeSleutels } from './src/bewijscode/sleutels.ts';

const wortel = import.meta.dirname;
const CURRICULUM_PAD = resolve(wortel, 'curriculum/demo.yaml');

/** Biedt een module aan onder een vaste naam, met inhoud die bij elke build opnieuw wordt gelezen. */
function virtueleModule(naam: string, bestanden: () => string[], maak: () => unknown): Plugin {
  const id = `virtual:${naam}`;
  return {
    name: `studietracker-${naam}`,
    buildStart() {
      for (const b of bestanden()) if (existsSync(b)) this.addWatchFile(b);
      maak(); // fouten breken de build meteen
    },
    resolveId: (bron) => (bron === id ? '\0' + id : null),
    load: (bron) => (bron === '\0' + id ? `export default ${JSON.stringify(maak())};` : null),
  };
}

/** /curriculum/demo.yaml, gecontroleerd tegen het schema. */
const curriculumPlugin = virtueleModule(
  'curriculum',
  () => [CURRICULUM_PAD],
  () => leesCurriculum(parseYaml(readFileSync(CURRICULUM_PAD, 'utf8'))),
);

/**
 * Publieke sleutels: keys/publieke-sleutels.json (in git), aangevuld met
 * keys/publieke-sleutels.lokaal.json (demo, buiten git) en het bestand uit
 * STUDIETRACKER_SLEUTELS (tests). Alleen publieke sleutels; nooit privé.
 */
const sleutelBestanden = () =>
  [
    resolve(wortel, 'keys/publieke-sleutels.json'),
    resolve(wortel, 'keys/publieke-sleutels.lokaal.json'),
    process.env.STUDIETRACKER_SLEUTELS ? resolve(process.env.STUDIETRACKER_SLEUTELS) : '',
  ].filter(Boolean);
const sleutelPlugin = virtueleModule('publieke-sleutels', sleutelBestanden, () =>
  leesPubliekeSleutels(
    ...sleutelBestanden()
      .filter((b) => existsSync(b))
      .map((b) => JSON.parse(readFileSync(b, 'utf8')) as unknown),
  ),
);

function bestandenIn(map: string): string[] {
  if (!existsSync(map)) return [];
  return readdirSync(map).flatMap((naam) => {
    const pad = join(map, naam);
    return statSync(pad).isDirectory() ? bestandenIn(pad) : [pad];
  });
}

/**
 * Schrijft sw.js: een service worker die alle bestanden van de build bewaart,
 * zodat de app daarna zonder internet werkt.
 */
function serviceWorkerPlugin(): Plugin {
  let publiekeMap = '';
  return {
    name: 'studietracker-service-worker',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      publiekeMap = config.publicDir;
    },
    generateBundle(_opties, bundel) {
      const bestanden = [
        ...Object.keys(bundel),
        ...bestandenIn(publiekeMap).map((b) => relative(publiekeMap, b).split('\\').join('/')),
      ]
        .filter((b) => !b.endsWith('.map'))
        .sort();
      const versie = createHash('sha256').update(JSON.stringify(bestanden)).update(
        Object.values(bundel)
          .map((b) => ('code' in b ? b.code : typeof b.source === 'string' ? b.source : String(b.source.length)))
          .join(''),
      );
      const bron = readFileSync(resolve(wortel, 'src/sw/sw.js'), 'utf8')
        .replace('__BESTANDEN__', JSON.stringify(bestanden))
        .replace('__VERSIE__', versie.digest('hex').slice(0, 12));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: bron });
    },
  };
}

/**
 * Bewaakt bij elke build dat de studentenpagina geen ondertekencode, geen
 * sleutelbestand-code en geen docentcode bevat. Faalt de build als dat wel zo is.
 */
function studentZonderOndertekenen(): Plugin {
  const verboden = [/src\/bewijscode\/ondertekenen\.ts$/, /src\/bewijscode\/sleutelbestand\.ts$/, /src\/docent\//];
  return {
    name: 'studietracker-student-zonder-ondertekenen',
    apply: 'build',
    generateBundle(_opties, bundel) {
      const chunks = Object.values(bundel).filter((b) => b.type === 'chunk');
      const start = chunks.find((c) => c.isEntry && c.name === 'student');
      if (!start) this.error('Controle mislukt: de ingang van de studentenpagina is niet gevonden in de build.');
      const bereikbaar = new Set<string>();
      const loop = (naam: string) => {
        if (bereikbaar.has(naam)) return;
        bereikbaar.add(naam);
        const c = chunks.find((x) => x.fileName === naam);
        for (const i of [...(c?.imports ?? []), ...(c?.dynamicImports ?? [])]) loop(i);
      };
      loop(start.fileName);
      const fout = chunks
        .filter((c) => bereikbaar.has(c.fileName))
        .flatMap((c) => c.moduleIds.map((m) => m.replace(/\\/g, '/')).filter((m) => verboden.some((v) => v.test(m))).map((m) => `${c.fileName}: ${m}`));
      if (fout.length) this.error(`De studentenpagina bevat code die alleen voor docenten is:\n${fout.join('\n')}`);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), curriculumPlugin, sleutelPlugin, serviceWorkerPlugin(), studentZonderOndertekenen()],
  build: {
    rollupOptions: {
      input: {
        start: resolve(wortel, 'index.html'),
        student: resolve(wortel, 'student/index.html'),
        docent: resolve(wortel, 'docent/index.html'),
      },
    },
  },
  test: { include: ['src/**/*.test.ts'] },
});
