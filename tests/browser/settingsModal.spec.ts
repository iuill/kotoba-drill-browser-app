import { expect, test } from "@playwright/test";

test("設定をポップアップで開き、初期化確認を閉じても背景を操作せず元へ戻れる", async ({
  page,
}) => {
  await page.goto("/");
  const opener = page.getByRole("button", { name: "設定・教材", exact: true });
  await opener.click();
  const settings = page.getByRole("dialog", {
    name: "設定・教材",
    exact: true,
  });
  await expect(settings).toBeVisible();
  await expect(
    settings.getByLabel("音声認識の方式", { exact: true }),
  ).toHaveValue("browser");
  await expect(settings.getByLabel("音声認識を使う")).not.toBeChecked();
  await expect(page.locator("#root")).toHaveJSProperty("inert", true);
  const mode = settings.getByLabel("練習の種類", { exact: true });
  await mode.selectOption("word");
  const reset = settings.getByRole("button", {
    name: "設定を初期値に戻す",
    exact: true,
  });
  await reset.click();
  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation).toBeVisible();
  await expect(settings).toHaveJSProperty("inert", true);
  await page.keyboard.press("Escape");
  await expect(confirmation).toBeHidden();
  await expect(settings).toHaveJSProperty("inert", false);
  await expect(page.locator("#root")).toHaveJSProperty("inert", true);
  await expect(reset).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(settings).toBeHidden();
  await expect(opener).toBeFocused();
  await expect(page.locator("#root")).toHaveJSProperty("inert", false);
  await opener.click();
  await expect(mode).toHaveValue("single");
  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = await settings.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(
    await settings.evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await expect(
    settings.getByRole("button", { name: "設定を適用", exact: true }),
  ).toBeVisible();
  await mode.selectOption("word");
  await settings
    .getByLabel("音声認識の方式", { exact: true })
    .selectOption("small");
  await settings.getByLabel("音声認識を使う").check();
  await settings.getByLabel("練習セット名").fill("未適用の名前");
  await settings.getByLabel("表記", { exact: true }).fill("未適用の教材");
  await settings.getByLabel("読み（ひらがな）").fill("みてきよう");
  await reset.click();
  await confirmation
    .getByRole("button", { name: "初期値に戻して適用", exact: true })
    .click();
  await expect(settings).toBeVisible();
  await expect(confirmation).toBeHidden();
  await expect(mode).toHaveValue("single");
  await expect(
    settings.getByLabel("音声認識の方式", { exact: true }),
  ).toHaveValue("browser");
  await expect(settings.getByLabel("音声認識を使う")).not.toBeChecked();
  await expect(settings.getByLabel("練習セット名")).toHaveValue("");
  await expect(settings.getByLabel("表記", { exact: true })).toHaveValue("");
  await expect(settings.getByLabel("読み（ひらがな）")).toHaveValue("");
  await expect(reset).toBeFocused();
  await expect(settings).toHaveJSProperty("inert", false);
  await expect(page.locator("#root")).toHaveJSProperty("inert", true);
  await settings
    .getByRole("button", { name: "閉じる", exact: true })
    .first()
    .click();
  await expect(settings).toBeHidden();
  await expect(opener).toBeFocused();
  await expect(page.locator("#root")).toHaveJSProperty("inert", false);
  await page.reload();
  await opener.click();
  await expect(mode).toHaveValue("single");
  await expect(
    settings.getByLabel("音声認識の方式", { exact: true }),
  ).toHaveValue("browser");
  await settings.getByLabel("読み上げ速度", { exact: true }).fill("1.3");
  await settings
    .getByRole("button", { name: "設定を適用", exact: true })
    .click();
  await expect(settings).toBeHidden();
  const adjust = page.getByRole("button", {
    name: "対象音・教材を調整",
    exact: true,
  });
  await adjust.scrollIntoViewIfNeeded();
  const scrollY = await page.evaluate(() => window.scrollY);
  await adjust.click();
  await expect(settings).toBeVisible();
  await expect(
    settings.getByLabel("読み上げ速度", { exact: true }),
  ).toHaveValue("1.3");
  await page.keyboard.press("Escape");
  await expect(adjust).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
});

test("手動録音中に設定を開くとマイクを解放し、閉じても自動再開しない", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    const streams: MediaStream[] = [];
    Object.assign(window, { testStreams: streams });
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      streams.push(stream);
      return stream;
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "練習へ進む", exact: true }).click();
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  await page.getByLabel("見本音声", { exact: true }).selectOption("off");
  await page.getByLabel("手動で録音開始・終了").check();
  await page.getByRole("button", { name: "設定を適用", exact: true }).click();
  await page.getByRole("button", { name: "練習を始める", exact: true }).click();
  await page.getByRole("button", { name: "録音開始", exact: true }).click();
  const card = page.getByRole("region", { name: "発音練習", exact: true });
  await expect(card).toHaveAttribute("data-phase", "recording");
  const reading = await card.locator("h1").textContent();
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  await expect(card).toHaveAttribute("data-phase", "paused");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const streams = (window as unknown as { testStreams: MediaStream[] })
          .testStreams;
        return (
          streams.length > 0 &&
          streams.every((stream) =>
            stream.getTracks().every((track) => track.readyState === "ended"),
          )
        );
      }),
    )
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(card).toHaveAttribute("data-phase", "paused");
  await expect(card.locator("h1")).toHaveText(reading!);
  await expect(
    page.getByText("発声すると、ここにお題と聞き取り結果が並びます。"),
  ).toBeVisible();
  await page.getByRole("button", { name: "再開", exact: true }).click();
  await expect(card).toHaveAttribute("data-phase", "waiting");
});

test("設定内のマイク拒否を表示し、再測定で古いエラーを消す", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = (constraints) => {
      if (!document.documentElement.dataset.allowMicrophone)
        return Promise.reject(new DOMException("denied", "NotAllowedError"));
      return original(constraints);
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  const settings = page.getByRole("dialog", {
    name: "設定・教材",
    exact: true,
  });
  const adjust = settings.getByRole("button", { name: "周囲の音で感度を調整" });
  await adjust.click();
  await expect(settings.getByRole("status")).toContainText(
    "マイクを測定できませんでした",
  );
  await expect(
    settings.getByText("3秒間、声を出さず周囲の音を測ります。"),
  ).toBeHidden();
  await expect(adjust).toBeEnabled();
  await page.evaluate(() => {
    document.documentElement.dataset.allowMicrophone = "true";
  });
  await adjust.click();
  await expect(settings.getByText(/マイクを測定できませんでした/)).toBeHidden();
  await expect(settings.getByRole("status")).toContainText(
    "感度を調整しました",
    { timeout: 10000 },
  );
});

test("設定内の見本取得失敗を表示し、再試行できる", async ({ page }) => {
  let fail = true;
  await page.route("**/audio/samples/**/*.ogg", (route) =>
    fail ? route.abort() : route.continue(),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  const settings = page.getByRole("dialog", {
    name: "設定・教材",
    exact: true,
  });
  const sample = settings.getByRole("button", {
    name: "見本を試聴",
    exact: true,
  });
  await sample.click();
  await expect(settings.getByRole("status")).toContainText(
    "収録した見本音声を読み込めませんでした",
  );
  fail = false;
  await sample.click();
  await expect(
    settings.getByText(/収録した見本音声を読み込めませんでした/),
  ).toBeHidden();
  await expect(
    settings.getByRole("status", { name: "見本の再生状態" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(settings).toBeHidden();
});
