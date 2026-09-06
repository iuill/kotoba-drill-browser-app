import { test, expect } from "@playwright/test";
async function selectBrowserVoice(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  await page.getByLabel("日本語の声", { exact: true }).selectOption("");
  await page.getByRole("button", { name: "設定を適用", exact: true }).click();
  await expect(page.getByRole("region", { name: "練習の設定" })).toBeHidden();
}
async function setup(page: import("@playwright/test").Page) {
  await page.route("https://huggingface.co/**", (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "練習へ進む", exact: true }).click();
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  await page.getByLabel("日本語の声", { exact: true }).selectOption("");
  await page.getByLabel("見本音声", { exact: true }).selectOption("off");
  await page.getByLabel("手動で録音開始・終了").check();
  await page.getByLabel("毎回、自分の声を聞き返す").uncheck();
  await page.getByLabel("見本の後の待ち時間（ms）").fill("0");
  await page.getByLabel("練習の区切り").selectOption("count");
  await page.getByLabel("区切りの回数").fill("1");
  await page.getByRole("button", { name: "設定を適用", exact: true }).click();
  await expect(page.getByRole("region", { name: "練習の設定" })).toBeHidden();
}
test("録音・区切り・明示保存・再読み込み・連動削除", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await setup(page);
  await page.getByRole("button", { name: "練習を始める", exact: true }).click();
  await page.getByRole("button", { name: "録音開始", exact: true }).click();
  await expect(page.getByRole("region", { name: "発音練習" })).toHaveAttribute(
    "data-phase",
    "recording",
  );
  await expect(page.getByText("録音受付中", { exact: true })).toBeVisible();
  await page.waitForTimeout(350);
  await page.getByRole("button", { name: "録音終了", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "練習の区切り" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "終了する", exact: true }).click();
  await page.getByRole("button", { name: "録音を保存", exact: true }).click();
  await expect(page.getByText("保存済み", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  await page
    .getByRole("button", { name: "設定を初期値に戻す", exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).toContainText(
    "保存したデータは残ります",
  );
  await page
    .getByRole("button", { name: "初期値に戻して適用", exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(
    page.getByRole("dialog", { name: "設定・教材", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("日本語の声", { exact: true })).toHaveValue(
    "voicevox-metan",
  );
  await page
    .getByRole("dialog", { name: "設定・教材", exact: true })
    .getByRole("button", { name: "閉じる", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "履歴", exact: true }).click();
  await expect(page.getByText("保存済み", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "全履歴を削除", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toContainText("保存録音1件");
  const historyDialog = page.getByRole("dialog", { name: "履歴", exact: true });
  await expect(historyDialog).toHaveJSProperty("inert", true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await expect(historyDialog).toHaveJSProperty("inert", false);
  await expect(
    historyDialog.getByRole("button", { name: "全履歴を削除", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "全履歴を削除", exact: true }).click();
  await page.getByRole("button", { name: "確認して削除", exact: true }).click();
  await expect(page.getByText("該当する履歴はありません。")).toBeVisible();
  await expect
    .poll(() =>
      historyDialog.evaluate((el) => el.contains(document.activeElement)),
    )
    .toBe(true);
  expect(errors).toEqual([]);
});
test("入力中のショートカット抑止・単語編集と空条件・設定保持", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  await page.getByLabel("練習の種類").selectOption("word");
  await page.getByLabel("表記", { exact: true }).fill("練習用の車");
  await page.getByLabel("読み（ひらがな）").fill("くるま");
  await page.getByLabel("練習セット名").fill("R と Space");
  await expect(
    page.getByRole("button", { name: "繰り返し オフ", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "単語を追加", exact: true }).click();
  await page.getByRole("button", { name: "セットを追加", exact: true }).click();
  await page.getByRole("button", { name: "設定を適用", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  await expect(page.getByText("R と Space", { exact: true })).toBeVisible();
  await page.getByText("教材一覧を編集", { exact: true }).click();
  await expect(
    page.getByText("練習用の車（くるま）", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "設定を初期値に戻す", exact: true })
    .click();
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(page.getByLabel("練習の種類")).toHaveValue("word");
  await page
    .getByRole("button", { name: "設定を初期値に戻す", exact: true })
    .click();
  await page
    .getByRole("button", { name: "初期値に戻して適用", exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  await expect(page.getByLabel("練習の種類")).toHaveValue("single");
  await expect(page.getByLabel("手動で録音開始・終了")).not.toBeChecked();
  await expect(
    page.getByLabel("見本の後の待ち時間（ms）", { exact: true }),
  ).toHaveValue("0");
  await expect(page.getByText("R と Space", { exact: true })).toBeVisible();
  await page.getByText("教材一覧を編集", { exact: true }).click();
  await expect(
    page.getByText("練習用の車（くるま）", { exact: true }),
  ).toBeVisible();
});
test("バックアップ書き出し・音声なし置換の確認・破損データ拒否", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "履歴", exact: true }).click();
  await page.getByLabel("保存録音を含める", { exact: true }).uncheck();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "バックアップを書き出す", exact: true })
    .click();
  const file = await download;
  const path = await file.path();
  await page.getByLabel("バックアップを読み込む").setInputFiles(path!);
  await expect(page.getByRole("alertdialog")).toContainText(
    "現在の保存録音は復元されません",
  );
  const historyDialog = page.getByRole("dialog", { name: "履歴", exact: true });
  await expect(historyDialog).toHaveJSProperty("inert", true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await expect(historyDialog).toHaveJSProperty("inert", false);
  await expect(
    page.getByLabel("保存録音を含める", { exact: true }),
  ).not.toBeChecked();
  await page.getByLabel("バックアップを読み込む").setInputFiles(path!);
  await page
    .getByRole("button", { name: "確認して丸ごと置換", exact: true })
    .click();
  await expect(
    page.getByText("バックアップを復元しました。", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      historyDialog.evaluate((el) => el.contains(document.activeElement)),
    )
    .toBe(true);
  await page.getByLabel("バックアップを読み込む").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":999}'),
  });
  await expect(page.getByText(/データ形式が不正/)).toBeVisible();
});

test("Cohereを選ぶとWebGPUへ切り替わり、非対応なら取得前に案内する", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "gpu", {
      value: undefined,
      configurable: true,
    }),
  );
  let modelRequests = 0;
  page.on("request", (r) => {
    if (r.url().includes("huggingface.co")) modelRequests++;
  });
  await setup(page);
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  await page.getByLabel("音声認識を使う（発音の採点ではありません）").check();
  await page
    .getByLabel("音声認識の方式", { exact: true })
    .selectOption("cohere");
  await expect(page.getByLabel("認識の処理方式", { exact: true })).toHaveValue(
    "webgpu",
  );
  await page.getByRole("button", { name: "設定を適用", exact: true }).click();
  await page.getByRole("button", { name: "練習を始める", exact: true }).click();
  await expect(page.getByText(/WebGPUを利用できません/)).toBeVisible();
  expect(modelRequests).toBe(0);
  await page
    .getByRole("button", { name: "評価なしで練習", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "録音開始", exact: true }),
  ).toBeVisible();
});

test("設定を開くと見本を止め、閉じても自動再開しない", async ({ page }) => {
  await page.addInitScript(() => {
    let current: { onerror?: () => void } | undefined;
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      value: class {},
    });
    Object.defineProperty(speechSynthesis, "getVoices", {
      value: () => [
        {
          voiceURI: "mock-ja",
          lang: "ja-JP",
          name: "模擬音声",
          localService: true,
        },
      ],
    });
    Object.defineProperty(speechSynthesis, "speak", {
      value: (u: typeof current) => {
        current = u;
      },
    });
    Object.defineProperty(speechSynthesis, "cancel", {
      value: () => {
        const u = current;
        current = undefined;
        u?.onerror?.();
      },
    });
  });
  await page.goto("/");
  await selectBrowserVoice(page);
  await page.getByRole("button", { name: "練習へ進む", exact: true }).click();
  await page.getByRole("button", { name: "練習を始める", exact: true }).click();
  await expect(page.getByText("見本を再生中", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  await expect(page.getByRole("region", { name: "発音練習" })).toHaveAttribute(
    "data-phase",
    "paused",
  );
  await page
    .getByRole("button", { name: "閉じる", exact: true })
    .first()
    .click();
  await expect(page.getByRole("region", { name: "発音練習" })).toHaveAttribute(
    "data-phase",
    "paused",
  );
});

test("準備の発声待ちから手動録音・聞き返し・再測定中止", async ({ page }) => {
  await page.addInitScript(() => {
    AnalyserNode.prototype.getFloatTimeDomainData = function (data) {
      data.fill(0);
    };
  });
  await page.goto("/");
  const replay = page.getByRole("button", {
    name: "録音した自分の声をもう一度聞く",
  });
  await page
    .getByRole("button", { name: "2. マイクを調整して録音・再生" })
    .click();
  const dialog = page.getByRole("dialog", { name: "マイクの調整と録音確認" });
  await expect(dialog).toContainText("最初の3秒は声を出さず静かに");
  await expect(
    page.getByRole("status", { name: "音声確認の状態" }),
  ).toContainText("準備ができたら");
  await expect(replay).toHaveCount(0);
  await page.getByRole("button", { name: "調整を始める", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "音声確認の状態" }),
  ).toContainText("3秒間");
  const countdown = page.getByRole("status", { name: "マイク調整の進捗" });
  await expect(countdown).toContainText("あと3秒");
  await expect(countdown).toContainText("あと2秒");
  await expect(countdown).toContainText("あと1秒");
  await expect(
    page.getByText("測定が終わりました。声を出してください。", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "手動で録音開始", exact: true })
    .click();
  await expect(
    page.getByRole("status", { name: "音声確認の状態" }),
  ).toContainText("録音中です");
  await page.waitForTimeout(250);
  await page
    .getByRole("button", { name: "録音を終了して聞く", exact: true })
    .click();
  await expect(replay).toBeEnabled();
  await expect(
    page.getByRole("status", { name: "音声確認の状態" }),
  ).toContainText("録音を再生しました");
  await page.getByRole("button", { name: "調整を始める", exact: true }).click();
  await expect(replay).toHaveCount(0);
  await page.getByRole("button", { name: "音声確認を中止" }).click();
  await expect(
    page.getByRole("status", { name: "音声確認の状態" }),
  ).toContainText("中止しました");
  await expect(countdown).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "手動で録音開始", exact: true }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "閉じる", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "2. マイクを調整して録音・再生" }),
  ).toBeFocused();
});

