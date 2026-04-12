FROM node:20-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY templates ./templates

EXPOSE 8080

CMD ["npm", "start"]
