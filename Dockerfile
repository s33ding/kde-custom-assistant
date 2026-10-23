# kde-custom-assistant
FROM node:22-alpine

# Small init so signals (SIGTERM) are handled cleanly on restart/stop
RUN apk add --no-cache tini

WORKDIR /app

# Install production deps first (better layer caching)
COPY package.json ./
RUN npm install --omit=dev --no-fund --no-audit

# App source
COPY server ./server
COPY public ./public

ENV NODE_ENV=production
ENV PORT=58829
EXPOSE 58829

# Container-internal healthcheck hits the health endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||58829)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server/index.js"]
