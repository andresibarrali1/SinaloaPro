import {defineConfig,devices} from '@playwright/test';
// Sonda de rendimiento de la interfaz: no entra en la suite (el `testMatch` es solo este archivo) y se ejecuta a
// mano con `npm run test:perf`. Mide fotogramas reales del navegador mientras reproduce, mientras se arrastra la
// aguja y en reposo después de una edición (que es cuando corre el autoguardado).
export default defineConfig({
 testDir:'tests',
 testMatch:['perf.spec.ts'],
 timeout:300000,
 fullyParallel:false,
 workers:1,
 use:{baseURL:'http://127.0.0.1:5173',viewport:{width:1440,height:900},trace:'off'},
 webServer:{command:'npm run dev',url:'http://127.0.0.1:5173',reuseExistingServer:true,timeout:60000},
 projects:[{name:'chrome',use:{...devices['Desktop Chrome'],channel:'chrome'}}],
 reporter:[['list']],
});
