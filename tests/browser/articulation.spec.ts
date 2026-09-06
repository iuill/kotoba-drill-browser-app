import { expect, test } from "@playwright/test";

test("発音のコツで録音を中断し、図の切り替えとキーボード操作後も同じお題から再開する", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "練習へ進む", exact: true }).click();
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  await page.getByLabel("見本音声", { exact: true }).selectOption("off");
  await page.getByLabel("手動で録音開始・終了").check();
  await page.getByRole("button", { name: "設定を適用", exact: true }).click();
  await expect(page.getByRole("region", { name: "練習の設定" })).toBeHidden();
  await page.getByRole("button", { name: "練習を始める", exact: true }).click();
  await page.getByRole("button", { name: "録音開始", exact: true }).click();
  const card = page.getByRole("region", { name: "発音練習", exact: true });
  await expect(card).toHaveAttribute("data-phase", "recording");
  const prompt = await card.locator("h1").innerText();
  await page.getByRole("button", { name: "発音のコツ", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "発音のコツ", exact: true });
  await expect(card).toHaveAttribute("data-phase", "paused");
  await expect(dialog.getByRole("img").first()).toHaveAccessibleName(
    new RegExp(prompt),
  );
  await dialog.getByRole("button", { name: /2. .*へつなぐ/ }).click();
  await expect(dialog.getByRole("img").first()).toHaveAccessibleName(/母音/);
  const picker = dialog.getByLabel("練習対象の音", { exact: true });
  await expect(picker).toHaveValue(prompt);
  await expect(picker.locator("option:not([disabled])")).toHaveText([
    "か",
    "き",
    "く",
    "け",
    "こ",
  ]);
  const other = prompt === "こ" ? "か" : "こ";
  await picker.selectOption(other);
  await expect(dialog.getByRole("img").first()).toHaveAccessibleName(
    new RegExp(`${other}の出だし`),
  );
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("r");
  await expect(card.locator("h1")).toHaveText(prompt);
  await expect(
    card.getByRole("button", { name: "繰り返し オフ", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: "発音のコツ", exact: true }),
  ).toBeFocused();
  await expect(card).toHaveAttribute("data-phase", "paused");
  await page.getByRole("button", { name: "発音のコツ", exact: true }).click();
  await expect(picker).toHaveValue(prompt);
  await page.keyboard.press("Escape");
  await expect(
    page.getByText("発声すると、ここにお題と聞き取り結果が並びます。"),
  ).toBeVisible();
  await page.getByRole("button", { name: "再開", exact: true }).click();
  await expect(card).toHaveAttribute("data-phase", "waiting");
  await expect(card.locator("h1")).toHaveText(prompt);
});

test("単語の拗音・撥音を選べて、文脈依存の音は説明で案内する", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "練習へ進む", exact: true }).click();
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  await page.getByLabel("練習の種類").selectOption("word");
  for (const sound of ["か", "き", "く", "け", "こ", "しゃ"]) {
    await page.getByRole("button", { name: sound, exact: true }).click();
  }
  await page.getByLabel("ランダムに出題（一巡するまで重複なし）").uncheck();
  await page.getByLabel("見本音声", { exact: true }).selectOption("off");
  await page.getByLabel("手動で録音開始・終了").check();
  await page.getByRole("button", { name: "設定を適用", exact: true }).click();
  await expect(page.getByRole("region", { name: "練習の設定" })).toBeHidden();
  await page.getByRole("button", { name: "練習を始める", exact: true }).click();
  await page.getByRole("button", { name: "発音のコツ", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "発音のコツ" });
  await expect(
    dialog.getByRole("button", { name: "1音目：しゃ" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByRole("img").first()).toHaveAccessibleName(/しゃ/);
  await dialog.getByRole("button", { name: "3音目：ん" }).click();
  await expect(dialog.getByLabel("練習対象の音", { exact: true })).toHaveValue(
    "",
  );
  await expect(dialog.getByText(/次の音に合わせて変わります/)).toBeVisible();
  await expect(dialog.getByRole("img")).toHaveCount(0);
  await dialog.getByRole("button", { name: "2音目：し" }).click();
  await expect(dialog.getByRole("img").first()).toHaveAccessibleName(
    /しの出だし/,
  );
  await dialog.getByLabel("練習対象の音", { exact: true }).selectOption("しゃ");
  await expect(
    dialog.getByRole("button", { name: "1音目：しゃ" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByRole("img").first()).toHaveAccessibleName(
    /しゃの出だし/,
  );
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await dialog.getByRole("button", { name: "発音のコツを閉じる" }).click();
});

test("単語の図解はお題に含まれる練習対象音から開く", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "練習へ進む", exact: true }).click();
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  await page.getByLabel("練習の種類").selectOption("word");
  await page.getByLabel("ランダムに出題（一巡するまで重複なし）").uncheck();
  await page.getByLabel("見本音声", { exact: true }).selectOption("off");
  await page.getByLabel("手動で録音開始・終了").check();
  await page.getByRole("button", { name: "設定を適用", exact: true }).click();
  await page.getByRole("button", { name: "練習を始める", exact: true }).click();
  const card = page.getByRole("region", { name: "発音練習", exact: true });
  await expect(card).toHaveAttribute("data-phase", "waiting");
  await page.getByRole("button", { name: "次へ →", exact: true }).click();
  await page.getByRole("button", { name: "次へ →", exact: true }).click();
  await expect(card.locator("h1")).toHaveText("つくえ");
  await page.getByRole("button", { name: "発音のコツ", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "発音のコツ", exact: true });
  await expect(
    dialog.getByRole("button", { name: "2音目：く", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByRole("img").first()).toHaveAccessibleName(
    /くの出だし/,
  );
});
