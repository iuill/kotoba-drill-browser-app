// Bunのロック済み依存を含め、任意依存も公式レジストリで照合する。
const lock = JSON.parse(
  (await Bun.file("bun.lock").text()).replace(/,\s*([}\]])/g, "$1"),
);
const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
let newest = 0,
  count = 0;
const metadata = new Map<string, Promise<Record<string, string>>>();
for (const entry of Object.values(lock.packages) as [string, ...unknown[]][]) {
  const full = entry[0],
    at = full.lastIndexOf("@");
  const name = full.slice(0, at),
    version = full.slice(at + 1);
  if (!metadata.has(name))
    metadata.set(
      name,
      fetch(`https://registry.npmjs.org/${name}`).then(async (r) => {
        if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
        return (await r.json()).time;
      }),
    );
  const time = (await metadata.get(name)!)[version];
  const date = Date.parse(time);
  if (!Number.isFinite(date) || date > cutoff)
    throw new Error(`公開後14日未満または不明: ${full} (${time})`);
  newest = Math.max(newest, date);
  count++;
}
console.log(
  `${count}件の直接・間接・任意依存を照合。最新公開日時: ${new Date(newest).toISOString()}。例外なし。`,
);
