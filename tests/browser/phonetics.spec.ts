import { expect, test } from "@playwright/test";

test("しくみガイドで場所・方法・拍を見比べ、閉じてもお題と一時停止を保つ", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "練習へ進む", exact: true }).click();
  await page.getByRole("button", { name: "設定・教材", exact: true }).click();
  await page.getByLabel("見本音声", { exact: true }).selectOption("off");
  await page.getByLabel("手動で録音開始・終了").check();
  await page.getByRole("button", { name: "設定を適用", exact: true }).click();
  await page.getByRole("button", { name: "練習を始める", exact: true }).click();
  const card = page.getByRole("region", { name: "発音練習", exact: true });
  await expect(card).toHaveAttribute("data-phase", "waiting");
  const prompt = await card.locator("h1").innerText();
  await page.getByRole("button", { name: "発音のコツ", exact: true }).click();
  const tips = page.getByRole("dialog", { name: "発音のコツ", exact: true });
  await tips.getByRole("button", { name: /発音のしくみガイド/ }).click();
  const guide = page.getByRole("dialog", {
    name: "発音のしくみガイド",
    exact: true,
  });
  await expect(card).toHaveAttribute("data-phase", "paused");
  await expect(
    guide.getByRole("button", { name: "音の作り方", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await guide.getByRole("button", { name: "音を比べる", exact: true }).click();
  await guide
    .getByRole("button", { name: "場所：て／け", exact: true })
    .click();
  await expect(guide.getByRole("img", { name: /^ての出だし/ })).toBeVisible();
  await expect(guide.getByRole("img", { name: /^けの出だし/ })).toBeVisible();
  const tongues = guide.locator(".art-tongue");
  expect(await tongues.nth(0).getAttribute("d")).not.toBe(
    await tongues.nth(1).getAttribute("d"),
  );
  await guide
    .getByRole("button", { name: "2. 母音へつなぐ", exact: true })
    .click();
  await expect(guide.getByRole("img", { name: /^ての母音/ })).toBeVisible();
  expect(await tongues.nth(0).getAttribute("d")).toBe(
    await tongues.nth(1).getAttribute("d"),
  );

  await guide.getByLabel("比べる音 1", { exact: true }).selectOption("し");
  await guide.getByLabel("比べる音 2", { exact: true }).selectOption("ち");
  await expect(guide.getByRole("img").first()).toHaveAccessibleName(
    /^しの出だし/,
  );
  await expect(guide.locator(".phonetics-features .is-different")).toHaveCount(
    2,
  );
  await guide
    .getByRole("button", { name: "声帯の振動：か／が", exact: true })
    .click();
  await expect(
    guide.locator(".phonetics-features .is-different").first(),
  ).toContainText("声帯の振動");
  await guide
    .getByRole("button", { name: "母音：あ／い", exact: true })
    .click();
  await expect(
    guide.getByRole("button", { name: "2. 母音へつなぐ", exact: true }),
  ).toBeDisabled();
  await guide.getByRole("button", { name: "音の作り方", exact: true }).click();
  for (const [name, sound] of [
    ["破裂音", "か"],
    ["摩擦音", "さ"],
    ["破擦音", "つ"],
    ["鼻音", "ま"],
    ["弾き音", "ら"],
    ["接近音・半母音", "や"],
    ["母音", "あ"],
  ]) {
    await guide.getByRole("button", { name: new RegExp(`^${name}`) }).click();
    await expect(guide.getByRole("img").first()).toHaveAccessibleName(
      new RegExp(`^${sound}の`),
    );
  }
  await guide.getByRole("button", { name: /^破擦音/ }).click();
  await guide
    .getByRole("button", { name: "2. すき間に息を通す", exact: true })
    .click();
  await expect(guide.getByRole("img").first()).toHaveAccessibleName(
    /^つの摩擦の段階/,
  );
  await expect(guide.locator(".art-contact")).toHaveAttribute("fill", "none");
  await guide.getByRole("button", { name: "3. 「う」へ", exact: true }).click();
  await expect(guide.getByRole("img").first()).toHaveAccessibleName(
    /^つの母音/,
  );
  await guide.getByRole("button", { name: "ち", exact: true }).click();
  await expect(guide.getByRole("img").first()).toHaveAccessibleName(
    /^ちの出だし/,
  );

  await guide.getByRole("button", { name: "口の場所", exact: true }).click();
  await guide.getByRole("button", { name: /上あごの奥/ }).click();
  await expect(guide.getByRole("img").first()).toHaveAccessibleName(
    /^けの出だし/,
  );
  await guide.getByRole("button", { name: /のど/ }).click();
  await expect(guide.getByText(/図ではのどの内部を省略/)).toBeVisible();
  await guide.getByRole("button", { name: "声と拍", exact: true }).click();

  await expect(guide.locator('[aria-label="き・っ・て、3拍"]')).toBeVisible();
  await expect(guide.locator('[aria-label="きゃ、1拍"]')).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("r");
  await expect(card.locator("h1")).toHaveText(prompt);
  await page.keyboard.press("Escape");
  await expect(guide).toBeHidden();
  await expect(tips).toBeVisible();
  await expect(
    tips.getByRole("button", { name: /発音のしくみガイド/ }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(card).toHaveAttribute("data-phase", "paused");
  await expect(card.locator("h1")).toHaveText(prompt);
});

test("スマートフォン幅の音選びからガイドを開き、外側クリックで下書きに戻る", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "練習へ進む", exact: true }).click();
  await page.getByRole("button", { name: "1音で練習", exact: true }).click();
  await page
    .getByRole("button", { name: "次へ：発音のコツを見る", exact: true })
    .click();
  const wizard = page.getByRole("dialog", {
    name: "1音の練習を選ぶ",
    exact: true,
  });
  await wizard.getByRole("button", { name: /発音のしくみガイド/ }).click();
  const guide = page.getByRole("dialog", {
    name: "発音のしくみガイド",
    exact: true,
  });
  for (const chapter of ["音を比べる", "音の作り方", "口の場所", "声と拍"]) {
    await guide.getByRole("button", { name: chapter, exact: true }).click();
    expect(await guide.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
  }
  await page.mouse.click(2, 2);
  await expect(guide).toBeHidden();
  await expect(
    wizard.getByRole("button", { name: /発音のしくみガイド/ }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "この音で練習する", exact: true }),
  ).toBeVisible();
});

