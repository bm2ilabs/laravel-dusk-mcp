import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as glob from 'glob';

const execAsync = promisify(exec);

// Configuration
let config = {
  laravelPath: process.env.LARAVEL_PATH || process.cwd(),
  screenshotsPath: 'tests/Browser/screenshots',
  logsPath: 'storage/logs/dusk',
};

// Helper function to check if a directory is a Laravel project
async function isLaravelProject(projectPath: string): Promise<boolean> {
  try {
    // Check for essential Laravel files
    const composerJsonPath = path.join(projectPath, 'composer.json');
    const artisanPath = path.join(projectPath, 'artisan');
    
    // Check if both files exist
    await fs.access(composerJsonPath);
    await fs.access(artisanPath);
    
    // Check if composer.json contains Laravel
    const composerContent = await fs.readFile(composerJsonPath, 'utf-8');
    const composer = JSON.parse(composerContent);
    
    return (
      composer.require?.['laravel/framework'] !== undefined ||
      composer['require-dev']?.['laravel/framework'] !== undefined
    );
  } catch {
    return false;
  }
}

// Helper function to find Laravel projects in common locations
async function findLaravelProjects(): Promise<string[]> {
  const projects: string[] = [];
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  
  // Common Laravel project locations
  const searchPaths = [
    process.cwd(),
    path.join(homeDir, 'Sites'),
    path.join(homeDir, 'projects'),
    path.join(homeDir, 'workspace'),
    path.join(homeDir, 'dev'),
    path.join(homeDir, 'code'),
    '/var/www',
    '/var/www/html',
  ];
  
  for (const searchPath of searchPaths) {
    try {
      const dirs = await fs.readdir(searchPath);
      for (const dir of dirs) {
        const fullPath = path.join(searchPath, dir);
        const stat = await fs.stat(fullPath).catch(() => null);
        if (stat?.isDirectory() && await isLaravelProject(fullPath)) {
          projects.push(fullPath);
        }
      }
    } catch {
      // Directory doesn't exist or not accessible
    }
  }
  
  return [...new Set(projects)]; // Remove duplicates
}

// Create the MCP server
const server = new Server(
  {
    name: 'laravel-dusk-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Helper function to run commands in Laravel directory
async function runCommand(command: string, projectPath?: string): Promise<{ stdout: string; stderr: string }> {
  const cwd = projectPath || config.laravelPath;
  
  // Validate it's a Laravel project before running commands
  if (!await isLaravelProject(cwd)) {
    throw new Error(`Not a valid Laravel project: ${cwd}`);
  }
  
  try {
    const { stdout, stderr } = await execAsync(command, { cwd });
    return { stdout, stderr };
  } catch (error: any) {
    throw new Error(`Command failed: ${error.message}`);
  }
}

// Helper function to parse test results
function parseTestResults(output: string) {
  const lines = output.split('\n');
  const summary = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: '',
    failures: [] as Array<{
      test: string;
      message: string;
    }>,
  };

  // Parse PHPUnit output
  const summaryMatch = output.match(/Tests:\s+(\d+),\s+Assertions:\s+(\d+)(?:,\s+Failures:\s+(\d+))?/);
  if (summaryMatch) {
    summary.total = parseInt(summaryMatch[1]);
    summary.failed = parseInt(summaryMatch[3] || '0');
    summary.passed = summary.total - summary.failed;
  }

  // Parse duration
  const durationMatch = output.match(/Time:\s+(.+)/);
  if (durationMatch) {
    summary.duration = durationMatch[1];
  }

  // Parse failures
  const failureRegex = /FAILURES!\n(.+?)\n\n/gs;
  const failureMatch = failureRegex.exec(output);
  if (failureMatch) {
    const failureSection = failureMatch[1];
    const individualFailures = failureSection.split(/\d+\)/);
    individualFailures.forEach((failure) => {
      if (failure.trim()) {
        const lines = failure.trim().split('\n');
        if (lines.length > 0) {
          summary.failures.push({
            test: lines[0].trim(),
            message: lines.slice(1).join('\n').trim(),
          });
        }
      }
    });
  }

  return summary;
}

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'set_laravel_project',
        description: 'Set the Laravel project path to work with',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Absolute path to the Laravel project',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'list_laravel_projects',
        description: 'List available Laravel projects on the system',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'run_dusk_test',
        description: 'Run Laravel Dusk browser tests',
        inputSchema: {
          type: 'object',
          properties: {
            test: {
              type: 'string',
              description: 'Specific test file or method to run (optional)',
            },
            filter: {
              type: 'string',
              description: 'Filter tests by name pattern',
            },
            group: {
              type: 'string',
              description: 'Run tests in a specific group',
            },
            headless: {
              type: 'boolean',
              description: 'Run tests in headless mode (default: true)',
              default: true,
            },
          },
        },
      },
      {
        name: 'list_dusk_tests',
        description: 'List all available Dusk test files',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'check_dusk_environment',
        description: 'Check if Dusk environment is properly configured',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'clear_dusk_screenshots',
        description: 'Clear all Dusk screenshot files',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'install_chrome_driver',
        description: 'Install or update ChromeDriver for Dusk',
        inputSchema: {
          type: 'object',
          properties: {
            version: {
              type: 'string',
              description: 'Specific ChromeDriver version (optional)',
            },
          },
        },
      },
      {
        name: 'start_dev_server',
        description: 'Start Laravel development server for Dusk tests',
        inputSchema: {
          type: 'object',
          properties: {
            port: {
              type: 'number',
              description: 'Port number (default: 8000)',
              default: 8000,
            },
          },
        },
      },
    ],
  };
});

