import { expect, test } from "@playwright/test";

test("1音から行選択・個別指定・図解・適用へ進み、選択を再読み込み後も保持する", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "練習へ進む", exact: true }).click();
  await page.getByRole("button", { name: "1音で練習", exact: true }).click();
  const wizard = page.getByRole("dialog", { name: "1音の練習を選ぶ" });
  await expect(
    wizard.getByRole("button", { name: "か行", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await wizard.getByRole("button", { name: "か行", exact: true }).click();
  await expect(
    wizard.getByRole("button", { name: "次へ：発音のコツを見る" }),
  ).toBeDisabled();
  await wizard.getByRole("button", { name: "あ行", exact: true }).click();
  await wizard.getByRole("button", { name: "か行", exact: true }).click();
  await expect(wizard.getByRole("status")).toContainText("10音を選択中");
  await wizard
    .getByRole("button", { name: "カスタマイズ：音を個別に選ぶ" })
    .click();
  await wizard.getByRole("button", { name: "か", exact: true }).click();
  await wizard.getByRole("button", { name: "← 行ごとの選択に戻る" }).click();
  await expect(
    wizard.getByRole("button", { name: "か行", exact: true }),
  ).toHaveAttribute("aria-pressed", "mixed");
  await wizard.getByRole("button", { name: "次へ：発音のコツを見る" }).click();
  await expect(
    wizard.getByRole("heading", { name: "発音のコツ" }),
  ).toBeFocused();
  await expect(
    wizard.getByRole("button", { name: "1音目：あ" }),
  ).toHaveAttribute("aria-pressed", "true");
  await wizard.getByRole("button", { name: "6音目：き" }).click();
  await expect(wizard.getByRole("img").first()).toHaveAccessibleName(
    /きの出だし/,
  );
  await expect(
    wizard.getByRole("button", { name: "2. 「い」へつなぐ" }),
  ).toBeVisible();
  await wizard.getByRole("button", { name: "← 音選びに戻る" }).click();
  await expect(wizard.getByRole("status")).toContainText("9音を選択中");
  await wizard.getByRole("button", { name: "次へ：発音のコツを見る" }).click();
  await wizard.getByRole("button", { name: "この音で練習する" }).click();
  await expect(wizard).toBeHidden();
  await page.reload();
  await page.getByRole("button", { name: "1音で練習", exact: true }).click();
  await expect(wizard.getByRole("status")).toContainText("9音を選択中");
  await expect(
    wizard.getByRole("button", { name: "あ行", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    wizard.getByRole("button", { name: "か行", exact: true }),
  ).toHaveAttribute("aria-pressed", "mixed");
});

test("録音中の音選びは一時停止し、キャンセルではモードと対象音を変えない", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "練習へ進む", exact: true }).click();
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  await page.getByLabel("見本音声", { exact: true }).selectOption("off");
  await page.getByLabel("手動で録音開始・終了").check();
  await page.getByRole("button", { name: "設定を適用", exact: true }).click();
  await expect(page.getByRole("region", { name: "練習の設定" })).toBeHidden();
  await page.getByRole("button", { name: "2音で練習", exact: true }).click();
  const pairWizard = page.getByRole("dialog", { name: "2音の練習を選ぶ" });
  await pairWizard
    .getByRole("button", { name: "次へ：母音と順序を選ぶ" })
    .click();
  await pairWizard
    .getByRole("button", { name: "次へ：発音のコツを見る" })
    .click();
  await pairWizard.getByRole("button", { name: "この音で練習する" }).click();
  await expect(pairWizard).toBeHidden();
  await expect(
    page.getByRole("button", { name: "2音で練習", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "練習を始める", exact: true }).click();
  await page.getByRole("button", { name: "録音開始", exact: true }).click();
  const card = page.getByRole("region", { name: "発音練習", exact: true });
  await expect(card).toHaveAttribute("data-phase", "recording");
  const prompt = await card.locator("h1").innerText();
  await page.getByRole("button", { name: "1音で練習", exact: true }).click();
  const wizard = page.getByRole("dialog", { name: "1音の練習を選ぶ" });
  await expect(card).toHaveAttribute("data-phase", "paused");
  await wizard.getByRole("button", { name: "あ行", exact: true }).click();
  await wizard.getByRole("button", { name: "次へ：発音のコツを見る" }).click();
  expect(await wizard.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.keyboard.press("ArrowRight");
  await expect(card.locator("h1")).toHaveText(prompt);
  await page.keyboard.press("Escape");
  await expect(wizard).toBeHidden();
  await expect(
    page.getByRole("button", { name: "1音で練習", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "2音で練習", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(card).toHaveAttribute("data-phase", "paused");
  await page.getByRole("button", { name: "1音で練習", exact: true }).click();
  await expect(
    wizard.getByRole("button", { name: "あ行", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    wizard.getByRole("button", { name: "か行", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
