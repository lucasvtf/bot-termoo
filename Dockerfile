FROM node:20-alpine

RUN apk add --no-cache fontconfig ttf-liberation

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production
CMD ["node", "src/index.js"]
