import {defineConfig} from '@playwright/test';
import config from './playwright.config';
export default defineConfig({...config,testMatch:'overlap-crossfade.spec.ts',use:{...config.use,baseURL:'http://127.0.0.1:52869'},webServer:{command:'node node_modules/vite/bin/vite.js --config vite.client.config.ts --port 52869',url:'http://127.0.0.1:52869',reuseExistingServer:true}});