for (const width of [1280, 390]) {
  test(`練習カードからしくみガイドを直接開き、閉じると同じお題で待つ（${width}px）`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await page.getByRole("button", { name: "練習へ進む", exact: true }).click();
    await page.getByRole("button", { name: "設定・教材", exact: true }).click();
    await page.getByLabel("見本音声", { exact: true }).selectOption("off");
    await page.getByLabel("手動で録音開始・終了").check();
    await page.getByRole("button", { name: "設定を適用", exact: true }).click();
    const card = page.getByRole("region", { name: "発音練習", exact: true });
    const entry = card.getByRole("button", {
      name: "発音のしくみガイド",
      exact: true,
    });
    const tips = card.getByRole("button", { name: "発音のコツ", exact: true });
    const left = await tips.boundingBox();
    const right = await entry.boundingBox();
    expect(Math.abs(left!.y - right!.y)).toBeLessThan(1);
    expect(right!.x).toBeGreaterThan(left!.x + left!.width);
    expect(await card.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
    await page
      .getByRole("button", { name: "練習を始める", exact: true })
      .click();
    await page.getByRole("button", { name: "録音開始", exact: true }).click();
    await expect(card).toHaveAttribute("data-phase", "recording");
    const prompt = await card.locator("h1").innerText();
    await entry.click();
    const guide = page.getByRole("dialog", {
      name: "発音のしくみガイド",
      exact: true,
    });
    await expect(guide).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await expect(card).toHaveAttribute("data-phase", "paused");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("r");
    await expect(card.locator("h1")).toHaveText(prompt);
    await page.keyboard.press("Escape");
    await expect(guide).toBeHidden();
    await expect(entry).toBeFocused();
    await expect(card).toHaveAttribute("data-phase", "paused");
    await entry.click();
    await page.mouse.click(2, 2);
    await expect(guide).toBeHidden();
    await expect(entry).toBeFocused();
    await expect(card.locator("h1")).toHaveText(prompt);
  });
}

for (const width of [1280, 390]) {
  test(`音の分類は行の全音・拗音・ザ行の両方の作り方を確認できる（${width}px）`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "練習へ進む", exact: true }).click();
    await page
      .getByRole("button", { name: "発音のしくみガイド", exact: true })
      .click();
    const guide = page.getByRole("dialog", {
      name: "発音のしくみガイド",
      exact: true,
    });
    const members = guide.getByRole("group", {
      name: "この仲間の音",
      exact: true,
    });
    await expect(
      members
        .getByRole("group", { name: "カ行", exact: true })
        .getByRole("button"),
    ).toHaveText(["か", "き", "く", "け", "こ"]);
    await expect(
      members
        .getByRole("group", { name: "タ行", exact: true })
        .getByRole("button"),
    ).toHaveText(["た", "て", "と"]);
    await members.getByRole("button", { name: "く", exact: true }).click();
    await expect(guide.getByRole("img").first()).toHaveAccessibleName(
      /^くの出だし/,
    );
    await members.screenshot({ path: `.local/phonetics-stop-${width}.png` });
    await guide.getByRole("button", { name: /^鼻音/ }).click();
    await expect(
      members
        .getByRole("group", { name: "マ行", exact: true })
        .getByRole("button"),
    ).toHaveText(["ま", "み", "む", "め", "も"]);
    await expect(
      members
        .getByRole("group", { name: "ナ行", exact: true })
        .getByRole("button"),
    ).toHaveText(["な", "に", "ぬ", "ね", "の"]);
    await members.getByText("拗音も見る", { exact: false }).click();
    await members.getByRole("button", { name: "みゅ", exact: true }).click();
    await expect(guide.getByRole("img").first()).toHaveAccessibleName(
      /^みゅの出だし/,
    );
    await expect(guide.locator(".phonetics-current")).toContainText(
      "唇を閉じたまま",
    );
    await members.screenshot({ path: `.local/phonetics-nasal-${width}.png` });
    for (const kind of ["摩擦音", "破擦音"]) {
      await guide.getByRole("button", { name: new RegExp(`^${kind}`) }).click();
      await expect(
        members
          .getByRole("group", { name: "ザ行", exact: true })
          .getByRole("button"),
      ).toHaveText(["ざ", "じ", "ず", "ぜ", "ぞ"]);
      await members.getByRole("button", { name: "じ", exact: true }).click();
      if (kind === "摩擦音") {
        await expect(guide.locator(".art-contact")).toHaveAttribute(
          "fill",
          "none",
        );
        await expect(guide.locator(".phonetics-current")).toContainText(
          "すき間",
        );
      } else {
        await expect(guide.locator(".art-contact")).not.toHaveAttribute(
          "fill",
          "none",
        );
        await expect(guide.locator(".phonetics-current")).toContainText("閉じ");
      }
    }
    expect(await guide.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
    await page.keyboard.press("Escape");
    await expect(guide).toBeHidden();
  });
}
