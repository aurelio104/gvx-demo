FROM node:20-bullseye

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json tsconfig.json ./
COPY src ./src

RUN npm install && npm run build

ENV PORT=3001
ENV FFMPEG_BIN=ffmpeg

EXPOSE 3001

CMD ["npm", "start"]
