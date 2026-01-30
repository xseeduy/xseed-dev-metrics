// ============================================
// Xseed Branding - ASCII Logo & Colors
// ============================================

import chalk from 'chalk';

/**
 * Xseed brand color (dark navy blue)
 * @constant
 */
const XSEED_COLOR = '#0a1628';

/**
 * ASCII Art Logo for Xseed Developer Metrics
 * @constant
 */
export const XSEED_LOGO = chalk.hex(XSEED_COLOR).bold(`
    ██╗  ██╗███████╗███████╗███████╗██████╗ 
    ╚██╗██╔╝██╔════╝██╔════╝██╔════╝██╔══██╗
     ╚███╔╝ ███████╗█████╗  █████╗  ██║  ██║
     ██╔██╗ ╚════██║██╔══╝  ██╔══╝  ██║  ██║
    ██╔╝ ██╗███████║███████╗███████╗██████╔╝
    ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝╚═════╝ 
`);

/**
 * Compact logo for subcommands
 * @constant
 */
export const XSEED_LOGO_COMPACT = chalk.hex(XSEED_COLOR).bold('Xseed') + chalk.gray(' Metrics');

/**
 * Prints the welcome message for first-time users.
 * Displays the full logo and introductory text.
 */
export function printWelcome(): void {
  console.log(XSEED_LOGO);
  console.log(chalk.gray('    Developer Metrics CLI v1.0.0\n'));
  console.log(chalk.cyan('  Welcome to Xseed Developer Metrics!\n'));
  console.log(chalk.gray('  Track your productivity across Git, Jira & Linear.\n'));
}

/**
 * Prints the banner with version information.
 * Used for regular commands that need to show branding.
 * 
 * @param version - Version string to display (default: '1.0.0')
 */
export function printBanner(version: string = '1.0.0'): void {
  console.log(XSEED_LOGO);
  console.log(chalk.gray(`    Developer Metrics CLI v${version}\n`));
}

/**
 * Prints a compact header for subcommands.
 * Used when a full banner would be too verbose.
 */
export function printCompactHeader(): void {
  console.log(`\n  ${XSEED_LOGO_COMPACT} ${chalk.gray('v1.0.0')}\n`);
}

/**
 * Prints a success message with a checkmark icon.
 * 
 * @param message - The success message to display
 */
export function printSuccess(message: string): void {
  console.log(chalk.green('  ✓ ') + message);
}

/**
 * Prints an error message with an X icon.
 * 
 * @param message - The error message to display
 */
export function printError(message: string): void {
  console.log(chalk.red('  ✗ ') + message);
}

/**
 * Prints an info message with an info icon.
 * 
 * @param message - The info message to display
 */
export function printInfo(message: string): void {
  console.log(chalk.blue('  ℹ ') + message);
}

/**
 * Prints a warning message with a warning icon.
 * 
 * @param message - The warning message to display
 */
export function printWarning(message: string): void {
  console.log(chalk.yellow('  ⚠ ') + message);
}

/**
 * Prints a section header with a title and divider line.
 * Used to separate different sections of output.
 * 
 * @param title - The section title to display
 */
export function printSection(title: string): void {
  console.log(chalk.hex(XSEED_COLOR).bold(`\n  ${title}`));
  console.log(chalk.gray('  ' + '─'.repeat(40)));
}
