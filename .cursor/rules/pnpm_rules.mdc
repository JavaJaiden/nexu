---
description: Guidelines for using PNPM package manager and strict prohibition of npm/yarn usage
alwaysApply: true
---

# PNPM package manager guidelines

## PNPM usage requirements
- ALWAYS use pnpm for all package management operations in this project.
- NEVER use npm or yarn commands - they are strictly prohibited.
- Use pnpm for installing, updating, removing, and managing dependencies.
- Leverage pnpm's workspace features for monorepo management.
- Take advantage of pnpm's efficient disk space usage and fast installation times.

## Available commands
- Use `pnpm install` to install all dependencies
- Use `pnpm add <package>` to add new dependencies
- Use `pnpm remove <package>` to remove dependencies
- Use `pnpm update` to update dependencies
- Use `pnpm run <script>` to execute package scripts
- Use `pnpm clean` to remove all node_modules folders throughout the project

## Workspace management
- Use `pnpm add <package> --workspace-root` to add dependencies to the root workspace
- Use `pnpm add <package> --filter <workspace>` to add dependencies to specific workspaces
- Use `pnpm run <script> --filter <workspace>` to run scripts in specific workspaces
- Use `pnpm --recursive <command>` to run commands across all workspaces

## Configuration best practices
- Keep the `pnpm-workspace.yaml` file up to date with workspace patterns
- Use the `packageManager` field in package.json to specify the exact pnpm version
- Configure `.npmrc` files for workspace-specific settings when needed
- Use pnpm's lockfile (`pnpm-lock.yaml`) for consistent dependency resolution

## Development workflow integration
- Set up your editor/IDE to recognize pnpm as the package manager
- Include pnpm in CI/CD pipelines instead of npm
- Use pnpm's built-in commands for common tasks like cleaning and rebuilding
- Take advantage of pnpm's filtering capabilities for monorepo workflows

## Project configuration
This project uses:
- pnpm workspaces for monorepo management
- Turbo for build orchestration with pnpm
- Specific pnpm version pinning via packageManager field
- Efficient dependency management across web, native, and backend packages

## Prohibited commands
- ❌ `npm install` - Use `pnpm install` instead
- ❌ `npm add` - Use `pnpm add` instead
- ❌ `npm run` - Use `pnpm run` instead
- ❌ `yarn install` - Use `pnpm install` instead
- ❌ `yarn add` - Use `pnpm add` instead
- ❌ Any npm or yarn commands are strictly forbidden
