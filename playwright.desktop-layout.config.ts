import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests',testMatch:'desktop-layout.spec.ts',workers:1,use:{baseURL:'http://127.0.0.1:52916',viewport:{width:1920,height:1010}},webServer:{command:'node node_modules/vite/bin/vite.js preview --config vite.client.config.ts --outDir sinaloa-tauri/dist --port 52916 --strictPort --host 127.0.0.1',url:'http://127.0.0.1:52916',reuseExistingServer:false},projects:[{name:'edge',use:{channel:'msedge'}}]});


