FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install

COPY ./src ./src

CMD ["npm", "start"]
