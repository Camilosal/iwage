FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Ensure upload folder exists (required by @strapi/provider-upload-local)
RUN mkdir -p public/uploads
RUN npm run build
# tsc does not copy .json content-type schemas into dist/, but Strapi
# (production) loads them from dist/src/api/*/content-types/*/schema.json.
# Copy them over, preserving the directory structure.
RUN cd src && find . -name "schema.json" -exec sh -c 'mkdir -p "$(dirname "../dist/src/$1")" && cp "$1" "../dist/src/$1"' _ {} \;
EXPOSE 1337
CMD ["npm", "run", "start"]
