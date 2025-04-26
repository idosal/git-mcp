import { test, expect } from '@playwright/test';

// Define the base target dev server URL (the one the Inspector connects to)
const targetServerBaseUrl = 'http://localhost:5173'; // Base URL without path or /sse



test.describe('Dedicated repo servers', () => {
    // Define the paths for parameterization
    const targetPaths = [
        'mrdoob/three.js',
        'remix-run/react-router', // Corrected path based on user prompt
        'answerdotai/fasthtml'
    ];

  // Use a loop to create tests for each path
  for (const path of targetPaths) {
    const targetServerUrl = `${targetServerBaseUrl}/${path}`; // Construct full URL for connection
    
    // Create a test for each path
    test(`should list tools for ${path}`, async ({ page }) => {
      // 1. Go to the local Inspector UI (baseURL is http://localhost:5174)
      await page.goto('/');

      // 2. Configure connection within the Inspector UI for this specific path
      await page.getByRole('combobox', { name: 'Transport Type' }).click();
      await page.getByRole('option', { name: 'SSE' }).click();
    //   await page.getByRole('textbox', { name: 'URL' }).click();
    //   await page.getByRole('textbox', { name: 'URL' }).press('ControlOrMeta+a');
      await page.getByRole('textbox', { name: 'URL' }).fill(targetServerUrl); 
      await page.getByRole('button', { name: 'Connect' }).click();

      await page.getByRole('button', { name: 'List Tools' }).click();

      await expect(page.getByText('fetch_generic_url_content')).toBeVisible({ timeout: 15000 }); // Increased timeout
    });
  }
}); 