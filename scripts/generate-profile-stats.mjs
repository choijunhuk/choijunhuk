import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const CARD_WIDTH = 495;
const CARD_HEIGHT = 195;
const USERNAME = process.env.PROFILE_USERNAME || "choijunhuk";
const OUTPUT_DIRECTORY = new URL("../assets/", import.meta.url);

const LANGUAGE_COLORS = {
  C: "#A8B9CC",
  "C++": "#00599C",
  CSS: "#1572B6",
  Dart: "#00B4AB",
  Go: "#00ADD8",
  HTML: "#E34F26",
  Java: "#B07219",
  JavaScript: "#F7DF1E",
  Kotlin: "#A97BFF",
  Python: "#3776AB",
  Rust: "#DEA584",
  Shell: "#89E051",
  Swift: "#F05138",
  TypeScript: "#3178C6",
};

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatNumber(value) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export async function retry(operation, options = {}) {
  const attempts = options.attempts ?? 3;
  const delay = options.delay ?? ((attempt) => new Promise((resolve) => setTimeout(resolve, attempt * 750)));

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === attempts) throw error;
      await delay(attempt);
    }
  }

  throw new Error("Retry attempts exhausted");
}

function cardShell(title, subtitle, body) {
  return `<svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <linearGradient id="card-bg" x1="16" y1="8" x2="480" y2="190" gradientUnits="userSpaceOnUse">
      <stop stop-color="#07111F"/>
      <stop offset="0.58" stop-color="#0B1F2E"/>
      <stop offset="1" stop-color="#07313A"/>
    </linearGradient>
    <linearGradient id="accent" x1="24" y1="0" x2="460" y2="0" gradientUnits="userSpaceOnUse">
      <stop stop-color="#36E4A2"/>
      <stop offset="1" stop-color="#37C8FF"/>
    </linearGradient>
    <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
      <path d="M28 0H0V28" stroke="#8EE8DB" stroke-opacity="0.05"/>
    </pattern>
  </defs>
  <rect x="1" y="1" width="493" height="193" rx="15" fill="url(#card-bg)" stroke="#284B5D"/>
  <rect x="1" y="1" width="493" height="193" rx="15" fill="url(#grid)"/>
  <rect x="22" y="20" width="5" height="5" rx="2.5" fill="#36E4A2"/>
  <text x="38" y="28" fill="#F3F8FA" font-family="Arial, sans-serif" font-size="15" font-weight="700">${escapeXml(title)}</text>
  <text x="472" y="28" fill="#7F9AA8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10" text-anchor="end">${escapeXml(subtitle)}</text>
  <path d="M22 42H473" stroke="#284B5D"/>
  ${body}
</svg>`;
}

export function summarizeStats(user, repositories) {
  const authoredRepositories = repositories.filter((repository) => !repository.fork);

  return {
    username: user.login,
    repositories: user.public_repos,
    stars: authoredRepositories.reduce((total, repository) => total + repository.stargazers_count, 0),
    forks: authoredRepositories.reduce((total, repository) => total + repository.forks_count, 0),
    followers: user.followers,
  };
}

export function summarizeLanguages(languageMaps) {
  const totals = new Map();

  for (const languages of languageMaps) {
    for (const [language, bytes] of Object.entries(languages)) {
      totals.set(language, (totals.get(language) || 0) + bytes);
    }
  }

  const topLanguages = [...totals]
    .map(([name, bytes]) => ({ name, bytes }))
    .sort((left, right) => right.bytes - left.bytes || left.name.localeCompare(right.name))
    .slice(0, 6);
  const topLanguageBytes = topLanguages.reduce((total, language) => total + language.bytes, 0);

  return topLanguages.map((language) => ({
    ...language,
    percentage: topLanguageBytes === 0 ? 0 : (language.bytes / topLanguageBytes) * 100,
  }));
}

