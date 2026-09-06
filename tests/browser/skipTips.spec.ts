import { test, expect } from "@playwright/test";

for (const [mode, value, next] of [
  ["1音", "single", ""],
  ["2音", "pair", "次へ：母音と順序を選ぶ"],
  ["単語", "word", "次へ：単語を確認する"],
]) {
  test(`${mode}は発音のコツを省略して選択を保存できる`, async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "練習へ進む", exact: true }).click();
    await page
      .getByRole("button", { name: `${mode}で練習`, exact: true })
      .click();
    const wizard = page.getByRole("dialog", {
      name: `${mode}の練習を選ぶ`,
      exact: true,
    });
    const direct = wizard.getByRole("button", {
      name: "この音で練習する",
      exact: true,
    });
    if (next) await expect(direct).toHaveCount(0);
    await wizard.getByRole("button", { name: "か行", exact: true }).click();
    if (!next) await expect(direct).toBeDisabled();
    await wizard.getByRole("button", { name: "あ行", exact: true }).click();
    if (next)
      await wizard.getByRole("button", { name: next, exact: true }).click();
    await expect(
      wizard.getByRole("button", {
        name: "次へ：発音のコツを見る",
        exact: true,
      }),
    ).toBeVisible();
    await expect(direct).toBeEnabled();
    if (value === "word") {
      for (const name of ["語頭（はじめ）", "語中（なか）", "語尾（おわり）"])
        await wizard.getByLabel(name, { exact: true }).uncheck();
      await expect(direct).toBeDisabled();
      await wizard.getByLabel("語頭（はじめ）", { exact: true }).check();
    }
    await expect(wizard.getByRole("img")).toHaveCount(0);
    await direct.click();
    await expect(wizard).toBeHidden();
    await expect(
      page.getByRole("region", { name: "発音練習" }),
    ).toHaveAttribute("data-phase", "idle");
    await page.reload();
    await page.getByRole("button", { name: "設定・教材", exact: true }).click();
    await expect(page.getByLabel("練習の種類", { exact: true })).toHaveValue(
      value,
    );
    await expect(
      page.getByRole("button", { name: "あ", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: "か", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
  });
}
