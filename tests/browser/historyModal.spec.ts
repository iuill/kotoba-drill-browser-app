import { expect, test } from "@playwright/test";

test("履歴をポップアップで開き、絞り込み中も背景を操作せず元へ戻れる", async ({
  page,
}) => {
  await page.goto("/");
  const opener = page.getByRole("button", { name: "履歴", exact: true });
  const scrollY = await page.evaluate(() => window.scrollY);
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "履歴", exact: true });
  const close = dialog.getByRole("button", { name: "閉じる", exact: true });
  await expect(close).toBeFocused();
  await expect(page.locator("#root")).toHaveJSProperty("inert", true);
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByLabel("バックアップを読み込む")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await dialog.getByLabel("お題で絞り込み").fill("かさ R");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".practice-card")).toHaveAttribute(
    "data-phase",
    "idle",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  await expect(page.locator("#root")).toHaveJSProperty("inert", false);
  await page.setViewportSize({ width: 1280, height: 720 });
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
  await opener.click();
  await close.click();
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});
