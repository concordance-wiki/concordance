# The turnkey image: the concordance preset (command line and every official
# plugin) on Node.js LTS with headless LibreOffice, run as an unprivileged user.
#
#   docker run --rm -v "$PWD:/wiki" concordancewiki/concordance build
#
# Stage 1 compiles the monorepo and extracts the preset with its production
# dependencies into one self-contained folder; stage 2 copies that folder onto a
# fresh base image so that the build toolchain never reaches the published image.

ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS build
RUN npm install --global pnpm@10.34.5
WORKDIR /src
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build
# --legacy: the workspace does not inject its packages, which the default deploy requires.
RUN pnpm --filter concordance deploy --legacy --prod /out

FROM ${NODE_IMAGE}
ARG VERSION=0.0.0
LABEL org.opencontainers.image.title="Concordance" \
      org.opencontainers.image.description="Turns git repositories of markdown into a wiki that shows where every business word is used." \
      org.opencontainers.image.source="https://github.com/concordance-wiki/concordance" \
      org.opencontainers.image.documentation="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/getting-started.md" \
      org.opencontainers.image.licenses="GPL-3.0-or-later" \
      org.opencontainers.image.version="${VERSION}"

# git and ca-certificates: the build clones the declared sources over https.
# libreoffice-core, -writer, -impress, -calc: headless conversion of docx, pptx
#   and xlsx to PDF (core alone ships no import filter; the common package it
#   depends on provides the soffice command the plugin detects).
# fonts-liberation, -crosextra-carlito, -crosextra-caladea: metric-compatible
#   substitutes for the fonts office documents are usually set in (Arial, Times
#   New Roman, Courier New, Calibri, Cambria), so that pagination is preserved.
# fonts-dejavu: the fallback for every other face, and the default of LibreOffice.
RUN apt-get update \
  && apt-get install --yes --no-install-recommends \
    ca-certificates \
    git \
    libreoffice-core \
    libreoffice-writer \
    libreoffice-impress \
    libreoffice-calc \
    fonts-dejavu \
    fonts-liberation \
    fonts-crosextra-carlito \
    fonts-crosextra-caladea \
  && rm -rf /var/lib/apt/lists/*

# The base image already owns uid 1000 as "node"; the image runs as that uid under
# the tool's name so that a bind mount from a default Linux desktop user stays writable.
RUN usermod --login concordance --home /home/concordance --move-home node \
  && groupmod --new-name concordance node \
  && mkdir /wiki \
  && chown concordance:concordance /wiki

COPY --from=build --chown=concordance:concordance /out /opt/concordance
RUN chmod 755 /opt/concordance/bin/concordance.js \
  && ln -s /opt/concordance/bin/concordance.js /usr/local/bin/concordance \
  && ln -s /opt/concordance/bin/concordance.js /usr/local/bin/conc

# SOURCE_DATE_EPOCH is deliberately not set: the caller pins the timestamp of the
# outputs when reproducibility is wanted (-e SOURCE_DATE_EPOCH=0).
ENV HOME=/home/concordance
USER concordance
WORKDIR /wiki
ENTRYPOINT ["concordance"]
CMD ["--help"]
