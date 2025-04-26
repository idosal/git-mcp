import { FullConfig } from '@playwright/test';
import fetch from 'node-fetch';

// URL of your running worker during tests
const workerUrl = 'http://localhost:5173'; 
const setupEndpoint = `${workerUrl}/api/setup-r2-for-tests`;

async function globalSetup(config: FullConfig) {
  console.log('--- Starting Global Setup: Populating R2 via Endpoint ---');

  // Add a delay to allow the web server to fully start
  // Playwright's webServer.url check confirms availability, but sometimes 
  // internal initialization might still be happening.
  console.log('Waiting 3 seconds for server to stabilize...');
  await new Promise(resolve => setTimeout(resolve, 3000)); 

  try {
    console.log(`Sending POST request to ${setupEndpoint}...`);
    const response = await fetch(setupEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add any other headers required by your endpoint if necessary
      },
      // No body needed as the endpoint knows what to do
    });

    const responseBodyText = await response.text(); // Read body once
    console.log(`Global Setup: Received response status ${response.status}`);
    console.log(`Global Setup: Received response body: ${responseBodyText}`);


    if (!response.ok) {
      throw new Error(`Failed to setup R2 via endpoint: ${response.status} ${response.statusText} - Body: ${responseBodyText}`);
    }

    // Try parsing JSON only if response is ok
    try {
        const result = JSON.parse(responseBodyText); 
        console.log('Global Setup: R2 Population Result:', result.message);
    } catch (parseError) {
        console.error("Global Setup: Failed to parse JSON response from setup endpoint.");
        throw new Error(`Failed to parse JSON response: ${parseError} - Original Body: ${responseBodyText}`);
    }
    
    console.log('--- Global Setup Finished Successfully ---');

  } catch (error) {
    console.error('Error during global setup (calling R2 population endpoint):', error);
    // Throw error to stop test execution if setup fails critically
    throw new Error(`Global setup failed: ${error}`);
  }
}

export default globalSetup; 