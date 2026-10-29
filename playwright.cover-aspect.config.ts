import {defineConfig} from '@playwright/test';
import config from './playwright.config';
export default defineConfig({...config,testMatch:'cover-aspect.spec.ts',use:{...config.use,baseURL:'http://127.0.0.1:52861'},webServer:{command:'node node_modules/vite/bin/vite.js --config vite.client.config.ts --port 52861',url:'http://127.0.0.1:52861',reuseExistingServer:true}});