test("準備の録音は連続入力でも10秒で終了する", async ({ page }) => {
  await page.addInitScript(() => {
    AnalyserNode.prototype.getFloatTimeDomainData = function (data) {
      data.fill(
        document.documentElement.dataset.testVoiced === "yes" ? 0.1 : 0,
      );
    };
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "2. マイクを調整して録音・再生" })
    .click();
  await page.getByRole("button", { name: "調整を始める", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "手動で録音開始", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.dataset.testVoiced = "yes";
  });
  await expect(
    page.getByRole("status", { name: "音声確認の状態" }),
  ).toContainText("録音中です");
  await expect(
    page.getByRole("status", { name: "音声確認の状態" }),
  ).toContainText("マイクの録音は終了", {
    timeout: 13000,
  });
  await expect(
    page.getByRole("button", { name: "録音した自分の声をもう一度聞く" }),
  ).toBeEnabled({ timeout: 13000 });
});

test("準備の試聴で声と速度を比較し、選んだ設定を保存する", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      value: class {},
    });
    Object.defineProperty(speechSynthesis, "getVoices", {
      value: () => [
        { voiceURI: "voice-a", lang: "ja-JP", name: "声A", localService: true },
        { voiceURI: "voice-b", lang: "ja-JP", name: "声B", localService: true },
      ],
    });
    Object.defineProperty(speechSynthesis, "speak", {
      value: (u: SpeechSynthesisUtterance) => {
        document.documentElement.dataset.testSpeech = JSON.stringify({
          voice: u.voice?.voiceURI,
          rate: u.rate,
        });
      },
    });
    Object.defineProperty(speechSynthesis, "cancel", { value: () => {} });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "1. 見本を試聴", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "見本の声と速さ" });
  await expect(dialog.locator("strong")).toHaveText("あ、か、あか、かさ");
  await dialog
    .getByLabel("日本語の声", { exact: true })
    .selectOption("voice-b");
  await dialog.getByLabel("読み上げ速度", { exact: true }).fill("0.65");
  await expect(dialog.locator(".sample-text strong")).toHaveText(
    "あ、か、あか、かさ",
  );
  await expect(dialog.locator(".sample-text")).toContainText("停止中です");
  await expect(
    dialog.getByRole("button", { name: "試聴を停止", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "この声と速さで試聴" }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-test-speech",
    JSON.stringify({ voice: "voice-b", rate: 0.65 }),
  );
  await expect(
    dialog.getByRole("button", { name: "試聴を停止", exact: true }),
  ).toBeEnabled();
  await dialog.getByRole("button", { name: "この設定で使う" }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await page
    .getByRole("button", { name: "1. 見本を試聴", exact: true })
    .click();
  await expect(dialog.getByLabel("日本語の声", { exact: true })).toHaveValue(
    "voice-b",
  );
  await expect(dialog.getByLabel("読み上げ速度", { exact: true })).toHaveValue(
    "0.65",
  );
  await dialog.getByLabel("読み上げ速度", { exact: true }).fill("1.5");
  await dialog.getByRole("button", { name: "閉じる", exact: true }).click();
  await page
    .getByRole("button", { name: "1. 見本を試聴", exact: true })
    .click();
  await expect(dialog.getByLabel("読み上げ速度", { exact: true })).toHaveValue(
    "0.65",
  );
});

