import {defineConfig} from '@playwright/test';
import config from './playwright.config';
export default defineConfig({...config,testMatch:'compact-track.spec.ts',use:{...config.use,baseURL:'http://127.0.0.1:52877'},webServer:{command:'node node_modules/vite/bin/vite.js --config vite.client.config.ts --port 52877',url:'http://127.0.0.1:52877',reuseExistingServer:true}});

