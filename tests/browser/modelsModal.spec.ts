import { expect, test } from "@playwright/test";

test("モデル管理をポップアップで開き、対象キャッシュだけ削除して元へ戻れる", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const cache = await caches.open("kotoba-models-v1");
    for (const model of ["tiny", "base"]) {
      await cache.put(
        `https://huggingface.co/onnx-community/whisper-${model}/resolve/test/model.onnx`,
        new Response(new Uint8Array(1024 * 1024)),
      );
    }
  });
  const opener = page.getByRole("button", { name: "モデル管理", exact: true });
  const scrollY = await page.evaluate(() => window.scrollY);
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "モデル管理", exact: true });
  const close = dialog.getByRole("button", { name: "閉じる", exact: true });
  await expect(dialog).toBeVisible();
  await expect(close).toBeFocused();
  await expect(page.locator("#root")).toHaveJSProperty("inert", true);
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("button", { name: "キャッシュを削除" }).last(),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  const tiny = dialog
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { name: "Whisper Tiny", exact: true }),
    });
  const base = dialog
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { name: "Whisper Base", exact: true }),
    });
  await expect(tiny).toContainText("保存済み 1.0MB");
  await tiny.getByRole("button", { name: "キャッシュを削除" }).click();
  await expect(dialog.getByRole("status")).toHaveText(
    "Whisper Tinyのキャッシュを削除しました。",
  );
  await expect(tiny).toContainText("保存済み 0.0MB");
  await expect(base).toContainText("保存済み 1.0MB");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  await expect(page.locator("#root")).toHaveJSProperty("inert", false);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
  await page.setViewportSize({ width: 390, height: 844 });
  await opener.click();
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await close.click();
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});