test("見本前にマイクを準備して録音に再利用し、一時停止で解放する", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let streams: MediaStream[] = [];
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      streams.push(stream);
      document.documentElement.dataset.micRequests = String(streams.length);
      return stream;
    };
    document.addEventListener("test-check-mics", () => {
      document.documentElement.dataset.liveMics = String(
        streams
          .flatMap((s) => s.getTracks())
          .filter((t) => t.readyState === "live").length,
      );
    });
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      value: class {},
    });
    Object.defineProperty(speechSynthesis, "getVoices", {
      value: () => [{ voiceURI: "mock", lang: "ja-JP", name: "模擬音声" }],
    });
    Object.defineProperty(speechSynthesis, "speak", {
      value: (u: SpeechSynthesisUtterance) => {
        document.addEventListener(
          "test-end-sample",
          () => u.onend?.(new Event("end") as SpeechSynthesisEvent),
          { once: true },
        );
        document.documentElement.dataset.sampleReady = "true";
        document.documentElement.dataset.sampleCount = String(
          Number(document.documentElement.dataset.sampleCount ?? 0) + 1,
        );
      },
    });
    Object.defineProperty(speechSynthesis, "cancel", {
      value: () => {
        delete document.documentElement.dataset.sampleReady;
      },
    });
  });
  await setup(page);
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  await page.getByLabel("見本音声", { exact: true }).selectOption("always");
  await page
    .getByLabel("見本の後の待ち時間（ms）", { exact: true })
    .fill("1000");
  await page.getByRole("button", { name: "設定を適用", exact: true }).click();
  await expect(
    page.getByLabel("見本の後の待ち時間（ms）", { exact: true }),
  ).toHaveCount(0);
  const card = page.getByRole("region", { name: "発音練習", exact: true });
  const phaseColors: string[] = [];
  const checkPhase = async (phase: string) => {
    await expect(card).toHaveAttribute("data-phase", phase);
    const waves = card.locator(".direction-waves");
    if (["sample", "waiting", "recording"].includes(phase)) {
      await expect(waves).toHaveAttribute(
        "data-direction",
        phase === "sample" ? "out" : "in",
      );
      await expect(waves.locator(".direction-particle").first()).toHaveCSS(
        "animation-direction",
        phase === "sample" ? "normal" : "reverse",
      );
    } else {
      await expect(waves).toHaveCount(0);
    }
    phaseColors.push(
      await card
        .locator(".phase")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    );
  };
  await page.getByRole("button", { name: "練習を始める", exact: true }).click();
  await expect(page.getByText("見本を再生中", { exact: true })).toBeVisible();
  await checkPhase("sample");
  await expect(page.locator("html")).toHaveAttribute("data-mic-requests", "1");
  await page.getByRole("button", { name: "一時停止", exact: true }).click();
  await page.evaluate(() =>
    document.dispatchEvent(new Event("test-check-mics")),
  );
  await expect(page.locator("html")).toHaveAttribute("data-live-mics", "0");
  await page.getByRole("button", { name: "再開", exact: true }).click();
  await expect(page.getByText("見本を再生中", { exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute(
    "data-sample-ready",
    "true",
  );
  await page.evaluate(() =>
    document.dispatchEvent(new Event("test-end-sample")),
  );
  await checkPhase("delay");
  await expect(
    page.getByRole("button", { name: "録音開始", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-mic-requests", "2");
  await checkPhase("waiting");
  await page.getByRole("button", { name: "録音開始", exact: true }).click();
  await checkPhase("recording");
  expect(new Set(phaseColors).size).toBe(3);
  expect(phaseColors[2]).toBe(phaseColors[3]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(card.locator(".direction-waves")).toBeHidden();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(card.getByText("録音受付中", { exact: true })).toBeVisible();
  await expect(card.getByText("録音中", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "一時停止", exact: true }).click();
  await page.evaluate(() =>
    document.dispatchEvent(new Event("test-check-mics")),
  );
  await expect(page.locator("html")).toHaveAttribute("data-live-mics", "0");
});

test("準備完了・再読み込み後もスピーカー・マイク確認から試聴と録音確認を開き直せる", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "練習へ進む", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "練習へ進む", exact: true }),
  ).toBeHidden();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "1. 見本を試聴", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "スピーカー・マイク確認", exact: true })
    .click();
  await page
    .getByRole("button", { name: "1. 見本を試聴", exact: true })
    .click();
  const sample = page.getByRole("dialog", { name: "見本の声と速さ" });
  await expect(sample).toBeVisible();
  await sample.getByRole("button", { name: "閉じる", exact: true }).click();
  await page
    .getByRole("button", { name: "2. マイクを調整して録音・再生", exact: true })
    .click();
  const mic = page.getByRole("dialog", { name: "マイクの調整と録音確認" });
  await expect(
    mic.getByRole("button", { name: "調整を始める", exact: true }),
  ).toBeVisible();
  await mic.getByRole("button", { name: "閉じる", exact: true }).click();
  await page
    .getByRole("button", { name: "確認を終えて練習に戻る", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "1. 見本を試聴", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "スピーカー・マイク確認", exact: true }),
  ).toBeVisible();
});

