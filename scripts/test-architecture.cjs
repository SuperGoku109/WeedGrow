const assert = require('node:assert/strict');
const { ESLint } = require('eslint');
(async () => {
  const eslint = new ESLint();
  const cases = [
    ['features/plants/components/BoundaryProbe.tsx', "import { getDocs } from 'firebase/firestore';", true],
    ['features/plants/hooks/useBoundaryProbe.ts', "import { db } from '@/services/firebase';", true],
    ['services/boundaryProbe.ts', "import { usePlant } from '@/features/plants/hooks/usePlant';", true],
    ['lib/suggestions/wateringEngine.ts', "import { fetchWeather } from '@/lib/weather/fetchWeather';", true],
    ['features/plants/components/BoundaryProbe.tsx', "import { fetchJournalPage } from '@/lib/logs/journalQueries';", false],
  ];
  for (const [filePath, source, blocked] of cases) {
    const [result] = await eslint.lintText(source, { filePath });
    assert.equal(result.messages.some(message => message.ruleId === 'no-restricted-imports'), blocked, `Boundary policy for ${filePath}`);
  }
  console.log('PASS: UI/query, hook/query, service/presentation and domain/I-O boundaries are enforced; repository APIs remain allowed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
