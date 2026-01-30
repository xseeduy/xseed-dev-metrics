// ============================================
// Xseed Branding - ASCII Logo & Colors
// ============================================

import chalk from 'chalk';

// Xseed brand color (dark navy blue)
const XSEED_COLOR = '#0a1628';

// ASCII Art Logo for Xseed
export const XSEED_LOGO = chalk.hex(XSEED_COLOR).bold(`
    ██╗  ██╗███████╗███████╗███████╗██████╗ 
    ╚██╗██╔╝██╔════╝██╔════╝██╔════╝██╔══██╗
     ╚███╔╝ ███████╗█████╗  █████╗  ██║  ██║
     ██╔██╗ ╚════██║██╔══╝  ██╔══╝  ██║  ██║
    ██╔╝ ██╗███████║███████╗███████╗██████╔╝
    ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝╚═════╝ 
`);

// Compact logo for subcommands
export const XSEED_LOGO_COMPACT = chalk.hex(XSEED_COLOR).bold('Xseed') + chalk.gray(' Metrics');

// Welcome message for first run
export function printWelcome(): void {
  console.log(XSEED_LOGO);
  console.log(chalk.gray('    Developer Metrics CLI v1.0.0\n'));
  console.log(chalk.cyan('  Welcome to Xseed Developer Metrics!\n'));
  console.log(chalk.gray('  Track your productivity across Git, Jira & Linear.\n'));
}

// Banner for regular commands
export function printBanner(version: string = '1.0.0'): void {
  console.log(XSEED_LOGO);
  console.log(chalk.gray(`    Developer Metrics CLI v${version}\n`));
}

// Compact header for subcommands
export function printCompactHeader(): void {
  console.log(`\n  ${XSEED_LOGO_COMPACT} ${chalk.gray('v1.0.0')}\n`);
}

// Success message
export function printSuccess(message: string): void {
  console.log(chalk.green('  ✓ ') + message);
}

// Error message
export function printError(message: string): void {
  console.log(chalk.red('  ✗ ') + message);
}

// Info message
export function printInfo(message: string): void {
  console.log(chalk.blue('  ℹ ') + message);
}

// Warning message
export function printWarning(message: string): void {
  console.log(chalk.yellow('  ⚠ ') + message);
}

// Section header
export function printSection(title: string): void {
  console.log(chalk.hex(XSEED_COLOR).bold(`\n  ${title}`));
  console.log(chalk.gray('  ' + '─'.repeat(40)));
}