test("試聴のマイク使用条件を切り替え、再生終了でマイクを解放する", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const streams: MediaStream[] = [];
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await getUserMedia(constraints);
      streams.push(stream);
      return stream;
    };
    const inspect = () => {
      document.documentElement.dataset.previewMics = String(
        streams
          .flatMap((s) => s.getTracks())
          .filter((t) => t.readyState === "live").length,
      );
    };
    document.addEventListener("inspect-preview-mics", inspect);
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      value: class {},
    });
    Object.defineProperty(speechSynthesis, "getVoices", {
      value: () => [{ lang: "ja-JP", voiceURI: "mock", name: "模擬音声" }],
    });
    Object.defineProperty(speechSynthesis, "speak", {
      value: (u: SpeechSynthesisUtterance) => {
        inspect();
        document.addEventListener(
          "finish-preview",
          () => u.onend?.(new Event("end") as SpeechSynthesisEvent),
          { once: true },
        );
      },
    });
    Object.defineProperty(speechSynthesis, "cancel", { value: () => {} });
    Object.defineProperty(window, "MediaRecorder", {
      value: class {
        constructor() {
          throw new Error("試聴で録音してはいけない");
        }
      },
    });
  });
  await page.goto("/");
  await selectBrowserVoice(page);
  await page
    .getByRole("button", { name: "1. 見本を試聴", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "見本の声と速さ" });
  await expect(page.locator("html")).toHaveAttribute("data-preview-mics", "1");
  await page.evaluate(() =>
    document.dispatchEvent(new Event("finish-preview")),
  );
  await expect(dialog.locator(".sample-text")).toContainText("停止中");
  await page.evaluate(() =>
    document.dispatchEvent(new Event("inspect-preview-mics")),
  );
  await expect(page.locator("html")).toHaveAttribute("data-preview-mics", "0");
  await dialog
    .getByLabel("練習と同じ条件で試聴（マイクを使用）", { exact: true })
    .uncheck();
  await dialog
    .getByRole("button", { name: "この声と速さで試聴", exact: true })
    .click();
  await expect(dialog.locator(".sample-text")).toContainText("再生中");
  await expect(page.locator("html")).toHaveAttribute("data-preview-mics", "0");
  await dialog.getByRole("button", { name: "閉じる", exact: true }).click();
});

