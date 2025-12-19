FROM node:25-alpine

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install

COPY ./app ./app

CMD ["npm", "start"]
