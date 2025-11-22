import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateDyckWords,
  generateCatalanTrees,
  generateMotzkinWords,
  dyckToTree,
  renderTree,
  motzkinToTree,
  renderMotzkinTree,
  motzkinTreeToCatalanTree,
} from '../src/catalan/bijection.js';

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

test('Motzkin words round-trip through motzkinToTree/renderMotzkinTree for n = 0..5', () => {
  for (let n = 0; n <= 5; n += 1) {
    const motzkinWords = generateMotzkinWords(n);
    motzkinWords.forEach((word) => {
      const rendered = renderMotzkinTree(motzkinToTree(word));
      assert.equal(rendered, word, `Motzkin word failed round-trip at n=${n}`);
      const binary = renderTree(motzkinTreeToCatalanTree(motzkinToTree(word)));
      assert.doesNotThrow(
        () => {
          dyckToTree(binary);
        },
        `Motzkin → Catalan conversion produced invalid Dyck word at n=${n}`,
      );
    });
  }
});