test("練習ボタンをクリックした後もSpace・R・左右キーが効く", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "練習を始める", exact: true }).click();
  const card = page.getByRole("region", { name: "発音練習", exact: true });
  await expect(card).toBeFocused();
  await expect(card).toHaveAttribute("data-phase", "waiting");
  await page.keyboard.press("r");
  await expect(
    page.getByRole("button", { name: "繰り返し オン", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Space");
  await expect(card).toHaveAttribute("data-phase", "paused");
  await page.keyboard.press("Space");
  await expect(card).toHaveAttribute("data-phase", "waiting");
  const first = await card.locator(".prompt").innerText();
  await page.keyboard.press("ArrowRight");
  await expect(card.locator(".prompt")).not.toHaveText(first);
  await page.keyboard.press("ArrowLeft");
  await expect(card.locator(".prompt")).toHaveText(first);
  const repeat = page.getByRole("button", {
    name: "繰り返し オン",
    exact: true,
  });
  await repeat.focus();
  await page.keyboard.press("r");
  await expect(
    page.getByRole("button", { name: "繰り返し オフ", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "繰り返し オン", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("追加モデルの選択を保存・再読み込みできる", async ({ page }) => {
  await setup(page);
  for (const model of ["small", "kotoba"]) {
    await page.getByRole("button", { name: "設定・教材", exact: true }).click();
    await page
      .getByLabel("音声認識の方式", { exact: true })
      .selectOption(model);
    await expect(
      page.getByRole("option", { name: "GPU / WebGPU", exact: true }),
    ).toHaveCount(1);
    await page.getByRole("button", { name: "設定を適用", exact: true }).click();
    await expect(page.getByRole("region", { name: "練習の設定" })).toBeHidden();
    await page.reload();
    await page.getByRole("button", { name: "設定・教材", exact: true }).click();
    await expect(
      page.getByLabel("音声認識の方式", { exact: true }),
    ).toHaveValue(model);
    await page.getByRole("button", { name: "設定を適用", exact: true }).click();
  }
});

test("試聴は合図なし・練習は初回と次回で音源を変え、合図中の停止で見本も中止", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(speechSynthesis, "getVoices", {
      value: () => [{ voiceURI: "mock", lang: "ja-JP", name: "模擬音声" }],
    });
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      value: class {},
    });
    Object.defineProperty(speechSynthesis, "speak", {
      value: (u: SpeechSynthesisUtterance) => {
        document.documentElement.dataset.spoken = "true";
        document.documentElement.dataset.spokenCount = String(
          Number(document.documentElement.dataset.spokenCount ?? 0) + 1,
        );
        document.addEventListener(
          "test-finish-sample",
          () => u.onend?.(new Event("end") as SpeechSynthesisEvent),
          { once: true },
        );
      },
    });
    Object.defineProperty(speechSynthesis, "cancel", { value: () => {} });
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      document.documentElement.dataset.audioPlaying = "true";
      this.addEventListener("ended", () => {
        document.documentElement.dataset.audioEnded = "true";
      });
      return original.call(this);
    };
  });
  const files: string[] = [];
  page.on("request", (r) => {
    if (/audio\/practice-(start|next)\.ogg$/.test(r.url()))
      files.push(r.url().split("/").at(-1)!);
  });
  await page.goto("/");
  await selectBrowserVoice(page);
  await page
    .getByRole("button", { name: "1. 見本を試聴", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-spoken", "true");
  expect(files).toEqual([]);
  await page
    .getByRole("dialog", { name: "見本の声と速さ" })
    .getByRole("button", { name: "閉じる", exact: true })
    .click();
  await setup(page);
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  await page.getByLabel("見本音声", { exact: true }).selectOption("always");
  await page.getByRole("button", { name: "設定を適用", exact: true }).click();
  await page.getByRole("button", { name: "練習を始める", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-audio-playing",
    "true",
  );
  await page.getByRole("button", { name: "一時停止", exact: true }).click();
  await page.waitForTimeout(650);
  await expect(page.locator("html")).not.toHaveAttribute("data-spoken", "true");
  await page.getByRole("button", { name: "再開", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-spoken", "true");
  await expect(page.locator("html")).toHaveAttribute(
    "data-audio-ended",
    "true",
  );
  expect(files).toEqual(["practice-start.ogg", "practice-start.ogg"]);
  await page.evaluate(() =>
    document.dispatchEvent(new Event("test-finish-sample")),
  );
  await expect(page.getByRole("region", { name: "発音練習" })).toHaveAttribute(
    "data-phase",
    "waiting",
  );
  await page.evaluate(() => {
    delete document.documentElement.dataset.spoken;
    delete document.documentElement.dataset.audioEnded;
  });
  await page.getByRole("button", { name: "次へ →", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-spoken", "true");
  await expect(page.locator("html")).toHaveAttribute(
    "data-audio-ended",
    "true",
  );
  expect(files.at(-1)).toBe("practice-next.ogg");
});

test("開始前のSpaceは新規セッションを作り、終了後の聞き返し・設定で再開状態に戻らない", async ({
  page,
}) => {
  await setup(page);
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("region", { name: "発音練習" })).toHaveAttribute(
    "data-phase",
    "idle",
  );
  await page.getByRole("region", { name: "発音練習" }).focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "録音開始", exact: true }).click();
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: "録音終了", exact: true }).click();
  await page.getByRole("button", { name: "終了する", exact: true }).click();
  await page
    .getByRole("region", { name: "履歴と振り返り" })
    .getByRole("button", { name: "聞き返す", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "履歴", exact: true })
    .getByRole("button", { name: "閉じる", exact: true })
    .click();
  await expect(page.getByRole("region", { name: "発音練習" })).toHaveAttribute(
    "data-phase",
    "review",
  );
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  await page.getByRole("button", { name: "設定を適用", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "新しい練習を始める", exact: true }),
  ).toBeVisible();
  const sessions = await page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const r = indexedDB.open("kotoba-drill", 1);
        r.onsuccess = () => {
          const q = r.result
            .transaction("history")
            .objectStore("history")
            .getAll();
          q.onsuccess = () => {
            resolve(q.result.map((h) => h.session));
            r.result.close();
          };
        };
      }),
  );
  expect(sessions).toHaveLength(1);
  expect(sessions[0]).not.toBe("");
});

