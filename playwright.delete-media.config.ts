import {defineConfig} from '@playwright/test';
import config from './playwright.config';
export default defineConfig({...config,testMatch:'delete-project-media.spec.ts',use:{...config.use,baseURL:'http://127.0.0.1:52857'},webServer:{command:'node node_modules/vite/bin/vite.js --config vite.client.config.ts --port 52857',url:'http://127.0.0.1:52857',reuseExistingServer:true}});

