import { test, expect } from "@playwright/test";

test("練習画面でモードを知り、録音中に切り替え、同じお題のまま声を変更できる", async ({
  page,
}) => {
  await page.goto("/");
  const choices = page.getByRole("region", { name: "練習の選び方" });
  await expect(
    choices.getByRole("button", { name: "1音で練習", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(choices.getByText("選んだ音＋母音を、つなげて")).toBeVisible();
  await expect(choices.getByText("身近なことばで練習")).toBeVisible();
  await page.getByRole("button", { name: "練習へ進む", exact: true }).click();
  await choices.getByRole("button", { name: "対象音・教材を調整" }).click();
  await page.getByLabel("手動で録音開始・終了").check();
  await page.getByLabel("見本音声", { exact: true }).selectOption("off");
  await page.getByRole("button", { name: "設定を適用", exact: true }).click();
  await expect(choices).toBeVisible();
  await choices.getByRole("button", { name: "2音で練習", exact: true }).click();
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
    choices.getByRole("button", { name: "2音で練習", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "練習を始める", exact: true }).click();
  await page.getByRole("button", { name: "録音開始", exact: true }).click();
  const card = page.getByRole("region", { name: "発音練習", exact: true });
  await expect(card).toHaveAttribute("data-phase", "recording");
  await choices
    .getByRole("button", { name: "単語で練習", exact: true })
    .click();
  const wordWizard = page.getByRole("dialog", { name: "単語の練習を選ぶ" });
  await wordWizard
    .getByRole("button", { name: "次へ：単語を確認する" })
    .click();
  await wordWizard
    .getByRole("button", { name: "次へ：発音のコツを見る" })
    .click();
  await wordWizard.getByRole("button", { name: "この音で練習する" }).click();
  await expect(wordWizard).toBeHidden();
  await expect(
    choices.getByRole("button", { name: "単語で練習", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(card).toHaveAttribute("data-phase", "paused");
  await expect(
    page.getByText("発声すると、ここにお題と聞き取り結果が並びます。"),
  ).toBeVisible();
  const prompt = await card.locator("h1").textContent();
  await choices.getByRole("button", { name: /見本の声・速さ/ }).click();
  const dialog = page.getByRole("dialog", { name: "見本の声と速さ" });
  await dialog
    .getByLabel("日本語の声", { exact: true })
    .selectOption("voicevox-tsumugi");
  await dialog.getByLabel("読み上げ速度", { exact: true }).fill("1.1");
  await dialog
    .getByRole("button", { name: "この設定で使う", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(card.locator("h1")).toHaveText(prompt!);
  await expect(card).toHaveAttribute("data-phase", "paused");
  await expect(
    choices.getByRole("button", { name: /見本の声・速さ/ }),
  ).toContainText("春日部つむぎ");
  await page.reload();
  await expect(
    choices.getByRole("button", { name: "単語で練習", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    choices.getByRole("button", { name: /見本の声・速さ/ }),
  ).toContainText("1.10倍");
});
