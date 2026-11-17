import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests',testMatch:'mp3-export.spec.ts',workers:1,use:{baseURL:'http://127.0.0.1:52950'},webServer:{command:'node node_modules/vite/bin/vite.js --config vite.client.config.ts --port 52950 --host 127.0.0.1',url:'http://127.0.0.1:52950'},projects:[{name:'edge',use:{channel:'msedge'}}]});
