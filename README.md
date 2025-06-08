# Laravel Dusk MCP Server

A Model Context Protocol (MCP) server that provides browser testing capabilities for Laravel applications through Laravel Dusk. This server allows AI assistants like Claude to run and manage browser tests in any Laravel project.

## Features

- Run Laravel Dusk browser tests with various options
- List all available Dusk test files
- Check Dusk environment configuration
- Manage test artifacts (screenshots and logs)
- Install/update ChromeDriver
- Start Laravel development server for testing
- Automatic Laravel project detection and validation
- Support for multiple Laravel projects

## Installation

### Using npx (no installation required)

You can use the MCP server directly with npx without installing it.

#### Quick Setup with Claude CLI

```bash
claude mcp add laravel-dusk -- npx laravel-dusk-mcp@latest
```

#### Manual Configuration

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "laravel-dusk": {
      "command": "npx",
      "args": ["laravel-dusk-mcp@latest"]
    }
  }
}
```

### Local Installation

1. Clone this repository:
```bash
git clone https://github.com/bm2ilabs/laravel-dusk-mcp.git
cd laravel-dusk-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

### Global Installation

```bash
npm install -g laravel-dusk-mcp
```

## Usage

### With Claude Desktop

Add the server to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

#### Using npx (recommended)

```json
{
  "mcpServers": {
    "laravel-dusk": {
      "command": "npx",
      "args": ["laravel-dusk-mcp@latest"],
      "env": {
        "LARAVEL_PATH": "/path/to/your/laravel/project"
      }
    }
  }
}
```

#### Using local installation

```json
{
  "mcpServers": {
    "laravel-dusk": {
      "command": "node",
      "args": ["/path/to/laravel-dusk-mcp/dist/index.js"],
      "env": {
        "LARAVEL_PATH": "/path/to/your/laravel/project"
      }
    }
  }
}
```

The `LARAVEL_PATH` environment variable is optional. If not provided, the server will:
1. Check if the current directory is a Laravel project
2. Search common locations for Laravel projects
3. Allow you to set the project path using the `set_laravel_project` tool

### Minimal Configuration

For the simplest setup:

#### Using Claude CLI
```bash
claude mcp add laravel-dusk -- npx laravel-dusk-mcp@latest
```

#### Or manually:
```json
{
  "mcpServers": {
    "laravel-dusk": {
      "command": "npx",
      "args": ["laravel-dusk-mcp@latest"]
    }
  }
}
```

Then use the `set_laravel_project` tool to specify your Laravel project.

### Available Tools

#### Project Management

- **`set_laravel_project`**: Set the Laravel project path to work with
  - Parameters:
    - `path` (required): Absolute path to the Laravel project

- **`list_laravel_projects`**: List all Laravel projects found on the system
  - Shows which projects have Dusk installed

#### Testing Tools

- **`run_dusk_test`**: Run Laravel Dusk browser tests
  - Parameters:
    - `test` (optional): Specific test file or method to run
    - `filter` (optional): Filter tests by name pattern
    - `group` (optional): Run tests in a specific group
    - `headless` (optional, default: true): Run tests in headless mode

- **`list_dusk_tests`**: List all available Dusk test files

- **`check_dusk_environment`**: Verify Dusk environment configuration
  - Checks for:
    - Laravel Dusk installation
    - .env.dusk.local file
    - ChromeDriver installation
    - Browser tests directory

#### Maintenance Tools

- **`clear_dusk_screenshots`**: Clear all Dusk screenshot files

- **`install_chrome_driver`**: Install or update ChromeDriver
  - Parameters:
    - `version` (optional): Specific ChromeDriver version

- **`start_dev_server`**: Start Laravel development server for tests
  - Parameters:
    - `port` (optional, default: 8000): Port number

### Resources

The server provides access to test artifacts:

- **Screenshots**: Access test failure screenshots (image/png)
- **Logs**: Access Dusk test logs (text/plain)

## Development

To run the server in development mode:

```bash
npm run dev
```

## Requirements

- Node.js 16 or higher
- Laravel project with Dusk installed
- Chrome/Chromium browser
- ChromeDriver (can be installed via the server)

## Laravel Dusk Setup

If Dusk is not installed in your Laravel project:

1. Install Dusk:
```bash
composer require laravel/dusk --dev
```

2. Install Dusk in your Laravel application:
```bash
php artisan dusk:install
```

3. Configure your environment:
   - Copy `.env` to `.env.dusk.local` for Dusk-specific settings
   - Set `APP_URL` to match your test server URL

## Common Issues

1. **ChromeDriver version mismatch**: Use the `install_chrome_driver` tool to update ChromeDriver

2. **Tests failing with "Connection refused"**: Ensure the Laravel development server is running using the `start_dev_server` tool

3. **Dusk not found**: Install Dusk in your Laravel project using Composer

## License

MIT