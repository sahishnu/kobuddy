FROM node:22-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.18.3 --activate
COPY . .
RUN pnpm install --frozen-lockfile && pnpm exec turbo run build
EXPOSE 3000
CMD ["node", "apps/server/dist/index.js"]
