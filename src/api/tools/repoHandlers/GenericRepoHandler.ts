import type { RepoData } from "../../../shared/repoData.js";
import type { RepoHandler, Tool } from "./RepoHandler.js";
import { z } from "zod";
import {
  fetchDocumentation,
  searchRepositoryDocumentation,
  searchRepositoryCode,
  fetchUrlContent,
} from "../commonTools.js";

class GenericRepoHandler implements RepoHandler {
  name = "generic";
  getTools(_: RepoData, env?: any): Array<Tool> {
    console.debug("Creating tools for docs page");

    return [
      {
        name: "match_common_libs_owner_repo_mapping",
        description:
          "Match a library name to an owner/repo. Don't use it if you have an owner and repo already. Use this first if only a library name was provided. If found - you can use owner and repo to call other tools. If not found - try to use the library name directly in other tools.",
        paramsSchema: {
          library: z
            .string()
            .describe(
              "The name of the library to try and match to an owner/repo.",
            ),
        },
        cb: async ({ library }: { library: string }) => {
          const repoMapping = await fetchRepoMapping();
          if (!library) {
            return {
              content: [
                {
                  type: "text",
                  text: "No library name provided",
                },
              ],
            };
          }
          const repo = repoMapping[library?.toLowerCase()];
          if (!repo) {
            return {
              content: [
                {
                  type: "text",
                  text: `No owner/repo found for ${library}`,
                },
              ],
            };
          }
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  library,
                  owner: repo.split("/")[0],
                  repo: repo.split("/")[1],
                }),
              },
            ],
          };
        },
      },
      {
        name: "fetch_generic_documentation",
        description:
          "Fetch documentation for any GitHub repository by providing owner and project name",
        paramsSchema: {
          owner: z
            .string()
            .describe("The GitHub repository owner (username or organization)"),
          repo: z.string().describe("The GitHub repository name"),
        },
        cb: async ({ owner, repo }) => {
          const repoData: RepoData = {
            owner,
            repo,
            urlType: "github",
            host: "gitmcp.io",
          };
          return fetchDocumentation({ repoData, env });
        },
      },
      {
        name: "search_generic_documentation",
        description:
          "Semantically search in documentation for any GitHub repository by providing owner, project name, and search query. Useful for specific queries. Don't call if you already used fetch_generic_documentation on this owner and project name.",
        paramsSchema: {
          owner: z
            .string()
            .describe("The GitHub repository owner (username or organization)"),
          repo: z.string().describe("The GitHub repository name"),
          query: z
            .string()
            .describe("The search query to find relevant documentation"),
        },
        cb: async ({ owner, repo, query }) => {
          const repoData: RepoData = {
            owner,
            repo,
            urlType: "github",
            host: "gitmcp.io",
          };
          return searchRepositoryDocumentation({ repoData, query, env });
        },
      },
      {
        name: "search_generic_code",
        description:
          "Search for code in any GitHub repository by providing owner, project name, and search query. Returns matching files and code snippets. Supports pagination with 30 results per page.",
        paramsSchema: {
          owner: z
            .string()
            .describe("The GitHub repository owner (username or organization)"),
          repo: z.string().describe("The GitHub repository name"),
          query: z
            .string()
            .describe("The search query to find relevant code files"),
          page: z
            .number()
            .optional()
            .describe(
              "Page number to retrieve (starting from 1). Each page contains 30 results.",
            ),
        },
        cb: async ({ owner, repo, query, page }) => {
          const repoData: RepoData = {
            owner,
            repo,
            urlType: "github",
            host: "gitmcp.io",
          };
          return searchRepositoryCode({ repoData, query, page, env });
        },
      },
      {
        name: "fetch_url_content",
        description:
          "Fetch content from a URL. Use this to retrieve referenced documents or pages that were mentioned in previously fetched documentation.",
        paramsSchema: {
          url: z.string().describe("The URL of the document or page to fetch"),
        },
        cb: async ({ url }) => {
          return fetchUrlContent({ url, env });
        },
      },
    ];
  }

  async fetchDocumentation({
    repoData,
    env,
  }: {
    repoData: RepoData;
    env?: any;
  }): Promise<{
    fileUsed: string;
    content: { type: "text"; text: string }[];
  }> {
    return await fetchDocumentation({ repoData, env });
  }

  async searchRepositoryDocumentation({
    repoData,
    query,
    env,
  }: {
    repoData: RepoData;
    query: string;
    env?: any;
  }): Promise<{
    searchQuery: string;
    content: { type: "text"; text: string }[];
  }> {
    return await searchRepositoryDocumentation({ repoData, query, env });
  }
}

let genericRepoHandler: GenericRepoHandler;
export function getGenericRepoHandler(): GenericRepoHandler {
  if (!genericRepoHandler) {
    genericRepoHandler = new GenericRepoHandler();
  }
  return genericRepoHandler;
}

async function fetchRepoMapping(): Promise<
  Record<string, `${string}/${string}`>
> {
  return mappingCaseInsensitive;
}

