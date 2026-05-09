document.addEventListener("DOMContentLoaded", () => {
  const githubUrlInput = document.getElementById("github-url")
  const convertBtn = document.getElementById("convert-btn")
  const loadingElement = document.getElementById("loading")
  const errorMessageElement = document.getElementById("error-message")
  const resultElement = document.getElementById("result")
  const resultLinkElement = document.getElementById("result-link")
  const reposListElement = document.getElementById("repos-list")
  const reposContainerElement = document.getElementById("repos-container")

  // Regular expressions for URL validation and parsing
  const githubRepoRegex = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+)(?:\/.*)?$/i
  const githubPagesRegex = /^(?:https?:\/\/)?([^/]+)\.github\.io\/([^/]+)(?:\/.*)?$/i
  const githubUserRegex = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/?$/i

  // Handle input on Enter key
  githubUrlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      processUrl()
    }
  })

  // Handle paste event
  githubUrlInput.addEventListener("paste", (e) => {
    // Use setTimeout to allow the paste to complete before processing
    setTimeout(() => {
      const pastedUrl = githubUrlInput.value.trim()
      if (pastedUrl) {
        const sanitizedUrl = sanitizeUrl(pastedUrl)
        githubUrlInput.value = sanitizedUrl
        processUrl()
      }
    }, 0)
  })

  // Handle button click
  convertBtn.addEventListener("click", processUrl)

  // Sanitize URL by removing tracking parameters, fragments, and normalizing
  function sanitizeUrl(url) {
    try {
      // Create URL object to easily manipulate parts
      const urlObj = new URL(url)

      // Remove common tracking parameters
      const paramsToRemove = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref", "source"]
      paramsToRemove.forEach((param) => urlObj.searchParams.delete(param))

      // For GitHub URLs, clean up paths
      if (urlObj.hostname === "github.com" || urlObj.hostname.endsWith(".github.io")) {
        const pathParts = urlObj.pathname.split("/")

        // If it's a GitHub repo with additional paths (blob, tree, etc.)
        if (pathParts.length > 3 && urlObj.hostname === "github.com") {
          // Keep only username and repo name
          urlObj.pathname = `/${pathParts[1]}/${pathParts[2]}`
        } else if (pathParts.length > 2 && urlObj.hostname.endsWith(".github.io")) {
          // For GitHub Pages, keep only the first path segment
          urlObj.pathname = `/${pathParts[1]}`
        }

        // Remove hash
        urlObj.hash = ""
      }

      // Return the cleaned URL without trailing slash
      return urlObj.toString().replace(/\/$/, "")
    } catch (e) {
      // If URL parsing fails, return the original URL
      return url
    }
  }

  // Main function to process the URL
  function processUrl() {
    const url = githubUrlInput.value.trim()

    // Reset UI state
    hideAllElements()

    if (!url) {
      showError("Please enter a GitHub URL")
      return
    }

    // Check if URL is a GitHub repository
    const repoMatch = url.match(githubRepoRegex)
    if (repoMatch) {
      const [, owner, repo] = repoMatch
      const gitMcpUrl = `https://gitmcp.io/${owner}/${repo}`
      showResult(gitMcpUrl)
      window.open(gitMcpUrl, "_blank")
      return
    }

    // Check if URL is a GitHub Pages site
    const pagesMatch = url.match(githubPagesRegex)
    if (pagesMatch) {
      const [, owner, repo] = pagesMatch
      const gitMcpUrl = `https://${owner}.gitmcp.io/${repo}`
      showResult(gitMcpUrl)
      window.open(gitMcpUrl, "_blank")
      return
    }

    // Check if URL is a GitHub user or organization
    const userMatch = url.match(githubUserRegex)
    if (userMatch) {
      const [, owner] = userMatch
      fetchUserRepositories(owner)
      return
    }

    // If none of the patterns match, just keep the sanitized URL in the input
    // No error message needed as per requirements
  }

  // Fetch repositories for a GitHub user or organization
  async function fetchUserRepositories(owner) {
    showLoading()

    try {
      const response = await fetch(`https://api.github.com/users/${owner}/repos?sort=updated&per_page=100`)

      if (!response.ok) {
        if (response.status === 404) {
          showError(`User or organization "${owner}" not found.`)
        } else {
          showError(`Error fetching repositories: ${response.statusText}`)
        }
        return
      }

      const repos = await response.json()

      if (repos.length === 0) {
        showError(`No public repositories found for "${owner}".`)
        return
      }

      displayRepositories(owner, repos)
    } catch (error) {
      showError(`Error: ${error.message}`)
    } finally {
      hideLoading()
    }
  }

  // Display the list of repositories
  function displayRepositories(owner, repos) {
    reposContainerElement.innerHTML = ""

    repos.forEach((repo) => {
      const li = document.createElement("li")
      const a = document.createElement("a")
      a.href = `https://gitmcp.io/${owner}/${repo.name}`
      a.textContent = repo.name
      a.target = "_blank"

      // Add click event to open in new tab
      a.addEventListener("click", (e) => {
        e.preventDefault()
        window.open(a.href, "_blank")
      })

      li.appendChild(a)

      if (repo.description) {
        const description = document.createElement("div")
        description.className = "repo-description"
        description.textContent = repo.description
        li.appendChild(description)
      }

      reposContainerElement.appendChild(li)
    })

    reposListElement.classList.remove("hidden")
  }

  // UI Helper Functions
  function hideAllElements() {
    errorMessageElement.classList.add("hidden")
    resultElement.classList.add("hidden")
    reposListElement.classList.add("hidden")
    loadingElement.classList.add("hidden")
  }

  function showError(message) {
    errorMessageElement.textContent = message
    errorMessageElement.classList.remove("hidden")
  }

  function showResult(url) {
    resultLinkElement.href = url
    resultLinkElement.textContent = url
    resultElement.classList.remove("hidden")
  }

  function showLoading() {
    loadingElement.classList.remove("hidden")
  }

  function hideLoading() {
    loadingElement.classList.add("hidden")
  }
})
