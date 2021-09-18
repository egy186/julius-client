# @egy186/julius-client

[![Build](https://github.com/egy186/julius-client/actions/workflows/build.yml/badge.svg)](https://github.com/egy186/julius-client/actions/workflows/build.yml)

Node.js client for [Julius](https://julius.osdn.jp/).

## Usage

Start Julius as a module mode.

```sh
julius -C conf.jconf -module
```

Then connect from `@egy186/julius-client`.

```sh
npm install @egy186/julius-client
npm exec ts-node node_modules/@egy186/julius-client/example.ts
```
