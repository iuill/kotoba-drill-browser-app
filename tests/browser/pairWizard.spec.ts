import { expect, test } from "@playwright/test";

test("2音の行・母音・順序を選び、出題例と図解を確認して保存する", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "練習へ進む", exact: true }).click();
  await page.getByRole("button", { name: "2音で練習", exact: true }).click();
  const wizard = page.getByRole("dialog", { name: "2音の練習を選ぶ" });
  await wizard.getByRole("button", { name: "か行", exact: true }).click();
  await wizard.getByRole("button", { name: "さ行", exact: true }).click();
  await wizard
    .getByRole("button", { name: "カスタマイズ：音を個別に選ぶ" })
    .click();
  for (const sound of ["し", "す", "せ", "そ"])
    await wizard.getByRole("button", { name: sound, exact: true }).click();
  await wizard.getByRole("button", { name: "次へ：母音と順序を選ぶ" }).click();
  const vowels = wizard.getByRole("group", { name: "つなげる母音" });
  for (const sound of ["あ", "い", "う", "え", "お"]) {
    const button = vowels.getByRole("button", { name: sound, exact: true });
    if ((await button.getAttribute("aria-pressed")) === "true")
      await button.click();
  }
  await expect(
    wizard.getByRole("button", { name: "次へ：発音のコツを見る" }),
  ).toBeDisabled();
  await vowels.getByRole("button", { name: "あ", exact: true }).click();
  await wizard.getByLabel("母音が先", { exact: true }).check();
  await expect(wizard.getByRole("status", { name: "出題の例" })).toHaveText(
    "出題の例（全1通り）あさ",
  );
  await wizard.getByLabel("母音が後", { exact: true }).check();
  await expect(wizard.getByRole("status", { name: "出題の例" })).toHaveText(
    "出題の例（全1通り）さあ",
  );
  await wizard.getByLabel("両方", { exact: true }).check();
  await expect(wizard.getByRole("status", { name: "出題の例" })).toContainText(
    "全2通り",
  );
  await wizard.getByLabel("母音が後", { exact: true }).check();
  await wizard.getByRole("button", { name: "次へ：発音のコツを見る" }).click();
  await expect(wizard.getByRole("button", { name: "1音目：あ" })).toBeVisible();
  await wizard.getByRole("button", { name: "2音目：さ" }).click();
  await expect(wizard.getByRole("img").first()).toHaveAccessibleName(
    /さの出だし/,
  );
  await wizard.getByRole("button", { name: "← 母音の選択に戻る" }).click();
  await expect(wizard.getByLabel("母音が後", { exact: true })).toBeChecked();
  await wizard.getByRole("button", { name: "← 音選びに戻る" }).click();
  await expect(
    wizard.getByRole("button", { name: "さ", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await wizard.getByRole("button", { name: "次へ：母音と順序を選ぶ" }).click();
  await wizard.getByRole("button", { name: "次へ：発音のコツを見る" }).click();
  await wizard.getByRole("button", { name: "この音で練習する" }).click();
  await expect(wizard).toBeHidden();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "2音で練習", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "2音で練習", exact: true }).click();
  await expect(
    wizard.getByRole("button", { name: "さ行", exact: true }),
  ).toHaveAttribute("aria-pressed", "mixed");
  await wizard.getByRole("button", { name: "次へ：母音と順序を選ぶ" }).click();
  await expect(wizard.getByLabel("母音が後", { exact: true })).toBeChecked();
  await expect(wizard.getByRole("status", { name: "出題の例" })).toHaveText(
    "出題の例（全1通り）さあ",
  );
  await wizard.getByLabel("母音が先", { exact: true }).check();
  await page.keyboard.press("Escape");
  await expect(wizard).toBeHidden();
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  await expect(page.getByLabel("母音の位置", { exact: true })).toHaveValue(
    "after",
  );
});
