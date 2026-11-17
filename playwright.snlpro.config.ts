import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests',testMatch:'snlpro.spec.ts',workers:1,use:{baseURL:'http://127.0.0.1:52931',viewport:{width:1440,height:900}},webServer:{command:'node node_modules/vite/bin/vite.js --config vite.client.config.ts --port 52931 --host 127.0.0.1',url:'http://127.0.0.1:52931'},projects:[{name:'edge',use:{channel:'msedge'}}]});