// Define available resources (screenshots, logs)
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources: Array<{
    uri: string;
    name: string;
    mimeType: string;
  }> = [];

  try {
    // List screenshot files
    const screenshotsDir = path.join(config.laravelPath, config.screenshotsPath);
    const screenshots = await fs.readdir(screenshotsDir).catch(() => []);

    screenshots.forEach((file) => {
      if (file.endsWith('.png')) {
        resources.push({
          uri: `screenshot://${file}`,
          name: `Screenshot: ${file}`,
          mimeType: 'image/png',
        });
      }
    });

    // List log files
    const logsDir = path.join(config.laravelPath, config.logsPath);
    const logs = await fs.readdir(logsDir).catch(() => []);

    logs.forEach((file) => {
      if (file.endsWith('.log')) {
        resources.push({
          uri: `log://${file}`,
          name: `Log: ${file}`,
          mimeType: 'text/plain',
        });
      }
    });
  } catch (error) {
    // Directory might not exist yet
  }

  return { resources };
});

// Handle resource reading
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  if (uri.startsWith('screenshot://')) {
    const filename = uri.replace('screenshot://', '');
    const filepath = path.join(config.laravelPath, config.screenshotsPath, filename);
    const content = await fs.readFile(filepath);
    return {
      contents: [
        {
          uri,
          mimeType: 'image/png',
          blob: content.toString('base64'),
        },
      ],
    };
  }

  if (uri.startsWith('log://')) {
    const filename = uri.replace('log://', '');
    const filepath = path.join(config.laravelPath, config.logsPath, filename);
    const content = await fs.readFile(filepath, 'utf-8');
    return {
      contents: [
        {
          uri,
          mimeType: 'text/plain',
          text: content,
        },
      ],
    };
  }

  throw new Error('Unknown resource type');
});

