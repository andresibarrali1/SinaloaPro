import {defineConfig} from '@playwright/test';
import config from './playwright.config';
export default defineConfig({...config,testMatch:'premium-pack.spec.ts',use:{...config.use,viewport:{width:1440,height:980},baseURL:'http://127.0.0.1:52892'},webServer:{command:'node node_modules/vite/bin/vite.js --config vite.client.config.ts --port 52892',url:'http://127.0.0.1:52892',reuseExistingServer:true}});
