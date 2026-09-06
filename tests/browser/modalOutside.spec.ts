import { expect, test } from "@playwright/test";

const outside = (page: import("@playwright/test").Page) =>
  page.mouse.click(2, 2);

test("外側クリックは最前面だけキャンセルし、未適用変更・フォーカスを保全する", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  const settings = page.getByRole("dialog", {
    name: "設定・教材",
    exact: true,
  });
  const rate = settings.getByLabel("読み上げ速度", { exact: true });
  const original = await rate.inputValue();
  await rate.fill("1.2");
  // パネル内から外へドラッグした場合は閉じない。
  const heading = await settings
    .getByRole("heading", { name: "練習の設定", exact: true })
    .boundingBox();
  await page.mouse.move(heading!.x + 10, heading!.y + 10);
  await page.mouse.down();
  await page.mouse.move(2, 2);
  await page.mouse.up();
  await expect(settings).toBeVisible();
  await settings
    .getByRole("button", { name: "設定を初期値に戻す", exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await outside(page);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(settings).toBeVisible();
  await expect(rate).toHaveValue("1.2");
  await outside(page);
  await expect(settings).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "設定・教材", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  await expect(rate).toHaveValue(original);
  await outside(page);
  for (const name of ["履歴", "モデル管理"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await outside(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name, exact: true })).toBeFocused();
  }
  await page.getByRole("button", { name: "1音で練習", exact: true }).click();
  const wizard = page.getByRole("dialog", { name: "1音の練習を選ぶ" });
  await wizard.getByRole("button", { name: "か行", exact: true }).click();
  await wizard.getByRole("button", { name: "あ行", exact: true }).click();
  await outside(page);
  await page.getByRole("button", { name: "1音で練習", exact: true }).click();
  await expect(
    wizard.getByRole("button", { name: "か行", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    wizard.getByRole("button", { name: "あ行", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});

test("試聴とマイク確認も外側クリックで閉じて音声とマイクを停止する", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const streams: MediaStream[] = [];
    const media: HTMLMediaElement[] = [];
    Object.assign(window, { outsideStreams: streams, outsideMedia: media });
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await getUserMedia(constraints);
      streams.push(stream);
      return stream;
    };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      media.push(this);
      return play.call(this);
    };
  });
  const stopped = () =>
    page.evaluate(() => {
      const w = window as unknown as {
        outsideStreams: MediaStream[];
        outsideMedia: HTMLMediaElement[];
      };
      return (
        w.outsideStreams.every((s) =>
          s.getTracks().every((t) => t.readyState === "ended"),
        ) && w.outsideMedia.every((m) => m.paused)
      );
    });
  await page.goto("/");
  await page
    .getByRole("button", { name: "1. 見本を試聴", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "見本の声と速さ" }),
  ).toBeVisible();
  await outside(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(stopped).toBe(true);
  await page
    .getByRole("button", { name: "2. マイクを調整して録音・再生", exact: true })
    .click();
  await page.getByRole("button", { name: "調整を始める", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { outsideStreams: MediaStream[] })
            .outsideStreams.length,
      ),
    )
    .toBeGreaterThan(0);
  await outside(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(stopped).toBe(true);
});
