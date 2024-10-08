FROM node:22.5-alpine3.20
WORKDIR /app
COPY ./ ./
RUN npm install
EXPOSE 3000
CMD ["npm", "start"]