test("練習中のマイク再調整が再開時の発声検知に反映される", async ({ page }) => {
  await page.addInitScript(() => {
    AnalyserNode.prototype.getFloatTimeDomainData = function (data) {
      data.fill(Number(document.documentElement.dataset.testLevel ?? 0));
    };
  });
  await setup(page);
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  await page.getByLabel("手動で録音開始・終了").uncheck();
  await page.getByRole("button", { name: "設定を適用", exact: true }).click();
  await page.getByRole("button", { name: "練習を始める", exact: true }).click();
  await expect(page.getByRole("region", { name: "発音練習" })).toHaveAttribute(
    "data-phase",
    "waiting",
  );
  await page
    .getByRole("button", { name: "スピーカー・マイク確認", exact: true })
    .click();
  await page
    .getByRole("button", { name: "2. マイクを調整して録音・再生" })
    .click();
  await page.getByRole("button", { name: "調整を始める", exact: true }).click();
  await expect(
    page.getByText("測定が終わりました。声を出してください。", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("dialog", { name: "マイクの調整と録音確認" })
    .getByRole("button", { name: "閉じる", exact: true })
    .click();
  await page
    .getByRole("button", { name: "確認を終えて練習に戻る", exact: true })
    .click();
  await page.evaluate(() => {
    document.documentElement.dataset.testLevel = "0.015";
  });
  await page.getByRole("button", { name: "再開", exact: true }).click();
  await expect(page.getByRole("region", { name: "発音練習" })).toHaveAttribute(
    "data-phase",
    "recording",
  );
  await page.getByRole("button", { name: "一時停止", exact: true }).click();
});

test("手動録音の終了直前に入れた音が保存音声の末尾に残る", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const ctx = new AudioContext();
      await ctx.resume();
      const osc = ctx.createOscillator(),
        gain = ctx.createGain(),
        out = ctx.createMediaStreamDestination();
      osc.frequency.value = 1000;
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(out);
      osc.start();
      document.addEventListener(
        "tail-tone",
        () => {
          gain.gain.setValueAtTime(0.4, ctx.currentTime);
          gain.gain.setValueAtTime(0, ctx.currentTime + 0.06);
        },
        { once: true },
      );
      return out.stream;
    };
    const Original = MediaRecorder;
    window.MediaRecorder = class extends Original {
      constructor(stream: MediaStream, options?: MediaRecorderOptions) {
        super(stream, options);
        const chunks: Blob[] = [];
        this.addEventListener("dataavailable", (e) => chunks.push(e.data));
        this.addEventListener("stop", async () => {
          if (!chunks.length) return;
          const ctx = new AudioContext();
          const decoded = await ctx.decodeAudioData(
            await new Blob(chunks, { type: this.mimeType }).arrayBuffer(),
          );
          let peak = 0;
          for (const value of decoded.getChannelData(0))
            peak = Math.max(peak, Math.abs(value));
          document.documentElement.dataset.tailPeak = String(peak);
          await ctx.close();
        });
      }
    };
  });
  await setup(page);
  await page.getByRole("button", { name: "練習を始める", exact: true }).click();
  await page.getByRole("button", { name: "録音開始", exact: true }).click();
  await page.waitForTimeout(300);
  await page.evaluate(async () => {
    document.dispatchEvent(new Event("tail-tone"));
    await new Promise((resolve) => setTimeout(resolve, 70));
    const button = [...document.querySelectorAll("button")].find(
      (b) => b.textContent === "録音終了",
    );
    button!.click();
  });
  await expect
    .poll(async () =>
      Number(await page.locator("html").getAttribute("data-tail-peak")),
    )
    .toBeGreaterThan(0.1);
});

