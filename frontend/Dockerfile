FROM node:20-slim AS build
WORKDIR /app
COPY package.json yarn.lock* package-lock.json* ./
# --legacy-peer-deps: this project's React 19 + several Radix UI packages
# have peer-dependency ranges that don't perfectly line up yet; npm's default
# strict ERESOLVE check blocks the install even though the versions are
# actually compatible in practice. yarn doesn't have this problem, hence the
# yarn-first branch below.
RUN if [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    else npm install --legacy-peer-deps; fi
COPY . .
# Empty REACT_APP_BACKEND_URL => frontend calls same-origin "/api/...";
# nginx.conf below proxies that to the backend container. This avoids baking
# a hardcoded host/port into the built JS, which would break offline
# portability across different machines/ports.
ENV REACT_APP_BACKEND_URL=""
# GENERATE_SOURCEMAP=false and DISABLE_ESLINT_PLUGIN=true are the two
# standard, well-documented memory reductions for CRA/craco production
# builds — source-map generation and the ESLint webpack plugin are the two
# biggest avoidable memory costs in this exact build step.
ENV GENERATE_SOURCEMAP=false
ENV DISABLE_ESLINT_PLUGIN=true
ENV NODE_OPTIONS="--max-old-space-size=2048"
RUN if [ -f yarn.lock ]; then yarn build; else npm run build; fi

FROM nginx:1.27-alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
