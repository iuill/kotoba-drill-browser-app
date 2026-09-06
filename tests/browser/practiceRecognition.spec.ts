import { test, expect } from "@playwright/test";

for (const width of [1280, 390]) {
  test(`聞き取りをお題と表示し、遅れた結果から戻って繰り返す（${width}px）`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      class SpeechMock {
        onstart?: () => void;
        onaudiostart?: () => void;
        onresult?: (event: unknown) => void;
        onerror?: (event: unknown) => void;
        onend?: () => void;
        start() {
          setTimeout(() => {
            this.onstart?.();
            this.onaudiostart?.();
          }, 0);
          document.addEventListener(
            "recognition-result",
            (event) => {
              const text = (event as CustomEvent<string>).detail;
              if (text)
                this.onresult?.({
                  results: [{ isFinal: true, 0: { transcript: text } }],
                });
              else this.onerror?.({ error: "network" });
              this.onend?.();
            },
            { once: true },
          );
        }
        stop() {}
        abort() {}
      }
      Object.defineProperty(window, "SpeechRecognition", { value: SpeechMock });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "練習へ進む", exact: true }).click();
    const card = page.getByRole("region", { name: "発音練習", exact: true });
    const result = card.getByRole("region", { name: "直近の聞き取り" });
    await expect(result).toBeHidden();
    await page.getByRole("button", { name: "設定・教材", exact: true }).click();
    await page.getByLabel("音声認識を使う").check();
    await page.getByLabel("ランダムに出題", { exact: false }).uncheck();
    await page.getByLabel("見本音声", { exact: true }).selectOption("off");
    await page.getByLabel("手動で録音開始・終了").check();
    await page.getByLabel("毎回、自分の声を聞き返す").uncheck();
    await page.getByRole("button", { name: "設定を適用", exact: true }).click();
    await expect(result).toContainText("発声すると、ここに結果が表示されます");
    const controlsY = await card
      .locator(".controls")
      .evaluate((el) => (el as HTMLElement).offsetTop);
    await card
      .getByRole("button", { name: "練習を始める", exact: true })
      .click();
    await expect(card.locator("h1")).toHaveText("かかか");
    const record = async () => {
      await card.getByRole("button", { name: "録音開始", exact: true }).click();
      await page.waitForTimeout(350);
      await card.getByRole("button", { name: "録音終了", exact: true }).click();
      await expect(card).toHaveAttribute("data-phase", "waiting");
    };
    const deliver = async (text: string) => {
      await page.evaluate(
        (text) =>
          document.dispatchEvent(
            new CustomEvent("recognition-result", { detail: text }),
          ),
        text,
      );
    };
    await record();
    await expect(result).toContainText("お題：か・か・か");
    await expect(result).toContainText("聞き取り結果を待っています");
    await expect(card.locator("h1")).toHaveText("ききき");
    await deliver("カ、カ、カ");
    await expect(result.locator(".recognized-text")).toHaveText("カ、カ、カ");
    await record();
    await expect(card.locator("h1")).toHaveText("くくく");
    await expect(result).toContainText("次の結果を認識中");
    await expect(result).toContainText("お題：か・か・か");
    await expect(result.locator(".recognized-text")).toHaveText("カ、カ、カ");
    await result.getByRole("button", { name: "このお題に戻る" }).click();
    await expect(card.locator("h1")).toHaveText("かかか");
    await expect(card).toHaveAttribute("data-phase", "paused");
    await expect(
      card.getByRole("button", { name: "繰り返し オン" }),
    ).toHaveAttribute("aria-pressed", "true");
    // 2つ目の結果が遅れても、戻った練習のお題を書き換えない。
    const longText = "長い聞き取り結果も最後まで確認できます。".repeat(15);
    await deliver(longText);
    await expect(result.locator(".recognized-text")).toHaveText(longText);
    await result.locator(".recognition-reading").evaluate((el) => {
      el.scrollTop = 100;
    });
    await expect(result).toContainText("お題：き・き・き");
    await expect(card.locator("h1")).toHaveText("かかか");
    await card.getByRole("button", { name: "再開", exact: true }).click();
    await expect(card).toHaveAttribute("data-phase", "waiting");
    await record();
    await expect(card.locator("h1")).toHaveText("かかか");
    await deliver("");
    await expect(result).toContainText("接続");
    await expect(result.locator(".recognition-reading")).toHaveJSProperty(
      "scrollTop",
      0,
    );
    // 同じお題・同じ認識文字でも、新しい録音ごとに通知と時刻が更新される。
    await record();
    await deliver("カ、カ、カ");
    await expect(result.locator(".recognized-text")).toHaveText("カ、カ、カ");
    await expect(result).toContainText("✓ 新しい結果");
    const previousRecording = await result
      .locator("time")
      .getAttribute("datetime");
    // 色の一括切り替えでなく、途中では一部だけが塗られることを確認する。
    const wipe = result.locator(".recognition-update-wipe");
    for (const elapsed of [240, 720]) {
      const clip = await wipe.evaluate((el, elapsed) => {
        for (const animation of el.getAnimations({ subtree: true })) {
          animation.pause();
          animation.currentTime = elapsed;
        }
        return getComputedStyle(el, "::before").clipPath;
      }, elapsed);
      expect(clip).toBe(
        elapsed === 240 ? "inset(0px 75% 0px 0px)" : "inset(0px 25% 0px 0px)",
      );
      await result.screenshot({
        path: `.local/recognition-wipe-${width}-${elapsed}.png`,
      });
    }
    await wipe.evaluate((el) => {
      for (const animation of el.getAnimations({ subtree: true }))
        animation.play();
    });
    await expect(result).not.toContainText("✓ 新しい結果", { timeout: 5000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await record();
    await deliver("カ、カ、カ");
    await expect(result).toContainText("✓ 新しい結果");
    await expect(result.locator("time")).not.toHaveAttribute(
      "datetime",
      previousRecording!,
    );
    await expect(result.locator(".recognized-text")).toHaveText("カ、カ、カ");
    expect(
      await card
        .locator(".controls")
        .evaluate((el) => (el as HTMLElement).offsetTop),
    ).toBe(controlsY);
    expect(
      await result.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await result.scrollIntoViewIfNeeded();
    await card.screenshot({ path: `.local/practice-recognition-${width}.png` });
  });
}
