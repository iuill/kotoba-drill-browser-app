import { expect, test } from "@playwright/test";

for (const width of [1280, 390]) {
  test(`練習の案内とお題が変わっても操作位置を保つ（${width}px）`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await page.getByRole("button", { name: "練習へ進む", exact: true }).click();
    await page.getByRole("button", { name: "設定・教材", exact: true }).click();
    await page.getByLabel("手動で録音開始・終了").check();
    await page.getByLabel("見本音声", { exact: true }).selectOption("off");
    await page.getByRole("button", { name: "設定を適用", exact: true }).click();
    const card = page.getByRole("region", { name: "発音練習", exact: true });
    const top = () =>
      card
        .locator(":scope > .controls")
        .evaluate(
          (el) =>
            el.getBoundingClientRect().top -
            el.parentElement!.getBoundingClientRect().top,
        );
    const positions = [await top()];
    await page
      .getByRole("button", { name: "練習を始める", exact: true })
      .click();
    await expect(card).toHaveAttribute("data-phase", "waiting");
    positions.push(await top());
    await page.getByRole("button", { name: "録音開始", exact: true }).click();
    await expect(card).toHaveAttribute("data-phase", "recording");
    positions.push(await top());
    await page.getByRole("button", { name: "一時停止", exact: true }).click();
    await expect(card).toHaveAttribute("data-phase", "paused");
    positions.push(await top());
    // 表記の有無・長い読み・未収録音声の案内も同じ領域に収める。
    await page.evaluate(async () => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("kotoba-drill", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("preferences", "readwrite");
          const store = tx.objectStore("preferences");
          const current = store.get("current");
          current.onsuccess = () => {
            const prefs = current.result;
            Object.assign(prefs.settings, {
              kind: "word",
              sounds: ["ぴゅ"],
              positions: ["start"],
              random: false,
              sample: "manual",
            });
            prefs.words = [
              { id: "layout-short", text: "ぴゅ", reading: "ぴゅ" },
              {
                id: "layout-long",
                text: "長いお題の表示確認",
                reading: "ぴゅあいうえおかきくけこさしすせそ",
              },
            ];
            store.put(prefs, "current");
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
      });
    });
    await page.reload();
    await page
      .getByRole("button", { name: "練習を始める", exact: true })
      .click();
    await expect(card).toHaveAttribute("data-phase", "waiting");
    for (
      let i = 0;
      i < 10 && (await card.locator("h1").textContent()) !== "ぴゅ";
      i++
    ) {
      positions.push(await top());
      await page.getByRole("button", { name: "次へ →", exact: true }).click();
      await expect(card).toHaveAttribute("data-phase", "waiting");
    }
    await expect(card.locator("h1")).toHaveText("ぴゅ");
    positions.push(await top());
    await page.getByRole("button", { name: "次へ →", exact: true }).click();
    await expect(card.locator("h1")).toHaveText(
      "ぴゅあいうえおかきくけこさしすせそ",
    );
    await expect(card).toHaveAttribute("data-phase", "waiting");
    positions.push(await top());
    expect(
      await card
        .locator("h1")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    expect(Math.max(...positions) - Math.min(...positions)).toBeLessThan(2);
  });
}
