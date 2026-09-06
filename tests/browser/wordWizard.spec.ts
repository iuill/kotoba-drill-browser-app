import { expect, test } from "@playwright/test";

test("単語も行から選び、追加教材と音の位置を反映した候補・図解を確認して保存する", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "練習へ進む", exact: true }).click();
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  await page.getByLabel("表記", { exact: true }).fill("あぴゅあ");
  await page.getByLabel("読み（ひらがな）").fill("あぴゅあ");
  await page.getByRole("button", { name: "単語を追加", exact: true }).click();
  await page.getByRole("button", { name: "設定を適用", exact: true }).click();
  await expect(page.getByRole("region", { name: "練習の設定" })).toBeHidden();
  await page.getByRole("button", { name: "単語で練習", exact: true }).click();
  const wizard = page.getByRole("dialog", { name: "単語の練習を選ぶ" });
  await expect(
    wizard.getByRole("button", { name: "か行", exact: true }),
  ).toContainText(/単語 \d+件/);
  await wizard
    .getByRole("button", { name: "カスタマイズ：音を個別に選ぶ" })
    .click();
  for (const sound of ["か", "き", "く", "け", "こ", "ぴゅ"])
    await wizard.getByRole("button", { name: sound, exact: true }).click();
  await wizard.getByRole("button", { name: "次へ：単語を確認する" }).click();
  await wizard.getByLabel("語頭（はじめ）", { exact: true }).uncheck();
  await wizard.getByLabel("語尾（おわり）", { exact: true }).uncheck();
  await expect(
    wizard.locator("li").filter({ hasText: "あぴゅあ" }),
  ).toBeVisible();
  await wizard.getByLabel("語中（なか）", { exact: true }).uncheck();
  await expect(wizard.getByRole("status", { name: "単語の例" })).toContainText(
    "この条件の単語がありません",
  );
  await expect(
    wizard.getByRole("button", { name: "次へ：発音のコツを見る" }),
  ).toBeDisabled();
  await wizard.getByLabel("語中（なか）", { exact: true }).check();
  await wizard.getByRole("button", { name: "次へ：発音のコツを見る" }).click();
  await expect(wizard.getByRole("img").first()).toHaveAccessibleName(
    /ぴゅの出だし/,
  );
  await wizard.getByRole("button", { name: "← 単語の確認に戻る" }).click();
  await expect(
    wizard.getByLabel("語中（なか）", { exact: true }),
  ).toBeChecked();
  await wizard.getByRole("button", { name: "次へ：発音のコツを見る" }).click();
  await wizard.getByRole("button", { name: "この音で練習する" }).click();
  await expect(wizard).toBeHidden();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "単語で練習", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "単語で練習", exact: true }).click();
  await expect(
    wizard.getByRole("button", { name: "ぴゃ・ぴゅ・ぴょ", exact: true }),
  ).toHaveAttribute("aria-pressed", "mixed");
  await wizard.getByRole("button", { name: "次へ：単語を確認する" }).click();
  await expect(
    wizard.getByLabel("語中（なか）", { exact: true }),
  ).toBeChecked();
  await expect(
    wizard.getByLabel("語頭（はじめ）", { exact: true }),
  ).not.toBeChecked();
  await wizard.getByLabel("語頭（はじめ）", { exact: true }).check();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "単語で練習", exact: true }).click();
  await wizard.getByRole("button", { name: "次へ：単語を確認する" }).click();
  await expect(
    wizard.getByLabel("語頭（はじめ）", { exact: true }),
  ).not.toBeChecked();
});
