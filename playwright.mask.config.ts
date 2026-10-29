import {defineConfig} from '@playwright/test';
import config from './playwright.pancrop.config';
export default defineConfig({...config,use:{...config.use,baseURL:'http://127.0.0.1:52843'},webServer:{command:'node node_modules/vite/bin/vite.js --config vite.client.config.ts --port 52843',url:'http://127.0.0.1:52843',reuseExistingServer:true}});

