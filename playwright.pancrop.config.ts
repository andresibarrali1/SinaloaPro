import { defineConfig } from "@playwright/test";
import config from "./playwright.config";
export default defineConfig({ ...config, testMatch: "event-pan-crop.spec.ts" });
