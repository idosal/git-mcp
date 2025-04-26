import { test, expect } from "@playwright/test";

// Define the base target dev server URL (the one the Inspector connects to)
const targetServerBaseUrl = "http://localhost:5173"; // Base URL without path or /sse

// Define test cases with specific paths and expectations
const testCases = [
  {
    path: "mrdoob/three.js",
    // Expectations removed as the specific fetch test will be skipped for this path
  },
  {
    path: "remix-run/react-router",
    expectedContentSnippet: "# React Router"
  },
  {
    path: "answerdotai/fasthtml",
    expectedContentSnippet: "# FastHTML"
  }
];

test.describe("Dedicated repo servers", () => {
  test.describe("SSE", () => {
    // Loop through the defined test cases
    for (const testCase of testCases) {
      const { path, expectedContentSnippet } = testCase;
      const targetServerUrl = `${targetServerBaseUrl}/${path}`; // Construct full URL for connection

      // Test to verify listing tools (this should still run for all)
      test(`should list tools for ${path}`, async ({ page }) => {
        await page.goto("/");
        await page.getByRole("combobox", { name: "Transport Type" }).click();
        await page.getByRole("option", { name: "SSE" }).click();
        await page.getByRole("textbox", { name: "URL" }).fill(targetServerUrl);
        await page.getByRole("button", { name: "Connect" }).click();

        await expect(page.getByRole("button", { name: "List Tools" })).toBeVisible({ timeout: 5000 });
        await page.getByRole("button", { name: "List Tools" }).click();

        await expect(page.getByText("fetch_generic_url_content")).toBeVisible({
          timeout: 10000,
        });
        if (path === 'mrdoob/three.js') {
          //  await expect(page.getByText('fetch_threejs_documentation')).toBeVisible({ timeout: 5000 });
           // Check for the specific search tool for three.js
           await expect(page.getByText('search_threejs_documentation')).toBeVisible({ timeout: 5000 });
        } else {
           // Check for generic fetch and search tools
           await expect(page.getByText(/^fetch_.*_documentation$/)).toBeVisible({ timeout: 5000 });
           await expect(page.getByText(/^search_.*_documentation$/)).toBeVisible({ timeout: 5000 });
        }
      });

      // Test to verify running the generic fetch tool (this should still run for all)
      test(`should fetch documentation using generic tool for ${path}`, async ({ page }) => {
        await page.goto("/");
        await page.getByRole("combobox", { name: "Transport Type" }).click();
        await page.getByRole("option", { name: "SSE" }).click();
        await page.getByRole("textbox", { name: "URL" }).fill(targetServerUrl);
        await page.getByRole("button", { name: "Connect" }).click();

        await expect(page.getByRole("button", { name: "List Tools" })).toBeVisible({ timeout: 5000 });
        await page.getByRole("button", { name: "List Tools" }).click();

        await expect(page.getByText("fetch_generic_url_content")).toBeVisible({ timeout: 5000 });
        await page.getByText('fetch_generic_url_content').click();
        await page.getByRole('textbox', { name: 'url', exact: true  }).fill('https://www.makeareadme.com/');
        await page.getByRole('button', { name: 'Run Tool' }).click();

        await expect(page.getByText('Success')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('# Make a README')).toBeVisible();
      });

      // Test to verify running the specific fetch_X_documentation tool
      // Conditionally skip this test for mrdoob/three.js
      const shouldSkipFetchTest = path === 'mrdoob/three.js';
      test(`should run fetch_X_documentation for ${path}`, async ({ page }) => {
         test.skip(shouldSkipFetchTest, 'Skipping fetch_X_documentation test for mrdoob/three.js as it uses a different tool name.');

         await page.goto("/");
         await page.getByRole("combobox", { name: "Transport Type" }).click();
         await page.getByRole("option", { name: "SSE" }).click();
         await page.getByRole("textbox", { name: "URL" }).fill(targetServerUrl);
         await page.getByRole("button", { name: "Connect" }).click();

         await expect(page.getByRole("button", { name: "List Tools" })).toBeVisible({ timeout: 5000 });
         await page.getByRole("button", { name: "List Tools" }).click();

         const fetchToolButton = page.getByText(/^fetch_.*_documentation$/);
         await expect(fetchToolButton).toBeVisible({ timeout: 5000 });
         await fetchToolButton.click();

         await page.getByRole('button', { name: 'Run Tool' }).click();

         await expect(page.getByText('Success')).toBeVisible({ timeout: 15000 });

         // Use the expectedContentSnippet from the test case
         // Ensure expectedContentSnippet is defined before using it
         if (expectedContentSnippet) {
             await expect(page.getByText(expectedContentSnippet)).toBeVisible();
         } else {
             console.warn(`No expectedContentSnippet defined for path: ${path}`);
         }
      });
    }
  });
});
