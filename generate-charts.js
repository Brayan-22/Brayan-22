const { Octokit } = require("@octokit/rest");
const fs = require("fs");

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const USERNAME = "Brayan-22";

async function getAllRepos() {
  const repos = await octokit.paginate(octokit.rest.repos.listForUser, {
    username: USERNAME,
    per_page: 100,
    type: "owner"
  });
  return repos.map(r => r.name);
}

async function getMonthlyCommits() {
  const now = new Date();
  const months = [];
  const data = new Array(12).fill(0);

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toLocaleString("es", { month: "short" }));
  }

  const repos = await getAllRepos();

  for (const repo of repos) {
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const since = d.toISOString();
      const until = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();

      try {
        const { data: commits } = await octokit.rest.repos.listCommits({
          owner: USERNAME,
          repo,
          since,
          until,
          per_page: 100,
          author: USERNAME
        });
        data[i] += commits.length;
      } catch (e) {
        // repo vacio o sin permisos, ignorar
      }

      await new Promise(r => setTimeout(r, 200));
    }
  }

  return { months, data };
}

async function generateSVG({ months, data }) {
  const W = 800, H = 200, PL = 40, PR = 20, PT = 20, PB = 30;
  const max = Math.max(...data) || 1;
  const xs = months.map((_, i) => PL + (i / (months.length - 1)) * (W - PL - PR));
  const ys = data.map(v => PT + (1 - v / max) * (H - PT - PB));

  const polyline = xs.map((x, i) => `${Math.round(x)},${Math.round(ys[i])}`).join(" ");
  const area = `${Math.round(xs[0])},${H - PB} ` + polyline + ` ${Math.round(xs[xs.length - 1])},${H - PB}`;

  const dots = xs.map((x, i) =>
    `<circle cx="${Math.round(x)}" cy="${Math.round(ys[i])}" r="4" fill="#7F77DD" stroke="#fff" stroke-width="1.5"/>`
  ).join("\n");

  const xlabels = months.map((m, i) =>
    `<text x="${Math.round(xs[i])}" y="${H}" text-anchor="middle" font-size="11" fill="#888">${m}</text>`
  ).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <polygon points="${area}" fill="rgba(127,119,221,0.1)"/>
  <polyline points="${polyline}" fill="none" stroke="#7F77DD" stroke-width="2.5" stroke-linejoin="round"/>
  ${dots}
  ${xlabels}
</svg>`;
}

(async () => {
  const chartData = await getMonthlyCommits();
  const svg = await generateSVG(chartData);
  fs.writeFileSync("commits-chart.svg", svg);
  console.log("Chart generated!");
})();