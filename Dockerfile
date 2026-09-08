FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.mjs worker.mjs state-validation.mjs bootstrap.js shared-workspace.js app.js sync.js share.js index.html share.html styles.css details.css calendar.css dashboard.css production.css sync.css ./
COPY vendor ./vendor
ENV HOST=0.0.0.0 PORT=3000 DATA_DIR=/data NODE_ENV=production
RUN mkdir /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "server.mjs"]
