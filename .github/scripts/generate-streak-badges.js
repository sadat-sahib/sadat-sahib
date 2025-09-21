const fs = require('fs');
const https = require('https');

const username = process.argv[2];
if (!username) {
  console.error('Usage: node generate-streak-badges.js <github-username>');
  process.exit(1);
}

const profileUrl = `https://github.com/${username}`;

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'node.js' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

function parseContribCalendar(html) {
  const re = /<rect[^>]*data-date="([^"]+)"[^>]*data-count="([^"]+)"[^>]*>/g;
  const days = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    days.push({ date: m[1], count: parseInt(m[2], 10) });
  }
  return days.sort((a, b) => new Date(a.date) - new Date(b.date));
}

function computeStreaks(days) {
  if (!days.length) return { current: 0, longest: 0 };
  const map = new Map(days.map(d => [d.date, d.count]));
  const dayMs = 24 * 60 * 60 * 1000;
  const latest = days[days.length - 1].date;

  // Current streak
  let current = 0;
  let date = new Date(latest);
  while (true) {
    const iso = date.toISOString().slice(0, 10);
    if ((map.get(iso) || 0) > 0) current++;
    else break;
    date = new Date(date.getTime() - dayMs);
  }

  // Longest streak
  let longest = 0, run = 0;
  for (const d of days) {
    if ((d.count || 0) > 0) run++;
    else run = 0;
    if (run > longest) longest = run;
  }

  return { current, longest };
}

function makeSvg(text, label) {
  const width = Math.max(160, 12 * text.length + 80);
  const height = 28;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect rx="4" width="100%" height="100%" fill="#0f172a"/>
  <text x="12" y="18" font-family="Segoe UI,Roboto,Helvetica,Arial,sans-serif" font-size="12" fill="#9ca3af">${label}:</text>
  <text x="${12 + (label.length + 2) * 6}" y="18" font-family="Segoe UI,Roboto,Helvetica,Arial,sans-serif" font-size="12" fill="#38bdf8">${text}</text>
</svg>`;
}

(async () => {
  try {
    const res = await fetch(profileUrl);
    if (res.status !== 200) throw new Error('Failed to fetch profile');

    const days = parseContribCalendar(res.body);
    if (!days.length) throw new Error('No contributions found');

    const { current, longest } = computeStreaks(days);

    const outDir = '.github/streaks';
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    fs.writeFileSync(`${outDir}/current-streak.svg`, makeSvg(String(current), 'Current streak'), 'utf8');
    fs.writeFileSync(`${outDir}/longest-streak.svg`, makeSvg(String(longest), 'Longest streak'), 'utf8');

    console.log('Streak badges generated successfully.');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