for (const outcome of ["success", "network"] as const) {
  test(`ブラウザ標準の音声認識：${outcome}・モデル不要・設定と履歴を保存`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript((outcome) => {
      class SpeechMock {
        lang = "";
        continuous = false;
        interimResults = true;
        maxAlternatives = 0;
        onstart?: () => void;
        onaudiostart?: () => void;
        onresult?: (event: unknown) => void;
        onerror?: (event: unknown) => void;
        onend?: () => void;
        start(track: MediaStreamTrack) {
          if (
            track.kind !== "audio" ||
            track.readyState !== "live" ||
            this.lang !== "ja-JP"
          )
            throw Error("録音トラック・日本語の指定がない");
          document.documentElement.dataset.browserSpeech = "started";
          setTimeout(() => this.onstart?.(), 0);
          setTimeout(() => this.onaudiostart?.(), 250);
        }
        stop() {
          if (outcome === "network") this.onerror?.({ error: "network" });
          else
            this.onresult?.({
              results: [{ isFinal: true, 0: { transcript: "かさ" } }],
            });
          this.onend?.();
        }
        abort() {}
      }
      Object.defineProperty(window, "SpeechRecognition", { value: SpeechMock });
      Object.defineProperty(window, "Worker", {
        value: class {
          constructor() {
            throw Error("ブラウザ認識にWorkerは不要");
          }
        },
      });
    }, outcome);
    await setup(page);
    await page.getByRole("button", { name: "設定・教材", exact: true }).click();
    await page.getByLabel("音声認識を使う").check();
    await page
      .getByLabel("音声認識の方式", { exact: true })
      .selectOption("browser");
    await page.getByLabel("練習の区切り").selectOption("none");
    await expect(
      page.getByRole("note", { name: "音声認識について" }),
    ).toContainText("外部へ送信される場合があります");
    await expect(
      page.getByLabel("認識の処理方式", { exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByText("端末内認識の推奨環境", { exact: false }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "設定を適用", exact: true }).click();
    await page
      .getByRole("button", { name: "練習を始める", exact: true })
      .click();
    await page.getByRole("button", { name: "録音開始", exact: true }).click();
    await page.waitForTimeout(450);
    await page.getByRole("button", { name: "録音終了", exact: true }).click();
    const message =
      outcome === "success"
        ? "聞き取り：かさ"
        : "音声認識サービスへ接続できませんでした";
    await expect(
      page
        .getByRole("region", { name: "直近の発声", exact: true })
        .getByText(message, { exact: false }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute(
      "data-browser-speech",
      "started",
    );
    await page.reload();
    await page.getByRole("button", { name: "設定・教材", exact: true }).click();
    await expect(
      page.getByLabel("音声認識の方式", { exact: true }),
    ).toHaveValue("browser");
    await page.getByRole("button", { name: "設定を適用", exact: true }).click();
    await page.getByRole("button", { name: "履歴", exact: true }).click();
    const history = page.getByRole("dialog", { name: "履歴", exact: true });
    await expect(history.getByText(message, { exact: false })).toBeVisible();
    await expect(history).toContainText("ブラウザ標準・録音");
    expect(errors).toEqual([]);
  });
}

test("ブラウザ認識が非対応でも、評価なしで練習を続けられる", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechRecognition", { value: undefined });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      value: undefined,
    });
  });
  await setup(page);
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  await page.getByLabel("音声認識を使う").check();
  await page
    .getByLabel("音声認識の方式", { exact: true })
    .selectOption("browser");
  await expect(
    page.getByText("このブラウザでは利用できません。", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "設定を適用", exact: true }).click();
  await page.getByRole("button", { name: "練習を始める", exact: true }).click();
  await expect(
    page.getByText("このブラウザでは録音音声のブラウザ認識を利用できません。", {
      exact: false,
    }),
  ).toBeVisible();
  const card = page.getByRole("region", { name: "発音練習" });
  expect((await card.locator("h1").innerText()).length).toBe(3);
  await page
    .getByRole("button", { name: "評価なしで練習", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "録音開始", exact: true }),
  ).toBeVisible();
  expect((await card.locator("h1").innerText()).length).toBe(1);
  await expect(card).not.toContainText("同じ音を続けて3回");
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  await expect(page.getByLabel("音声認識を使う")).not.toBeChecked();
});

