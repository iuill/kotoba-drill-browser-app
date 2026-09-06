import { test, expect } from "@playwright/test";

function toneWav(hz: number) {
  const rate = 48000,
    length = rate * 2;
  const buffer = Buffer.alloc(44 + length * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(length * 2, 40);
  for (let i = 0; i < length; i++)
    buffer.writeInt16LE(
      Math.round(8000 * Math.sin((2 * Math.PI * hz * i) / rate)),
      44 + i * 2,
    );
  return buffer;
}

for (const width of [1280, 390]) {
  test(`スペクトルが見本440Hzと録音2kHzのピークを保持し、お題変更で消す（${width}px）`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    if (width === 390) await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => {
      const readings: Record<string, number> = {};
      Object.assign(window, { spectrumReadings: readings });
      const read = AnalyserNode.prototype.getFloatFrequencyData;
      AnalyserNode.prototype.getFloatFrequencyData = function (data) {
        read.call(this, data);
        if (this.fftSize !== 4096) return;
        let peak = 0;
        for (let i = 1; i < data.length; i++)
          if (data[i] > data[peak]) peak = i;
        if (data[peak] > -60)
          readings[
            document
              .querySelector(".spectrum-mini")
              ?.getAttribute("data-source") ?? "idle"
          ] = (peak * this.context.sampleRate) / this.fftSize;
      };
      navigator.mediaDevices.getUserMedia = async () => {
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        oscillator.frequency.value = 2000;
        const gain = context.createGain();
        gain.gain.value = 0.1;
        const destination = context.createMediaStreamDestination();
        oscillator.connect(gain).connect(destination);
        oscillator.start();
        await context.resume();
        return destination.stream;
      };
    });
    await page.route("**/audio/samples/**", (route) =>
      route.fulfill({ contentType: "audio/wav", body: toneWav(440) }),
    );
    await page.goto("/");
    await page.getByRole("button", { name: "練習へ進む", exact: true }).click();
    await page.getByRole("button", { name: "設定・教材", exact: true }).click();
    await page.getByLabel("手動で録音開始・終了").check();
    await page.getByLabel("読み上げ速度", { exact: true }).fill("1");
    await page.getByRole("button", { name: "設定を適用", exact: true }).click();
    const spectrum = page.locator(".spectrum-mini");
    const controls = page.locator(".practice-card > .controls");
    const peak = (kind: string) =>
      page.evaluate(
        (k) =>
          (window as unknown as { spectrumReadings: Record<string, number> })
            .spectrumReadings[k] ?? 0,
        kind,
      );
    await page
      .getByRole("button", { name: "練習を始める", exact: true })
      .click();
    await expect
      .poll(() => peak("sample"), { timeout: 15000 })
      .toBeGreaterThan(420);
    expect(await peak("sample")).toBeLessThan(460);
    await expect(spectrum).toHaveAttribute("data-reference", "true");
    const sampleY = (await controls.boundingBox())!.y;
    await expect(spectrum).toHaveAttribute("data-source", "microphone");
    await expect.poll(() => peak("microphone")).toBeGreaterThan(1980);
    expect(await peak("microphone")).toBeLessThan(2020);
    await expect(spectrum).toHaveAttribute("data-reference", "true");
    await expect(spectrum).toHaveAttribute("data-recording", "false");
    expect(Math.abs((await controls.boundingBox())!.y - sampleY)).toBeLessThan(
      2,
    );
    await page.getByRole("button", { name: "録音開始", exact: true }).click();
    await page.waitForTimeout(1800);
    await page
      .locator(".practice-card")
      .screenshot({ path: `.local/spectrum-mini-${width}.png` });
    await page.getByRole("button", { name: "録音終了", exact: true }).click();
    await expect.poll(() => peak("playback")).toBeGreaterThan(1980);
    expect(await peak("playback")).toBeLessThan(2020);
    await expect(spectrum).toHaveAttribute("data-reference", "true");
    await expect(spectrum).toHaveAttribute("data-recording", "true");
    await page.getByRole("button", { name: "一時停止", exact: true }).click();
    await expect(spectrum).toHaveAttribute("data-source", "idle");
    await expect(spectrum).toHaveAttribute("data-reference", "true");
    await expect(spectrum).toHaveAttribute("data-recording", "true");
    await page
      .locator(".practice-card")
      .screenshot({ path: `.local/spectrum-compare-${width}.png` });
    // 履歴の聞き返しは別の音声インスタンスでも同じグラフへ表示する。
    await page
      .getByRole("button", { name: "聞き返す", exact: true })
      .first()
      .click();
    await expect(spectrum).toHaveAttribute("data-source", "playback");
    await expect(spectrum).toHaveAttribute("data-source", "idle", {
      timeout: 10000,
    });
    await expect(spectrum.locator("canvas")).toBeVisible();
    expect((await spectrum.locator("canvas").boundingBox())!.height).toBe(42);
    await expect(spectrum).toHaveAttribute("data-reference", "true");
    await expect(spectrum).toHaveAttribute("data-recording", "true");
    await page.getByRole("button", { name: "設定・教材", exact: true }).click();
    await page.getByLabel("読み上げ速度", { exact: true }).fill("0.9");
    await page.getByRole("button", { name: "設定を適用", exact: true }).click();
    await expect(spectrum).toHaveAttribute("data-reference", "false");
    await expect(spectrum).toHaveAttribute("data-recording", "false");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