const mapping = {
  Eleventy: "11ty/11ty-website",
  fQuery: "41y08h/fquery",
  NuQS: "47ng/nuqs",
  "Dog Breed Classifier": "7AM7/Dog-Breed-Classifier-With-Flask",
  Adyen: "Adyen/adyen-web",
  AgentOps: "AgentOps-AI/agentops",
  AutoHotkey: "AutoHotkey/AutoHotkeyDocs",
  Mongoose: "Automattic/mongoose",
  Avalonia: "AvaloniaUI/Avalonia",
  "Azure SDK for Go": "Azure/azure-sdk-for-go",
  "Babylon.js": "BabylonJS/Documentation",
  BetterCall: "Bekacru/better-call",
  LiteLLM: "BerriAI/litellm",
  "node-rdkafka": "Blizzard/node-rdkafka",
  DegenBot: "BowTiedDevil/degenbot",
  "Atomic Agents": "BrainBlend-AI/atomic-agents",
  Chainlit: "Chainlit/chainlit",
  ComfyUI: "Comfy-Org/docs",
  Composio: "ComposioHQ/composio",
  CopilotKit: "CopilotKit/CopilotKit",
  Loguru: "Delgan/loguru",
  DevClad: "DevClad-Inc/devclad",
  Dice: "DiceDB/dice",
  "Semi Design": "DouyinFE/semi-design",
  "ERC-3643": "ERC-3643/documentation",
  Effect: "tim-smart/effect-io-ai",
  "Vite Ruby": "ElMassimo/vite_ruby",
  "Acts As Tenant": "ErwinM/acts_as_tenant",
  FFmpeg: "FFmpeg/FFmpeg",
  Fabric: "FabricMC/fabric-docs",
  Comlink: "GoogleChromeLabs/comlink",
  Puter: "HeyPuter/puter",
  "pdf-lib": "Hopding/pdf-lib",
  Exposed: "JetBrains/Exposed",
  "IntelliJ Platform SDK": "JetBrains/intellij-sdk-docs",
  Kotlin: "JetBrains/kotlin-web-site",
  "Backpack for Laravel": "Laravel-Backpack/docs",
  "Legend State": "LegendApp/legend-state",
  Logtalk: "LogtalkDotOrg/logtalk3",
  "React Native Sortables": "MatiPl01/react-native-sortables",
  PowerShell: "MicrosoftDocs/PowerShell-Docs",
  "Windows Subsystem for Linux": "MicrosoftDocs/WSL",
  "Minecraft Forge": "MinecraftForge/Documentation",
  Mirror: "MirrorNetworking/Mirror",
  Motia: "MotiaDev/motia",
  MudBlazor: "MudBlazor/MudBlazor",
  Yuka: "Mugen87/yuka",
  TensorRT: "NVIDIA/TensorRT",
  "TensorRT-LLM": "NVIDIA/TensorRT-LLM",
  Ghidra: "NationalSecurityAgency/ghidra",
  NativeScript: "NativeScript/docs",
  "Op SQLite": "OP-Engineering/op-sqlite",
  "Anime.js": "juliangarnier/anime",
  "Open Liberty": "OpenLiberty/docs",
  "Knowledge Augmented Generation": "OpenSPG/KAG",
  Bull: "OptimalBits/bull",
  Paper: "PaperMC/docs",
  "ts-ghost": "PhilDL/ts-ghost",
  Phlexy: "PhlexyUI/phlexy_ui",
  PostHog: "PostHog/posthog-js",
  Prefect: "PrefectHQ/docs",
  Quivr: "QuivrHQ/quivr",
  Qwik: "QwikDev/qwik",
  FlashRAG: "RUC-NLPIR/FlashRAG",
  "discord.py": "Rapptz/discord.py",
  ReactiveX: "ReactiveX/reactivex.github.io",
  RxJS: "ReactiveX/rxjs",
  Purchases: "RevenueCat/react-native-purchases",
  "Rocket.Chat": "RocketChat/docs",
  RooVet: "RooVetGit/Roo-Code-Docs",
  Roo: "RooVetGit/Roo-Code.git",
  SeaORM: "SeaQL/sea-orm",
  Selenium: "SeleniumHQ/seleniumhq.github.io",
  "Semantic UI": "Semantic-Org/Semantic-UI-Docs",
  Hydrogen: "Shopify/hydrogen",
  Liquid: "Shopify/liquid",
  "React Native Skia": "Shopify/react-native-skia",
  "Shopify App": "Shopify/shopify-app-js",
  JavaGuide: "Snailclimb/JavaGuide",
  "TanStack Form": "TanStack/form",
  "TanStack Query": "tanstack/query",
  "TanStack Router": "TanStack/router",
  "TanStack Table": "TanStack/table",
  Ghost: "TryGhost/docs",
  "Sentence Transformers": "UKPLab/sentence-transformers",
  VIC: "UW-Hydro/VIC",
  Vapi: "VapiAI/docs",
  ViewComponent: "ViewComponent/view_component",
  WordPress: "WordPress/wordpress.org",
  Circles: "aboutcircles/circles-docs",
  Activepieces: "activepieces/activepieces",
  "React Spectrum": "adobe/react-spectrum",
  "AG Grid": "ag-grid/ag-grid",
  AgnoAGI: "agno-agi/agent-ui",
  Agno: "agno-agi/agno-docs",
  "React Scan": "aidenybai/react-scan",
  "Fusion Next": "alibaba-fusion/next",
  Higress: "alibaba/higress",
  "Ice.js": "alibaba/ice",
  LowCodeEngine: "alibaba/lowcode-engine",
  "Alpine.js": "alpinejs/alpine",
  "next-intl": "amannn/next-intl",
  Angular: "angular/angular",
  "Angular Components": "angular/components",
  Ansible: "ansible/ansible-documentation",
  "Ant Design": "ant-design/ant-design",
  ni: "antfu-collective/ni",
  Anthropic: "anthropics/anthropic-cookbook",
  "Anthropic TypeScript SDK": "anthropics/anthropic-sdk-typescript",
  "cargo-swift": "antoniusnaumann/cargo-swift",
  Agave: "anza-xyz/agave",
  "Apache Accumulo": "apache/accumulo-website",
  "Apache ActiveMQ": "apache/activemq-website",
  "Apache Arrow": "apache/arrow-site",
  "Apache Camel": "apache/camel-website",
  "Apache Cordova": "apache/cordova-docs",
  "Apache DolphinScheduler": "apache/dolphinscheduler-website",
  "Apache Druid": "apache/druid-website",
  "Apache Dubbo": "apache/dubbo-website",
  "Apache ECharts": "apache/echarts-website",
  "Apache Flink": "apache/flink-web",
  "Apache Guacamole": "apache/guacamole-manual",
  "Apache Hadoop": "apache/hadoop-site",
  "Apache Hive": "apache/hive-site",
  "Apache Lucene": "apache/lucene-site",
  "Apache Maven": "apache/maven-site",
  "Apache POI": "apache/poi",
  "Apache RocketMQ": "apache/rocketmq-site",
  "Apache SkyWalking": "apache/skywalking-website",
  "Apache Spark": "apache/spark-website",
  "Apache Storm": "apache/storm-site",
  "Apache Struts": "apache/struts-site",
  Crawlee: "apify/crawlee",
  "Apollo Client": "apollographql/apollo-client-integrations",
  Appwrite: "appwrite/website.git",
  Trivy: "aquasecurity/trivy",
  Arcjet: "arcjet/arcjet-docs",
  "Arco Design": "arco-design/arco-design",
  Arduino: "arduino/docs-content",
  ArkType: "arktypeio/arktype",
  Sycamore: "aryn-ai/sycamore",
  Unpic: "ascorbic/unpic",
  Ash: "ash-project/ash",
  "Ash GraphQL": "ash-project/ash_graphql",
  "Ash Postgres": "ash-project/ash_postgres",
  uv: "astral-sh/uv",
  "Pragmatic Drag and Drop": "atlassian/pragmatic-drag-and-drop",
  "AWS Amplify": "aws-amplify/amplify-js",
  "AWS SDK for Go v2": "aws/aws-sdk-go-v2",
  "AWS SDK for JavaScript v3": "aws/aws-sdk-js-v3",
  "AWS SDK": "awsdocs/aws-doc-sdk-examples",
  Axios: "axios/axios-docs",
  Babel: "babel/website",
  Backstage: "backstage/backstage",
  "Base MCP": "base/base-mcp",
  "Commerce Toolkit": "basementstudio/commerce-toolkit",
  Scrollytelling: "basementstudio/scrollytelling",
  BasicMemory: "basicmachines-co/basic-memory",
  Bazel: "bazelbuild/bazel-website",
  Beam: "beam-cloud/examples",
  "Bee Queue": "bee-queue/bee-queue",
  BetterAuth: "better-auth/better-auth",
  htmx: "bigskysoftware/htmx",
  Bitcoin: "bitcoin/bitcoin",
  Boto3: "boto/boto3",
  "React Arborist": "brimdata/react-arborist",
  "Browser Use JS": "browser-use/browser-use",
  BrowserBase: "browserbase/docs",
  Bucketeer: "bucketeer-io/bucketeer",
  "Cal.com": "calcom/cal.com",
  CAMEL: "camel-ai/camel",
  OWL: "camel-ai/owl",
  "Canva Apps SDK": "canva-sdks/canva-apps-sdk-starter-kit",
  Casbin: "casbin/casbin-website",
  Celery: "celery/celery",
  Kombu: "celery/kombu",
  Certbot: "certbot/certbot",
  Chai: "chaijs/chai-docs",
  "Chakra UI": "chakra-ui/chakra-ui",
  "Chart.js": "chartjs/Chart.js",
  Chroma: "chroma-core/chroma",
  "SvelteKit Flash Messages": "ciscoheat/sveltekit-flash-message",
  DndKit: "clauderic/dnd-kit",
  Clerk: "clerk/clerk-docs",
  Cline: "cline/cline",
  SpacetimeDB: "clockworklabs/SpacetimeDB",
  "Cloudflare Agents": "cloudflare/agents",
  Cloudflare: "cloudflare/cloudflare-docs",
  "Cloudflare API Client for TypeScript": "cloudflare/cloudflare-typescript",
  workerd: "cloudflare/workerd",
  "Workers SDK": "cloudflare/workers-sdk",
  AgentKit: "coinbase/agentkit",
  OnchainKit: "coinbase/onchainkit",
  Archon: "coleam00/Archon",
  Zod: "colinhacks/zod",
  Colyseus: "colyseus/colyseus",
  Commercetools: "commercetools/commercetools-api-reference",
  Conda: "conda/conda-docs",
  Coolify: "coollabsio/coolify",
  CrewAI: "crewAIInc/crewAI",
  Cucumber: "cucumber/docs",
  Cypress: "cypress-io/cypress-documentation",
  D3: "d3/d3",
  Daily: "daily-co/daily-python",
  dbt: "dbt-labs/docs.getdbt.com",
  Haystack: "deepset-ai/haystack",
  Deno: "denoland/deno",
  "Instagram Private API": "dilame/instagram-private-api",
  Dioxus: "dioxuslabs/dioxus",
  Directus: "directus/docs",
  "Discord.js": "discordjs/guide",
  DisGo: "disgoorg/disgo",
  Django: "django/django",
  DLT: "dlt-hub/dlt",
  Docker: "docker/docs",
  DocLing: "docling-project/docling-serve",
  "ASP.NET Core": "dotnet/aspnetcore",
  "kafka-python": "dpkp/kafka-python",
  "Drizzle ORM": "drizzle-team/drizzle-orm",
  Drupal: "drupal/drupal",
  "dry-auto_inject": "dry-rb/dry-auto_inject",
  "dry-configurable": "dry-rb/dry-configurable",
  "dry-container": "dry-rb/dry-container",
  "dry-monads": "dry-rb/dry-monads",
  "dry-operation": "dry-rb/dry-operation",
  "dry-schema": "dry-rb/dry-schema",
  "dry-struct": "dry-rb/dry-struct",
  "dry-types": "dry-rb/dry-types",
  "dry-validation": "dry-rb/dry-validation",
  Dub: "dubinc/docs",
  "Fast-Check": "dubzzz/fast-check",
  "Jakarta EE": "eclipse-ee4j/jakartaee-tutorial",
  "Eclipse Che": "eclipse/che-docs",
  "Return Crunchyroll Random": "edgHD/return-crunchyroll-random",
  Conform: "edmundhung/conform",
  Elasticsearch: "elastic/elasticsearch",
  ElectricSQL: "electric-sql/electric",
  PGlite: "electric-sql/pglite",
  Elysia: "elysiajs/documentation",
  "Ember Template Imports": "ember-cli/ember-template-imports",
  "Ember Engines": "ember-engines/ember-engines.com",
  "Ember QUnit": "emberjs/ember-qunit",
  Sonner: "emilkowalski/sonner",
  Vaul: "emilkowalski/vaul",
  "Django REST framework": "encode/django-rest-framework",
  HTTPX: "encode/httpx",
  Starlette: "encode/starlette",
  Uvicorn: "encode/uvicorn",
  Encore: "encoredev/encore",
  HazelGrails: "enesakar/hazelgrails",
  "DB-GPT": "eosphoros-ai/DB-GPT",
  "Epic Stack": "epicweb-dev/epic-stack",
  ESLint: "eslint/eslint.org",
  Ethereum: "ethereum/ethereum-org-website",
  ExcelJS: "exceljs/exceljs",
  Ragas: "explodinggradients/ragas",
  spaCy: "explosion/spaCy",
  Expo: "expo/expo",
  Express: "expressjs/express",
  "Claude Task Master": "eyaltoledano/claude-task-master",
  Valibot: "fabian-hiller/valibot",
  "Fabric.js": "fabricjs/fabric.js",
  Docusaurus: "facebook/docusaurus",
  Lexical: "facebook/lexical",
  React: "reactjs/react.dev",
  "React Native": "facebook/react-native",
  RocksDB: "facebook/rocksdb",
  Hydra: "facebookresearch/hydra",
  Fail2Ban: "fail2ban/fail2ban",
  fal: "fal-ai/fal",
  SQLModel: "fastapi/sqlmodel",
  Fastify: "fastify/fastify",
  FetchFox: "fetchfox/fetchfox",
  Fiberplane: "fiberplane/fiberplane",
  Filament: "filamentphp/filament",
  Firebase: "firebase/firebase-ios-sdk",
  "Firebase JavaScript SDK": "firebase/firebase-js-sdk",
  Genkit: "firebase/genkit",
  SoulseekBatchDownload: "fiso64/slsk-batchdl",
  Flutter: "flutter/website",
  Flyway: "flyway/flywaydb.org",
  Formbricks: "formbricks/formbricks",
  FormWerk: "formwerkjs/formwerk.dev",
  Foundry: "foundry-rs/book",
  Frappe: "frappe/frappe",
  "full.dev UI": "fulldotdev/ui",
  Fumadocs: "fuma-nama/fumadocs",
  MetaGPT: "geekan/MetaGPT",
  Convex: "get-convex/convex-helpers",
  Kirby: "getkirby/getkirby.com",
  Sentry: "getsentry/sentry-docs",
  Graphiti: "getzep/graphiti",
  "whisper.cpp": "ggml-org/whisper.cpp",
  "Godot Engine": "godotengine/godot-docs",
  Fiber: "gofiber/fiber",
  Hugo: "gohugoio/hugoDocs",
  Go: "golang/go",
  "Google Gemini": "google-gemini/generative-ai-js",
  "Agent2Agent Protocol": "google/A2A",
  "Google Sign-In for iOS": "google/GoogleSignIn-iOS",
  "Android Debug Kit": "google/adk-python",
  Skia: "google/skia",
  "Vertex AI SDK for JavaScript": "googleapis/js-genai",
  "Google AI": "googleapis/python-genai",
  GPUStack: "gpustack/gpustack",
  Gradio: "gradio-app/gradio",
  Grafana: "grafana/grafana",
  k6: "grafana/k6-docs",
  grammY: "grammyjs/grammY",
  GraphLit: "graphlit/graphlit-client-typescript",
  "The Graph": "graphprotocol/docs",
  GraphQL: "graphql/graphql.github.io",
  GSAP: "greensock/GSAP",
  "gRPC-Gateway": "grpc-ecosystem/grpc-gateway",
  gRPC: "grpc/grpc.io",
  Grunt: "gruntjs/grunt-docs",
  "Input OTP": "guilhermerodz/input-otp",
  "Google Web Toolkit": "gwtproject/gwt-site",
  Handsontable: "handsontable/handsontable",
  hapi: "hapijs/hapi.dev",
  LinkPreviewSwift: "harlanhaskins/LinkPreviewSwift",
  SealNotes: "harshsbhat/sealnotes",
  Terraform: "hashicorp/terraform",
  "Next Forge": "haydenbleasel/next-forge",
  Devise: "heartcombo/devise",
  Helm: "helm/helm-www",
  HeroUI: "heroui-inc/heroui",
  Hexo: "hexojs/site",
  "Composer Suite": "hmans/composer-suite",
  Miniplex: "hmans/miniplex",
  "Home Assistant": "home-assistant/home-assistant.io",
  Hono: "honojs/hono",
  HonoX: "honojs/honox-website",
  Accelerate: "huggingface/accelerate",
  Datasets: "huggingface/datasets",
  Diffusers: "huggingface/diffusers",
  "Optimum-Quanto": "huggingface/optimum-quanto",
  "SmoL Agents": "huggingface/smolagents",
  "Text Embeddings Inference": "huggingface/text-embeddings-inference",
  Transformers: "huggingface/transformers",
  "Transformers.js": "huggingface/transformers.js",
  "Bits UI": "huntabyte/bits-ui",
  "shadcn-svelte": "huntabyte/shadcn-svelte",
  "Day.js": "iamkun/dayjs",
  "Prompt Kit": "ibelick/prompt-kit",
  icestark: "ice-lab/icestark",
  Circom: "iden3/circom",
  "Inertia.js": "inertiajs/inertia",
  RAGflow: "infiniflow/ragflow",
  Inngest: "inngest/website",
  Instructor: "instructor-ai/instructor",
  Capacitor: "ionic-team/capacitor-docs",
  Stencil: "ionic-team/stencil-site",
  "Vue3 Carousel": "ismail9k/vue3-carousel",
  Istio: "istio/istio.io",
  DVC: "iterative/dvc.org",
  IndexedDB: "jakearchibald/idb",
  Jasmine: "jasmine/jasmine.github.io",
  Javalin: "javalin/website",
  Tenacity: "jd/tenacity",
  "YouTube Transcript API": "jdepoix/youtube-transcript-api",
  Jest: "jestjs/jest",
  "Roo Commander": "jezweb/roo-commander.git",
  "Jina Reader": "jina-ai/reader",
  "rrule.js": "jkbrzt/rrule",
  "Django QStash": "jmitchel3/django-qstash",
  CVA: "joe-bell/cva",
  jQuery: "jquery/jquery",
  "React Social Media Embed": "justinmahar/react-social-media-embed",
  "Kent C. Dodds": "kentcdodds/kentcdodds.com",
  Keras: "keras-team/keras-io",
  Kestra: "kestra-io/kestra",
  KeystoneJS: "keystonejs/keystone",
  KIE: "kiegroup/kie-docs",
  "React Native Keyboard Controller":
    "kirillzyusko/react-native-keyboard-controller",
  Konva: "konvajs/site",
  Kotest: "kotest/kotest",
  Ktor: "ktorio/ktor-documentation",
  Kubeflow: "kubeflow/website",
  Kubernetes: "kubernetes/website",
  Subscribe: "kucukkanat/subscribe",
  FastGPT: "labring/FastGPT",
  LangChain: "langchain-ai/langchain",
  "LangChain.js": "langchain-ai/langchainjs",
  LangGraph: "langchain-ai/langgraph",
  LangSmith: "langchain-ai/langsmith-sdk",
  Langfuse: "langfuse/langfuse",
  Dify: "langgenius/dify-docs",
  Laravel: "laravel/docs",
  "MCP Agent": "lastmile-ai/mcp-agent",
  Legend: "legendapp/legend-docs",
  "Let's Encrypt": "letsencrypt/website",
  LND: "lightningnetwork/lnd",
  Lit: "lit/lit.dev",
  LiveCodes: "live-codes/livecodes",
  Frimousse: "liveblocks/frimousse",
  Liveblocks: "liveblocks/liveblocks",
  LiveKit: "livekit/livekit",
  Livewire: "livewire/livewire",
  "Lemon Squeezy JS": "lmsqueezy/lemonsqueezy.js",
  LobeChat: "lobehub/lobe-chat",
  VeeValidate: "logaretm/vee-validate",
  LoopBack: "loopbackio/loopback.io",
  Lotus: "lotus-data/lotus",
  Lucide: "lucide-icons/lucide",
  Incus: "lxc/incus",
  Lynx: "lynx-family/lynx",
  WhisperX: "m-bain/whisperX",
  "Magento 2": "magento/magento2",
  MagicUI: "magicuidesign/magicui",
  "qunit-dom": "mainmatter/qunit-dom",
  "Mapbox GL JS": "mapbox/mapbox-gl-js",
  Marimo: "marimo-team/marimo",
  "Multichain Protocol": "mark3labs/mcp-go",
  Mastra: "mastra-ai/mastra",
  "Matrix JavaScript SDK": "matrix-org/matrix-js-sdk",
  Markdownify: "matthewwithanm/python-markdownify",
  Mautic: "mautic/mautic",
  Medusa: "medusajs/medusa",
  Meilisearch: "meilisearch/meilisearch",
  mem0: "mem0ai/mem0",
  Backtrader: "mementum/backtrader",
  FireCrawl: "mendableai/firecrawl",
  Boutique: "mergesort/Boutique",
  Mermaid: "mermaid-js/mermaid",
  Llama: "meta-llama/llama-cookbook",
  "Llama Models": "meta-llama/llama-models",
  Metabase: "metabase/metabase",
  Meteor: "meteor/docs",
  infinity: "michaelfeil/infinity",
  Micrometer: "micrometer-metrics/micrometer-docs",
  Micronaut: "micronaut-projects/micronaut-docs",
  TypeScript: "microsoft/TypeScript-Website",
  "AI Agents for Beginners": "microsoft/ai-agents-for-beginners",
  AutoGen: "microsoft/autogen",
  MarkItDown: "microsoft/markitdown",
  Playwright: "microsoft/playwright",
  Qlib: "microsoft/qlib",
  "Semantic Kernel": "microsoft/semantic-kernel",
  "Visual Studio Code": "microsoft/vscode-docs",
  MikroORM: "mikro-orm/mikro-orm",
  Milvus: "milvus-io/milvus",
  MinIO: "minio/minio",
  "Hydra-Zen": "mit-ll-responsible-ai/hydra-zen",
  MLX: "ml-explore/mlx",
  MLflow: "mlflow/mlflow",
  Maestro: "mobile-dev-inc/maestro",
  Moby: "moby/moby",
  Modal: "modal-labs/modal-client",
  "Model Context Protocol": "modelcontextprotocol/typescript-sdk",
  "Module Federation": "module-federation/core",
  "Moment.js": "moment/momentjs.com",
  MongoDB: "mongodb/docs",
  Motion: "motiondivision/motion",
  RBush: "mourner/rbush",
  "Three.js": "mrdoob/three.js",
  Nitro: "mrousavy/nitro",
  Reusables: "mrzachnugent/react-native-reusables",
  "MUI Base": "mui/base-ui",
  MUI: "mui/material-ui",
  n8n: "n8n-io/n8n-docs",
  "Split.js": "nathancahill/split",
  NautilusTrader: "nautechsystems/nautilus_trader",
  Neo4j: "neo4j/neo4j-documentation",
  Neon: "neondatabase/website",
  NestJS: "nestjs/docs.nestjs.com",
  NetBird: "netbirdio/netbird",
  "NextAuth.js": "nextauthjs/next-auth",
  Agentipy: "niceberginc/agentipy",
  "Nightwatch.js": "nightwatchjs/nightwatch-docs",
  "Node-RED": "node-red/node-red.github.io",
  "Node.js": "nodejs/nodejs.org",
  Swiper: "nolimits4web/swiper",
  Nostr: "nostr-protocol/nips",
  Novu: "novuhq/docs",
  NumPy: "numpy/numpy.org",
  "Nuxt I18n": "nuxt-modules/i18n",
  Nuxt: "nuxt/nuxt",
  "Nuxt UI": "nuxt/ui",
  "react-share": "nygardk/react-share",
  "Observable Plot": "observablehq/plot",
  Odoo: "odoo/documentation",
  "pytest-check": "okken/pytest-check",
  Ollama: "ollama/ollama",
  OOHTTP: "ooni/oohttp",
  "OpenTelemetry Collector Contrib":
    "open-telemetry/opentelemetry-collector-contrib",
  "OpenTelemetry Python": "open-telemetry/opentelemetry-python",
  OpenTelemetry: "open-telemetry/opentelemetry.io",
  "Open WebUI": "open-webui/docs",
  Gym: "openai/gym",
  "OpenAI Agents": "openai/openai-agents-python",
  "OpenAI API": "openai/openai-cookbook",
  "OpenAI Realtime Agents": "openai/openai-realtime-agents",
  Whisper: "openai/whisper",
  MinerU: "opendatalab/MinerU",
  openHAB: "openhab/openhab-docs",
  OpenSCAD: "openscad/openscad",
  OpenSearch: "opensearch-project/documentation-website",
  OpenStatus: "openstatusHQ/openstatus",
  Orama: "oramasearch/orama",
  Ory: "ory/docs",
  "oslojs/asn1": "oslo-project/asn1",
  "oslojs/binary": "oslo-project/binary",
  "oslojs/cbor": "oslo-project/cbor",
  "oslojs/crypto": "oslo-project/crypto",
  "oslojs/encoding": "oslo-project/encoding",
  "oslojs/jwt": "oslo-project/jwt",
  "oslojs/oauth2": "oslo-project/oauth2",
  "oslojs/otp": "oslo-project/otp",
  "oslojs/webauthn": "oslo-project/webauthn",
  OSSEC: "ossec/ossec-hids",
  Bun: "oven-sh/bun",
  ModSecurity: "owasp-modsecurity/ModSecurity",
  "Obsidian Vertical Tabs": "oxdc/obsidian-vertical-tabs",
  cmdk: "pacocoursey/cmdk",
  "Next Themes": "pacocoursey/next-themes",
  Flask: "pallets/flask",
  pandas: "pandas-dev/pandas",
  Parcel: "parcel-bundler/website",
  Toastification: "payam-zahedi/toastification",
  Payload: "payloadcms/payload",
  UploadThing: "pingdotgg/uploadthing",
  Pastel: "piotrmurach/pastel",
  PipeCD: "pipe-cd/pipecd",
  PipeCat: "pipecat-ai/pipecat",
  Pixeltable: "pixeltable/pixeltable",
  PixiJS: "pixijs/pixijs.com",
  "Plaid Link iOS SDK": "plaid/plaid-link-ios",
  "Plaid Link iOS": "plaid/plaid-link-ios-spm",
  Plaid: "plaid/quickstart",
  PlatformIO: "platformio/platformio-docs",
  "Play Framework": "playframework/playframework.com",
  Dash: "plotly/dash",
  Plotly: "plotly/graphing-library-docs",
  Drei: "pmndrs/drei",
  GLTFJSX: "pmndrs/gltfjsx",
  Jotai: "pmndrs/jotai",
  Koota: "pmndrs/koota",
  Leva: "pmndrs/leva",
  Maath: "pmndrs/maath",
  "React Postprocessing": "pmndrs/react-postprocessing",
  "react-spring": "pmndrs/react-spring",
  "React Three A11y": "pmndrs/react-three-a11y",
  "React Three CSG": "pmndrs/react-three-csg",
  "React Three Fiber": "pmndrs/react-three-fiber",
  "React Three Flex": "pmndrs/react-three-flex",
  "React Three GPU Pathtracer": "pmndrs/react-three-gpu-pathtracer",
  "React Three Rapier": "pmndrs/react-three-rapier",
  "react-three/p2": "pmndrs/use-p2",
  "react-three/xr": "pmndrs/xr",
  Zustand: "pmndrs/zustand",
  pnpm: "pnpm/pnpm",
  PocketBase: "pocketbase/site",
  Polars: "pola-rs/polars",
  Polar: "polarsource/polar",
  Portainer: "portainer/portainer-docs",
  PostgreSQL: "postgres/postgres",
  Preact: "preactjs/preact-www",
  Presto: "prestodb/prestodb.github.io",
  Prettier: "prettier/prettier",
  "Primer Brand": "primer/brand",
  "React Nestable": "primetwig/react-nestable",
  Prisma: "prisma/docs",
  "p5.js": "processing/p5.js",
  Processing: "processing/processing-docs",
  ProjectDiscovery: "projectdiscovery/docs",
  Prometheus: "prometheus/docs",
  "Protocol Buffers": "protocolbuffers/protocolbuffers.github.io",
  Pug: "pugjs/pug",
  Puppeteer: "puppeteer/puppeteer",
  "Pydantic Logfire": "pydantic/logfire",
  Pydantic: "pydantic/pydantic",
  PydanticAI: "pydantic/pydantic-ai",
  "Pydantic Settings": "pydantic/pydantic-settings",
  Pyloid: "pyloid/docs",
  PyMuPDF: "pymupdf/PyMuPDF",
  Rehooks: "pyr33x/rehooks",
  pytest: "pytest-dev/pytest",
  Poetry: "python-poetry/website",
  PyTorch: "pytorch/tutorials",
  Qdrant: "qdrant/qdrant",
  Quarkus: "quarkusio/quarkusio.github.io",
  QUnit: "qunitjs/qunit",
  RabbitMQ: "rabbitmq/rabbitmq-website",
  "Radix UI": "radix-ui/primitives",
  "Ruby on Rails": "rails/rails",
  Railway: "railwayapp/docs",
  RainbowKit: "rainbow-me/rainbowkit",
  Ramda: "ramda/ramda.github.io",
  RSpotify: "ramsayleung/rspotify",
  Rancher: "rancher/rancher",
  Ray: "ray-project/ray",
  Raycast: "raycast/extensions",
  Blade: "razorpay/blade",
  "React Hook Form": "react-hook-form/documentation",
  "React Navigation": "react-navigation/react-navigation.github.io",
  Recharts: "recharts/recharts",
  "Go-Redis": "redis/go-redis",
  ioredis: "redis/ioredis",
  Redis: "redis/redis-doc",
  "redis-py": "redis/redis-py",
  Redux: "reduxjs/redux",
  refine: "refinedev/refine",
  Reflex: "reflex-dev/reflex",
  Remeda: "remeda/remeda",
  "React Router": "remix-run/react-router",
  Remix: "remix-run/remix",
  Remotion: "remotion-dev/remotion",
  Reown: "reown-com/reown-docs",
  "React Email": "resend/react-email",
  Resend: "resend/resend-node",
  Restic: "restic/restic",
  Twistail: "riipandi/twistail",
  Replicache: "rocicorp/mono",
  Zero: "rocicorp/zero-docs",
  "Flutter Hooks": "rrousselGit/flutter_hooks",
  Riverpod: "rrousselGit/riverpod",
  Zerolog: "rs/zerolog",
  LlamaIndex: "run-llama/llama_index",
  Rust: "rust-lang/book",
  DaisyUI: "saadeghi/daisyui",
  DiceUI: "sadmann7/diceui",
  "System.css": "sakofchit/system.css",
  Sanic: "sanic-org/sanic-guide",
  GROQ: "sanity-io/GROQ",
  Sanity: "sanity-io/sanity",
  Sass: "sass/sass-site",
  Scala: "scala/docs.scala-lang",
  "p2.js": "schteppe/p2.js",
  "kafka-go": "segmentio/kafka-go",
  "Solana Agent Kit": "sendaifun/solana-agent-kit",
  Sequelize: "sequelize/website",
  SettleMint: "settlemint/docs",
  "shadcn/ui": "shadcn-ui/ui",
  "Next PWA": "shadowwalker/next-pwa",
  FlashList: "shopify/flash-list",
  Sidekiq: "sidekiq/sidekiq",
  viselect: "simonwep/viselect",
  PandasAI: "sinaptik-ai/pandas-ai",
  SiYuan: "siyuan-note/siyuan",
  Skeleton: "skeletonlabs/skeleton",
  Bolt: "slackapi/bolt-js",
  SMSManPy: "smsmancom/smsmanpy",
  "Socket.IO": "socketio/socket.io",
  Solid: "solidjs/solid-docs",
  MCP: "sooperset/mcp-atlassian",
  Speckle: "specklesystems/speckle-docs",
  Spinnaker: "spinnaker/spinnaker.github.io",
  "Spotify Web API TypeScript SDK": "spotify/spotify-web-api-ts-sdk",
  "Spring Boot": "spring-projects/spring-boot",
  "Spring Framework": "spring-projects/spring-framework",
  SQLAlchemy: "sqlalchemy/sqlalchemy",
  SQLC: "sqlc-dev/sqlc",
  SQLFluff: "sqlfluff/sqlfluff",
  SST: "sst/sst",
  DSPy: "stanfordnlp/dspy",
  Statamic: "statamic/docs",
  XState: "statelyai/xstate",
  Storybook: "storybookjs/storybook",
  Strapi: "strapi/documentation",
  Streamlit: "streamlit/docs",
  Testify: "stretchr/testify",
  "Stripe.js": "stripe/stripe-js",
  Stripe: "stripe/stripe-php",
  Stytch: "stytchauth/stytch-node",
  Instagrapi: "subzeroid/instagrapi",
  Supabase: "supabase/supabase",
  neverthrow: "supermacro/neverthrow",
  SvelteKit: "sveltejs/kit",
  Svelte: "sveltejs/svelte",
  Swift: "swiftlang/swift",
  NiceGUI: "zauberzeug/nicegui",
  Symfony: "symfony/symfony-docs",
  "t3-env": "t3-oss/t3-env",
  "Taiga UI": "taiga-family/taiga-ui",
  "Headless UI": "tailwindlabs/headlessui",
  "Tailwind CSS": "tailwindlabs/tailwindcss.com",
  Tamagui: "tamagui/tamagui",
  "TanStack Virtual": "tanstack/virtual",
  BullMQ: "taskforcesh/bullmq",
  Tauri: "tauri-apps/tauri-docs",
  Temporal: "temporalio/sdk-typescript",
  TensorFlow: "tensorflow/docs",
  "React Testing Library": "testing-library/react-testing-library",
  "Svelte Testing Library": "testing-library/svelte-testing-library",
  "Testing Library": "testing-library/testing-library-docs",
  "Theatre.js": "theatre-js/theatre",
  FastAPI: "tiangolo/fastapi",
  kbar: "timc1/kbar",
  Axum: "tokio-rs/axum",
  Cognee: "topoteretes/cognee",
  "Lightweight Charts": "tradingview/lightweight-charts",
  Traefik: "traefik/traefik",
  Agentic: "transitive-bullshit/agentic",
  Tremor: "tremorlabs/tremor",
  "Trigger.dev": "triggerdotdev/trigger.dev",
  tRPC: "trpc/trpc",
  KafkaJS: "tulios/kafkajs",
  libSQL: "tursodatabase/libsql",
  Bootstrap: "twbs/bootstrap",
  TypeORM: "typeorm/typeorm",
  Typesense: "typesense/typesense",
  Plate: "udecode/plate",
  Tiptap: "ueberdosis/tiptap-docs",
  ULID: "ulid/spec",
  Crawl4AI: "unclecode/crawl4ai",
  Unstorage: "unjs/unstorage",
  Unkey: "unkeyed/unkey",
  OPC: "unnoq/orpc",
  "Upstash QStash": "upstash/docs",
  "Upstash Redis": "upstash/docs",
  "Upstash Vector": "upstash/docs",
  "Upstash Workflow": "upstash/docs",
  JStack: "upstash/jstack",
  "Upstash Ratelimit JS": "upstash/ratelimit-js",
  "Upstash Ratelimit Python": "upstash/ratelimit-py",
  "Semantic Cache": "upstash/semantic-cache",
  "Wikipedia Semantic Search": "upstash/wikipedia-semantic-search",
  V8: "v8/v8.dev",
  Pundit: "varvet/pundit",
  "Vercel AI SDK": "vercel/ai",
  "Vercel AI Chatbot": "vercel/ai-chatbot",
  Flags: "vercel/flags",
  "Next.js": "vercel/next.js",
  "Vercel Storage": "vercel/storage",
  SWR: "vercel/swr",
  Turbo: "vercel/turborepo",
  "Eclipse Vert.x": "vert-x3/vertx-web-site",
  "Video.js": "videojs/video.js",
  SvelteDatatables: "vincjo/datatables",
  "Django Ninja": "vitalik/django-ninja",
  Vite: "vitejs/vite",
  Vitest: "vitest-dev/vitest",
  Vllm: "vllm-project/vllm",
  "Vue.js": "vuejs/docs",
  Wails: "wailsapp/wails",
  Wasp: "wasp-lang/wasp",
  Weaviate: "weaviate/typescript-client",
  WebMan: "webman-php/webman-manual",
  "weserv/images": "weserv/images",
  wagmi: "wevm/wagmi",
  "Agentic Data Analysis": "whitew1994WW/AgenticDataAnalysis",
  Astro: "withastro/docs",
  "React-PDF": "wojtekmaj/react-pdf",
  WunderGraph: "wundergraph/wundergraph.git",
  WXT: "wxt-dev/wxt",
  "Apple LLMs": "xoridius/apple-llms",
  "React Flow": "xyflow/xyflow",
  Yarn: "yarnpkg/website",
  "yt-dlp": "yt-dlp/yt-dlp",
  "OWASP Zed Attack Proxy": "zaproxy/zaproxy-website",
  Zed: "zed-industries/zed",
  ZenStack: "zenstackhq/zenstack-docs",
  "Zepp OS": "zepp-health/zeppos-docs",
  ZeroMQ: "zeromq/zeromq.org",
  DeepKE: "zjunlp/DeepKE",
  Zuplo: "zuplo/docs",
} as const;

const mappingCaseInsensitive = Object.fromEntries(
  Object.entries(mapping).map(([key, value]) => [key.toLowerCase(), value]),
) as Record<string, `${string}/${string}`>;
