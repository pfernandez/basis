import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateDyckWords,
  generateCatalanTrees,
  dyckToTree,
  renderTree,
} from '../src/bijection.js';

const sortStrings = (list) => [...list].sort();

test('Dyck words map bijectively to Catalan trees for n = 0..5', () => {
  for (let n = 0; n <= 5; n += 1) {
    const dyckWords = generateDyckWords(n);
    const treesFromDyck = dyckWords.map((word) => renderTree(dyckToTree(word)));

    assert.equal(
      new Set(treesFromDyck).size,
      dyckWords.length,
      `Dyck map is not injective for n=${n}`,
    );

    const catalanTrees = generateCatalanTrees(n);
    assert.deepEqual(
      sortStrings(treesFromDyck),
      sortStrings(catalanTrees),
      `Tree enumerations differ for n=${n}`,
    );
  }
});