export function renderStatsCard(stats) {
  const metrics = [
    ["REPOSITORIES", stats.repositories],
    ["TOTAL STARS", stats.stars],
    ["FORKS", stats.forks],
    ["FOLLOWERS", stats.followers],
  ];
  const body = metrics
    .map(([label, value], index) => {
      const x = 22 + index * 113;
      return `<g transform="translate(${x} 68)">
    <rect width="103" height="91" rx="11" fill="#0B1826" stroke="#214052"/>
    <text x="12" y="26" fill="#7F9AA8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="9">${label}</text>
    <text x="12" y="62" fill="#F3F8FA" font-family="Arial, sans-serif" font-size="26" font-weight="700">${formatNumber(value)}</text>
    <rect x="12" y="75" width="44" height="3" rx="1.5" fill="url(#accent)"/>
  </g>`;
    })
    .join("\n  ");

  return cardShell("GitHub Snapshot", `@${stats.username}`, body);
}

export function renderLanguageCard(languages) {
  let barX = 22;
  const bar = languages
    .map((language) => {
      const width = (451 * language.percentage) / 100;
      const segment = `<rect x="${barX.toFixed(2)}" y="58" width="${Math.max(width, 1).toFixed(2)}" height="10" fill="${LANGUAGE_COLORS[language.name] || "#36E4A2"}"/>`;
      barX += width;
      return segment;
    })
    .join("\n  ");
  const legend = languages
    .map((language, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = 22 + column * 235;
      const y = 96 + row * 28;
      const color = LANGUAGE_COLORS[language.name] || "#36E4A2";
      return `<g transform="translate(${x} ${y})">
    <circle cx="5" cy="-4" r="5" fill="${color}"/>
    <text x="17" y="0" fill="#DCE8EE" font-family="Arial, sans-serif" font-size="12" font-weight="600">${escapeXml(language.name)}</text>
    <text x="205" y="0" fill="#7F9AA8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11" text-anchor="end">${language.percentage.toFixed(1)}%</text>
  </g>`;
    })
    .join("\n  ");

  return cardShell("Top Languages", "PUBLIC SOURCE BYTES", `${bar}\n  ${legend}`);
}

async function fetchJson(path) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "choijunhuk-profile-stats",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return retry(async () => {
    const response = await fetch(`https://api.github.com${path}`, { headers });
    if (!response.ok) {
      throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
    }
    return response.json();
  });
}

async function fetchRepositories(username) {
  const repositories = [];
  const includePrivate = process.env.INCLUDE_PRIVATE === "true";

  for (let page = 1; ; page += 1) {
    const basePath = includePrivate
      ? "/user/repos?affiliation=owner&visibility=all"
      : `/users/${encodeURIComponent(username)}/repos?type=owner`;
    const pageItems = await fetchJson(`${basePath}&sort=updated&per_page=100&page=${page}`);
    repositories.push(...pageItems.filter((repository) => repository.owner.login === username));
    if (pageItems.length < 100) break;
  }

  return repositories;
}

async function generate() {
  const user = await fetchJson(`/users/${encodeURIComponent(USERNAME)}`);
  const repositories = await fetchRepositories(USERNAME);
  const authoredRepositories = repositories.filter((repository) => !repository.fork);
  const languageMaps = [];

  for (const repository of authoredRepositories) {
    languageMaps.push(await fetchJson(`/repos/${encodeURIComponent(USERNAME)}/${encodeURIComponent(repository.name)}/languages`));
  }

  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  await Promise.all([
    writeFile(new URL("github-stats.svg", OUTPUT_DIRECTORY), renderStatsCard(summarizeStats(user, repositories))),
    writeFile(new URL("top-langs.svg", OUTPUT_DIRECTORY), renderLanguageCard(summarizeLanguages(languageMaps))),
  ]);
  console.log(`Generated profile cards in ${fileURLToPath(OUTPUT_DIRECTORY)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await generate();
}