test("ブラウザ認識へ渡す実音声は入力開始後の無音を挟み、短い音と末尾を保つ", async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const context = new AudioContext({ sampleRate: 48000 });
      await context.resume();
      const oscillator = context.createOscillator();
      oscillator.frequency.value = 880;
      const volume = context.createGain();
      volume.gain.value = 0.2;
      const destination = context.createMediaStreamDestination();
      oscillator.connect(volume).connect(destination);
      oscillator.start();
      return destination.stream;
    };
    class SpeechMock {
      onstart?: () => void;
      onaudiostart?: () => void;
      onresult?: (event: unknown) => void;
      onend?: () => void;
      recorder?: MediaRecorder;
      timer?: ReturnType<typeof setTimeout>;
      start(track: MediaStreamTrack) {
        const chunks: Blob[] = [];
        const recorder = new MediaRecorder(new MediaStream([track]));
        this.recorder = recorder;
        recorder.ondataavailable = (event) => chunks.push(event.data);
        recorder.onstop = async () => {
          const context = new AudioContext();
          try {
            const buffer = await context.decodeAudioData(
              await new Blob(chunks).arrayBuffer(),
            );
            const samples = buffer.getChannelData(0);
            let first = -1,
              last = -1;
            for (let i = 0; i < samples.length; i++) {
              if (Math.abs(samples[i]) > 0.01) {
                if (first === -1) first = i;
                last = i;
              }
            }
            const begin = first + Math.floor(buffer.sampleRate * 0.1);
            const end = begin + Math.floor(buffer.sampleRate * 0.2);
            let crossings = 0;
            for (let i = begin + 1; i < end; i++)
              if (samples[i - 1] <= 0 && samples[i] > 0) crossings++;
            document.documentElement.dataset.speechInput = JSON.stringify({
              rate: track.getSettings().sampleRate,
              channels: track.getSettings().channelCount,
              frequency: crossings / 0.2,
              first: first / buffer.sampleRate,
              tail: (samples.length - last - 1) / buffer.sampleRate,
              voiced: (last - first) / buffer.sampleRate,
            });
            this.onresult?.({
              results: [{ isFinal: true, 0: { transcript: "模擬結果" } }],
            });
            this.onend?.();
          } finally {
            await context.close();
          }
        };
        recorder.start();
        this.onstart?.();
        // サービス開始と音声入力開始には遅れがある。短い入力で先走りを検出する。
        this.timer = setTimeout(() => this.onaudiostart?.(), 800);
      }
      stop() {
        this.recorder?.stop();
      }
      abort() {
        clearTimeout(this.timer);
        if (this.recorder?.state === "recording") this.recorder.stop();
      }
    }
    Object.defineProperty(window, "SpeechRecognition", { value: SpeechMock });
  });
  await setup(page);
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  await page.getByLabel("音声認識を使う").check();
  await page
    .getByLabel("音声認識の方式", { exact: true })
    .selectOption("browser");
  await page.getByLabel("練習の区切り").selectOption("none");
  await page.getByRole("button", { name: "設定を適用", exact: true }).click();
  await page.getByRole("button", { name: "練習を始める", exact: true }).click();
  await page.getByRole("button", { name: "録音開始", exact: true }).click();
  await page.waitForTimeout(450);
  await page.getByRole("button", { name: "録音終了", exact: true }).click();
  await expect(
    page.getByText("聞き取り：模擬結果", { exact: false }),
  ).toBeVisible();
  const measured = JSON.parse(
    (await page.locator("html").getAttribute("data-speech-input"))!,
  );
  expect(measured.rate).toBe(16000);
  expect(measured.channels).toBe(1);
  expect(measured.frequency).toBeGreaterThan(850);
  expect(measured.frequency).toBeLessThan(910);
  expect(measured.first).toBeGreaterThan(1.1);
  expect(measured.first).toBeLessThan(2);
  expect(measured.voiced).toBeGreaterThan(0.3);
  expect(measured.tail).toBeGreaterThan(0.7);
});
