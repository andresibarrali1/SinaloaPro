import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests',timeout:90000,testMatch:'tracking-ui.spec.ts',workers:1,use:{baseURL:'http://127.0.0.1:52956',viewport:{width:1280,height:900}},webServer:{command:'node node_modules/vite/bin/vite.js --config vite.client.config.ts --port 52956 --host 127.0.0.1',url:'http://127.0.0.1:52956'},projects:[{name:'edge',use:{channel:'msedge'}}]});

