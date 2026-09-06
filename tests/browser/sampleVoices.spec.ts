import { test, expect } from "@playwright/test";

test("追加した男声を試聴して切り替え、再読み込み後も選択を保持する", async ({
  page,
}) => {
  const files: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("audio/samples/")) files.push(r.url());
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "1. 見本を試聴", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "見本の声と速さ" });
  await expect(dialog.locator('option[value="voicevox-ryusei"]')).toHaveCount(
    0,
  );
  await dialog.getByRole("button", { name: "試聴を停止", exact: true }).click();
  for (const voice of ["nemo-male-1", "voicevox-mesuo"]) {
    await dialog.getByLabel("日本語の声", { exact: true }).selectOption(voice);
    await dialog
      .getByRole("button", { name: "この声と速さで試聴", exact: true })
      .click();
    await expect(
      dialog.getByText("見本を再生中です", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "試聴を停止", exact: true }),
    ).toBeDisabled({ timeout: 15000 });
    expect(files.filter((file) => file.includes(voice))).toHaveLength(1);
  }
  await dialog
    .getByRole("button", { name: "この設定で使う", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  await expect(page.getByLabel("日本語の声", { exact: true })).toHaveValue(
    "voicevox-mesuo",
  );
});

test("日本語ブラウザ音声なしでも収録音声を試聴でき、速度・声の保存と停止が効く", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(speechSynthesis, "getVoices", { value: () => [] });
    Object.defineProperty(speechSynthesis, "speak", {
      value: () => {
        throw new Error("ブラウザ合成を呼んではいけません");
      },
    });
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      document.documentElement.dataset.sampleRate = String(this.playbackRate);
      document.documentElement.dataset.samplePitch = String(
        this.preservesPitch,
      );
      return play.call(this);
    };
  });
  const files: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("audio/samples/")) files.push(r.url());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  await expect(page.getByLabel("日本語の声", { exact: true })).toHaveValue(
    "voicevox-metan",
  );
  await page
    .getByLabel("日本語の声", { exact: true })
    .selectOption("nemo-female-1");
  await page.getByLabel("読み上げ速度", { exact: true }).fill("0.65");
  await page.getByRole("button", { name: "設定を適用", exact: true }).click();
  // 声を選ぶだけで全音声を取得せず、再生するファイルだけを読み込む。
  expect(files).toEqual([]);
  await page
    .getByRole("button", { name: "1. 見本を試聴", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "見本の声と速さ" });
  await expect(
    dialog.getByText("見本を再生中です", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute(
    "data-sample-rate",
    "0.65",
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-sample-pitch",
    "true",
  );
  await expect(
    dialog.getByRole("button", { name: "試聴を停止", exact: true }),
  ).toBeDisabled({ timeout: 15000 });
  expect(files.some((f) => f.includes("nemo-female-1"))).toBe(true);
  expect(files).toHaveLength(1);
  await dialog
    .getByLabel("日本語の声", { exact: true })
    .selectOption("voicevox-kiritan");
  await dialog
    .getByRole("button", { name: "この声と速さで試聴", exact: true })
    .click();
  await expect
    .poll(() => files.some((f) => f.includes("voicevox-kiritan")))
    .toBe(true);
  await dialog.getByRole("button", { name: "試聴を停止", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "試聴を停止", exact: true }),
  ).toBeDisabled();
  expect(files).toHaveLength(2);
  await dialog
    .getByRole("button", { name: "この設定で使う", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  await expect(page.getByLabel("日本語の声", { exact: true })).toHaveValue(
    "voicevox-kiritan",
  );
  await expect(page.getByLabel("読み上げ速度", { exact: true })).toHaveValue(
    "0.65",
  );
  await page.getByLabel("手動で録音開始・終了").check();
  await page.getByRole("button", { name: "設定を適用", exact: true }).click();
  await page.getByRole("button", { name: "練習へ進む", exact: true }).click();
  await page.getByRole("button", { name: "練習を始める", exact: true }).click();
  await expect(page.getByRole("region", { name: "発音練習" })).toHaveAttribute(
    "data-phase",
    "waiting",
  );
  // 受付の合図は見本の速度設定で引き延ばさない。
  await expect(page.locator("html")).toHaveAttribute("data-sample-rate", "1");
});

test("未収録の追加単語だけブラウザ読み上げを使い、理由を表示する", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      value: class {
        constructor(public text: string) {}
      },
    });
    Object.defineProperty(speechSynthesis, "getVoices", {
      value: () => [
        { name: "日本語", lang: "ja-JP", voiceURI: "mock", localService: true },
      ],
    });
    Object.defineProperty(speechSynthesis, "speak", {
      value: (u: SpeechSynthesisUtterance) => {
        document.documentElement.dataset.spoken = u.text;
        setTimeout(
          () => u.onend?.(new Event("end") as SpeechSynthesisEvent),
          20,
        );
      },
    });
    Object.defineProperty(speechSynthesis, "cancel", { value: () => {} });
  });
  const files: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("audio/samples/")) files.push(r.url());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "練習へ進む", exact: true }).click();
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  await page
    .getByLabel("日本語の声", { exact: true })
    .selectOption("voicevox-metan");
  for (const sound of ["か", "き", "く", "け", "こ", "ぴゃ"])
    await page.getByRole("button", { name: sound, exact: true }).click();
  await page.getByLabel("練習の種類").selectOption("word");
  await page.getByLabel("語中", { exact: true }).uncheck();
  await page.getByLabel("語尾", { exact: true }).uncheck();
  await page.getByLabel("表記", { exact: true }).fill("ぴゃぴゃ");
  await page.getByLabel("読み（ひらがな）").fill("ぴゃぴゃ");
  await page.getByRole("button", { name: "単語を追加", exact: true }).click();
  await page.getByLabel("手動で録音開始・終了").check();
  await page.getByRole("button", { name: "設定を適用", exact: true }).click();
  await page.getByRole("button", { name: "練習を始める", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-spoken", "ぴゃぴゃ");
  await expect(page.getByLabel("見本の音声", { exact: true })).toContainText(
    "未収録のお題のため、ブラウザ音声",
  );
  await expect(page.getByRole("region", { name: "発音練習" })).toHaveAttribute(
    "data-phase",
    "waiting",
  );
  expect(files).toEqual([]);
});

test("見本の読み込み中に停止すると、遅れて取得が終わっても再生しない", async ({
  page,
}) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = async function () {
      document.documentElement.dataset.started = "true";
    };
  });
  let requested = false;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/audio/samples/**", async (route) => {
    requested = true;
    await gate;
    await route.abort().catch(() => {});
  });
  try {
    await page.goto("/");
    await page.getByRole("button", { name: "設定・教材", exact: true }).click();
    await page
      .getByLabel("日本語の声", { exact: true })
      .selectOption("nemo-male-1");
    await page.getByRole("button", { name: "設定を適用", exact: true }).click();
    await page
      .getByRole("button", { name: "1. 見本を試聴", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "見本の声と速さ" });
    await expect.poll(() => requested).toBe(true);
    await dialog
      .getByRole("button", { name: "試聴を停止", exact: true })
      .click();
    release();
    await expect(
      dialog.getByRole("button", { name: "試聴を停止", exact: true }),
    ).toBeDisabled();
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-started",
      "true",
    );
  } finally {
    release();
  }
});
