import { test, expect } from "@playwright/test";

for (const evaluation of [false, true]) {
  test(`1音は認識${evaluation ? "オンで3回" : "オフで1回"}再生・発声し、1録音を保存する`, async ({
    page,
  }) => {
    const repetitions = evaluation ? 3 : 1;
    await page.addInitScript(() => {
      class SpeechMock {
        onstart?: () => void;
        onaudiostart?: () => void;
        onend?: () => void;
        start() {
          setTimeout(() => {
            this.onstart?.();
            this.onaudiostart?.();
          }, 0);
        }
        stop() {
          this.onend?.();
        }
        abort() {}
      }
      Object.defineProperty(window, "SpeechRecognition", { value: SpeechMock });
      const blobs = new Map<string, Blob>();
      const played: number[] = [];
      Object.assign(window, { repeatedSamples: played });
      const create = URL.createObjectURL;
      URL.createObjectURL = (blob) => {
        const url = create(blob);
        if (blob instanceof Blob) blobs.set(url, blob);
        return url;
      };
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        const blob = blobs.get(this.src);
        if (blob) played.push(blob.size);
        return play.call(this);
      };
      navigator.mediaDevices.getUserMedia = async () => {
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        gain.gain.value = 0;
        const destination = context.createMediaStreamDestination();
        oscillator.connect(gain).connect(destination);
        oscillator.start();
        await context.resume();
        document.addEventListener("repeat-tone", (event) => {
          gain.gain.value = (event as CustomEvent<number>).detail;
        });
        return destination.stream;
      };
      const Recorder = window.MediaRecorder;
      window.MediaRecorder = class extends Recorder {
        override start(timeslice?: number) {
          document.documentElement.dataset.recordingStarts = String(
            Number(document.documentElement.dataset.recordingStarts ?? 0) + 1,
          );
          super.start(timeslice);
        }
      };
    });
    const files: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("audio/samples/")) files.push(r.url());
    });
    await page.goto("/");
    await page.getByRole("button", { name: "練習へ進む", exact: true }).click();
    await page.getByRole("button", { name: "設定・教材", exact: true }).click();
    if (evaluation) {
      await page.getByLabel("音声認識を使う").check();
      await page
        .getByLabel("音声認識の方式", { exact: true })
        .selectOption("browser");
    }
    await page.getByLabel("無音で終了するまで（ms）").fill("200");
    await page.getByLabel("読み上げ速度", { exact: true }).fill("1");
    await page.getByLabel("毎回、自分の声を聞き返す").uncheck();
    await page.getByLabel("練習の区切り").selectOption("count");
    await page.getByLabel("区切りの回数").fill("1");
    await page.getByRole("button", { name: "設定を適用", exact: true }).click();
    await page
      .getByRole("button", { name: "練習を始める", exact: true })
      .click();
    const card = page.getByRole("region", { name: "発音練習" });
    await expect(card).toHaveAttribute("data-phase", "waiting", {
      timeout: 15000,
    });
    const displayed = await card.locator("h1").innerText();
    expect(displayed.length).toBe(repetitions);
    expect(new Set(displayed).size).toBe(1);
    if (evaluation) await expect(card).toContainText("同じ音を続けて3回");
    else await expect(card).not.toContainText("同じ音を続けて3回");
    const played = await page.evaluate(
      () =>
        (window as unknown as { repeatedSamples: number[] }).repeatedSamples,
    );
    expect(played).toHaveLength(repetitions + 2); // 開始合図 + 見本 + 受付合図
    if (evaluation) {
      expect(played[1]).toBe(played[2]);
      expect(played[2]).toBe(played[3]);
    }
    expect(files).toHaveLength(1);
    // 200ms設定より長い700msの間を挟んでも、同じ録音を維持する。
    for (let i = 0; i < repetitions; i++) {
      await page.evaluate(() =>
        document.dispatchEvent(
          new CustomEvent("repeat-tone", { detail: 0.15 }),
        ),
      );
      await page.waitForTimeout(300);
      await expect(card).toHaveAttribute("data-phase", "recording");
      await page.evaluate(() =>
        document.dispatchEvent(new CustomEvent("repeat-tone", { detail: 0 })),
      );
      if (i < repetitions - 1) {
        await page.waitForTimeout(700);
        await expect(card).toHaveAttribute("data-phase", "recording");
      }
    }
    await expect(
      page.getByRole("dialog", { name: "練習の区切り" }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute(
      "data-recording-starts",
      "1",
    );
    await page.getByRole("button", { name: "終了する", exact: true }).click();
    const history = page.getByRole("dialog", { name: "履歴", exact: true });
    await expect(history.locator(".history-row")).toHaveCount(1);
    await expect(history.locator("h3")).toContainText(
      [...displayed].join("・"),
    );
    await history
      .getByRole("button", { name: "録音を保存", exact: true })
      .click();
    await expect(history.getByText("保存済み", { exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "履歴", exact: true }).click();
    await expect(history.locator("h3")).toContainText(
      [...displayed].join("・"),
    );
    await expect(
      history.getByRole("button", { name: "聞き返す", exact: true }),
    ).toBeVisible();
  });
}

test("認識のオン・オフを適用すると、1音の表示・案内と発声回数が切り替わる", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "練習へ進む", exact: true }).click();
  const card = page.getByRole("region", { name: "発音練習", exact: true });
  for (const evaluation of [false, true, false]) {
    await page.getByRole("button", { name: "設定・教材", exact: true }).click();
    await page.getByLabel("音声認識を使う").setChecked(evaluation);
    await page
      .getByLabel("音声認識の方式", { exact: true })
      .selectOption("browser");
    await page.getByLabel("見本音声", { exact: true }).selectOption("off");
    await page.getByLabel("手動で録音開始・終了").check();
    await page
      .getByText("音声認識を使うとき、3回発声するのはなぜ？", { exact: true })
      .click();
    await expect(
      page.getByText(/短い1音では認識結果が返らないことがあるため/),
    ).toBeVisible();
    await page.getByRole("button", { name: "設定を適用", exact: true }).click();
    await expect(card.locator("h1")).toHaveText(
      evaluation ? /^(.)\1\1$/u : /^.$/u,
    );
    const mode = page.getByRole("button", { name: "1音で練習", exact: true });
    await expect(mode).toContainText(
      evaluation ? "同じ音を3回" : "ひとつの音を、ていねいに",
    );
    await mode.click();
    const wizard = page.getByRole("dialog", {
      name: "1音の練習を選ぶ",
      exact: true,
    });
    await expect(wizard).toContainText(
      evaluation ? "音声認識がオンのため" : "1回発声します",
    );
    await page.keyboard.press("Escape");
  }
});
