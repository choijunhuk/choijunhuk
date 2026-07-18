import assert from "node:assert/strict";
import test from "node:test";

import {
  renderLanguageCard,
  renderStatsCard,
  retry,
  summarizeLanguages,
  summarizeStats,
} from "./generate-profile-stats.mjs";

test("retry recovers from a transient operation failure", async () => {
  let attempts = 0;

  const result = await retry(
    async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("temporary network failure");
      return "ok";
    },
    { attempts: 3, delay: async () => {} },
  );

  assert.equal(result, "ok");
  assert.equal(attempts, 3);
});

test("summarizeStats excludes forks from authored project totals", () => {
  const user = {
    login: "megasonics",
    public_repos: 7,
    followers: 12,
  };
  const repositories = [
    { fork: false, stargazers_count: 5, forks_count: 2 },
    { fork: false, stargazers_count: 3, forks_count: 1 },
    { fork: true, stargazers_count: 100, forks_count: 50 },
  ];

  assert.deepEqual(summarizeStats(user, repositories), {
    username: "megasonics",
    repositories: 7,
    stars: 8,
    forks: 3,
    followers: 12,
  });
});

test("summarizeLanguages aggregates bytes and keeps the six largest languages", () => {
  const languages = summarizeLanguages([
    { TypeScript: 600, JavaScript: 200, CSS: 100 },
    { TypeScript: 400, Kotlin: 300, Rust: 250, Python: 150, C: 100 },
  ]);

  assert.deepEqual(
    languages.map(({ name, bytes }) => ({ name, bytes })),
    [
      { name: "TypeScript", bytes: 1000 },
      { name: "Kotlin", bytes: 300 },
      { name: "Rust", bytes: 250 },
      { name: "JavaScript", bytes: 200 },
      { name: "Python", bytes: 150 },
      { name: "C", bytes: 100 },
    ],
  );
  assert.equal(
    Math.round(languages.reduce((sum, language) => sum + language.percentage, 0)),
    100,
  );
});

test("rendered cards contain readable labels and escape dynamic text", () => {
  const statsCard = renderStatsCard({
    username: "<megasonics>",
    repositories: 7,
    stars: 8,
    forks: 3,
    followers: 12,
  });
  const languageCard = renderLanguageCard([
    { name: "TypeScript", bytes: 1000, percentage: 80 },
    { name: "Rust & C", bytes: 250, percentage: 20 },
  ]);

  assert.match(statsCard, /GitHub Snapshot/);
  assert.match(statsCard, /&lt;megasonics&gt;/);
  assert.doesNotMatch(statsCard, /<megasonics>/);
  assert.match(languageCard, /Top Languages/);
  assert.match(languageCard, /Rust &amp; C/);
});
