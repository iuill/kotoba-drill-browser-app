FROM oven/bun:1.4.0 AS bun

FROM node:26.7.0-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends bash ca-certificates curl git openssh-client ripgrep unzip \
    && rm -rf /var/lib/apt/lists/*


# ブラウザテストのOS依存も公開後14日以上の固定スナップショットから導入する。
ARG DEBIAN_SNAPSHOT=20260821T000000Z
RUN printf 'deb [check-valid-until=no] https://snapshot.debian.org/archive/debian/%s/ bookworm main\n' "$DEBIAN_SNAPSHOT" > /tmp/browser-deps.list \
    && apt-get -o Dir::Etc::sourcelist=/tmp/browser-deps.list -o Dir::Etc::sourceparts=- update \
    && apt-get -o Dir::Etc::sourcelist=/tmp/browser-deps.list -o Dir::Etc::sourceparts=- install -y --no-install-recommends \
       libglib2.0-0 libnspr4 libnss3 libatk1.0-0 libatk-bridge2.0-0 libdbus-1-3 \
       libx11-6 libxcomposite1 libxdamage1 libxext6 libxfixes3 libxrandr2 libgbm1 \
       libxcb1 libxkbcommon0 libasound2 libatspi2.0-0 fontconfig fonts-noto-cjk ffmpeg \
    && rm -rf /var/lib/apt/lists/* /tmp/browser-deps.list

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
RUN ln -s bun /usr/local/bin/bunx

ARG CLAUDE_CODE_VERSION=2.1.239
# 選定日2026-09-05から14日以上前のnpm公開版に限定する（間接依存も対象）。
ARG NPM_RELEASE_CUTOFF=2026-08-22T00:00:00Z
RUN npm install --global --before="${NPM_RELEASE_CUTOFF}" --allow-scripts=@anthropic-ai/claude-code \
    "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}"

ENV LANG=C.UTF-8
USER node
RUN mkdir -p /home/node/.codex /home/node/.claude /home/node/.config/gh