// Implement tool handlers
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'set_laravel_project': {
      const projectPath = args?.path as string | undefined;
      if (!projectPath) {
        throw new Error('Project path is required');
      }
      
      const absolutePath = path.resolve(projectPath);
      
      if (!await isLaravelProject(absolutePath)) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${absolutePath} is not a valid Laravel project. Please ensure the path contains a Laravel installation with composer.json and artisan files.`,
            },
          ],
        };
      }
      
      // Check if Dusk is installed
      let duskInstalled = false;
      try {
        await fs.access(path.join(absolutePath, 'vendor/laravel/dusk'));
        duskInstalled = true;
      } catch {
        // Dusk not installed
      }
      
      config.laravelPath = absolutePath;
      
      return {
        content: [
          {
            type: 'text',
            text: `Laravel project set to: ${absolutePath}\n${duskInstalled ? '✅ Laravel Dusk is installed' : '⚠️  Laravel Dusk is not installed. Run: composer require laravel/dusk --dev'}`,
          },
        ],
      };
    }
    
    case 'list_laravel_projects': {
      const projects = await findLaravelProjects();
      
      if (projects.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No Laravel projects found in common locations. Use set_laravel_project to specify a custom path.',
            },
          ],
        };
      }
      
      const projectInfo = await Promise.all(
        projects.map(async (project) => {
          let duskInstalled = false;
          try {
            await fs.access(path.join(project, 'vendor/laravel/dusk'));
            duskInstalled = true;
          } catch {
            // Dusk not installed
          }
          return `${project} ${duskInstalled ? '(Dusk ✅)' : '(Dusk ❌)'}`;
        })
      );
      
      return {
        content: [
          {
            type: 'text',
            text: `Found Laravel projects:\n${projectInfo.map(p => `- ${p}`).join('\n')}\n\nCurrent project: ${config.laravelPath}`,
          },
        ],
      };
    }
    
    case 'run_dusk_test': {
      let command = 'php artisan dusk';

      if (args?.test) {
        command += ` ${args.test}`;
      }

      if (args?.filter) {
        command += ` --filter="${args.filter}"`;
      }

      if (args?.group) {
        command += ` --group=${args.group}`;
      }

      if (!args?.headless) {
        command += ' --headed';
      }

      try {
        const { stdout, stderr } = await runCommand(command);
        const results = parseTestResults(stdout);

        return {
          content: [
            {
              type: 'text',
              text: `Dusk Test Results:
- Total Tests: ${results.total}
- Passed: ${results.passed}
- Failed: ${results.failed}
- Duration: ${results.duration}

${results.failed > 0 ? `\nFailures:\n${results.failures.map(f => `- ${f.test}\n  ${f.message}`).join('\n\n')}` : 'All tests passed! ✅'}

${stderr ? `\nWarnings/Errors:\n${stderr}` : ''}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error running Dusk tests: ${error.message}`,
            },
          ],
        };
      }
    }

    case 'list_dusk_tests': {
      try {
        const testsDir = path.join(config.laravelPath, 'tests/Browser');
        const pattern = path.join(testsDir, '**/*.php');
        const files = glob.sync(pattern);

        const tests = files.map((file) => {
          const relativePath = path.relative(testsDir, file);
          return relativePath;
        });

        return {
          content: [
            {
              type: 'text',
              text: `Available Dusk Tests:\n${tests.map(t => `- ${t}`).join('\n')}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error listing tests: ${error.message}`,
            },
          ],
        };
      }
    }

    case 'check_dusk_environment': {
      const checks = [];

      try {
        // Check if Dusk is installed
        await fs.access(path.join(config.laravelPath, 'vendor/laravel/dusk'));
        checks.push('✅ Laravel Dusk is installed');
      } catch {
        checks.push('❌ Laravel Dusk is not installed (run: composer require laravel/dusk --dev)');
      }

      try {
        // Check if .env.dusk.local exists
        await fs.access(path.join(config.laravelPath, '.env.dusk.local'));
        checks.push('✅ .env.dusk.local file exists');
      } catch {
        checks.push('⚠️  .env.dusk.local file not found (optional but recommended)');
      }

      try {
        // Check ChromeDriver
        const { stdout } = await runCommand('php artisan dusk:chrome-driver --detect');
        checks.push('✅ ChromeDriver is properly configured');
      } catch (error: any) {
        checks.push('❌ ChromeDriver not found or outdated (run: php artisan dusk:install)');
      }

      try {
        // Check if tests directory exists
        await fs.access(path.join(config.laravelPath, 'tests/Browser'));
        checks.push('✅ Browser tests directory exists');
      } catch {
        checks.push('❌ Browser tests directory not found');
      }

      return {
        content: [
          {
            type: 'text',
            text: `Dusk Environment Check:\n${checks.join('\n')}`,
          },
        ],
      };
    }

    case 'clear_dusk_screenshots': {
      try {
        const screenshotsDir = path.join(config.laravelPath, config.screenshotsPath);
        const files = await fs.readdir(screenshotsDir);

        let deleted = 0;
        for (const file of files) {
          if (file.endsWith('.png')) {
            await fs.unlink(path.join(screenshotsDir, file));
            deleted++;
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: `Cleared ${deleted} screenshot(s) from the Dusk screenshots directory.`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error clearing screenshots: ${error.message}`,
            },
          ],
        };
      }
    }

    case 'install_chrome_driver': {
      try {
        let command = 'php artisan dusk:chrome-driver';
        if (args?.version) {
          command += ` ${args.version}`;
        } else {
          command += ' --detect';
        }

        const { stdout, stderr } = await runCommand(command);

        return {
          content: [
            {
              type: 'text',
              text: `ChromeDriver Installation:\n${stdout}\n${stderr ? `\nWarnings: ${stderr}` : ''}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error installing ChromeDriver: ${error.message}`,
            },
          ],
        };
      }
    }

    case 'start_dev_server': {
      const port = args?.port || 8000;
      try {
        // This starts the server in the background
        exec(`php artisan serve --port=${port}`, {
          cwd: config.laravelPath,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Laravel development server starting on port ${port}...\nNote: The server is running in the background. Make sure to stop it when done.`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error starting server: ${error.message}`,
            },
          ],
        };
      }
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Initialize and validate default project
async function initialize() {
  // Check if the default path is a Laravel project
  if (!await isLaravelProject(config.laravelPath)) {
    // Try to find Laravel projects
    const projects = await findLaravelProjects();
    if (projects.length > 0) {
      config.laravelPath = projects[0];
      console.error(`No Laravel project in current directory. Using: ${config.laravelPath}`);
    } else {
      console.error('Warning: No Laravel project found. Use set_laravel_project to specify a project path.');
    }
  }
}

// Start the server
const transport = new StdioServerTransport();
await initialize();
await server.connect(transport);
console.error('Laravel Dusk MCP server started');