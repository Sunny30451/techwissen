FROM node:24.18.1-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY src ./src
COPY content ./content
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
