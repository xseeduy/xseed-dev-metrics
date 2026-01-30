// ============================================
// Config CLI Command
// ============================================

import chalk from 'chalk';
import Table from 'cli-table3';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { getConfigStatus, getConfigFilePath, configFileExists, getJiraConfig } from '../config/integrations';
import { JiraClient } from '../integrations/jira/client';

interface ConfigCommandOptions {
  check?: boolean;
  init?: boolean;
  test?: boolean;
}

export async function configCommand(options: ConfigCommandOptions): Promise<void> {
  if (!options.check && !options.init && !options.test) {
    options.check = true;
  }

  if (options.init) {
    await initConfig();
    return;
  }

  if (options.check || options.test) {
    await checkConfig(options.test || false);
  }
}

async function checkConfig(testConnections: boolean): Promise<void> {
  const status = getConfigStatus();

  console.log(chalk.bold.cyan('\n🔧 INTEGRATION CONFIGURATION\n'));

  const table = new Table({
    head: [chalk.cyan('Integration'), chalk.cyan('Status'), chalk.cyan('Source'), chalk.cyan('Details')],
    colWidths: [12, 18, 10, 40],
  });

  table.push([
    'Jira',
    status.jira.configured ? chalk.green('✓ Configured') : chalk.gray('Not configured'),
    status.jira.source || '-',
    status.jira.configured ? `${status.jira.url}` : '-',
  ]);

  table.push([
    'Linear',
    status.linear.configured ? chalk.green('✓ Configured') : chalk.gray('Not configured'),
    status.linear.source || '-',
    status.linear.configured ? 'API Key set' : '-',
  ]);

  table.push([
    'Notion',
    status.notion.configured ? chalk.green('✓ Configured') : chalk.gray('Not configured'),
    status.notion.source || '-',
    status.notion.configured ? (status.notion.enabled ? 'Enabled' : 'Disabled') : '-',
  ]);

  console.log(table.toString());
  console.log(chalk.gray(`\nConfig file: ${getConfigFilePath()}`));
  console.log(chalk.gray(`Exists: ${configFileExists() ? 'Yes' : 'No'}\n`));

  if (testConnections) {
    console.log(chalk.bold('Testing connections...\n'));
    
    if (status.jira.configured) {
      process.stdout.write('  Jira: ');
      try {
        const config = getJiraConfig();
        if (config) {
          const client = new JiraClient(config);
          const result = await client.testConnection();
          if (result.success) {
            console.log(chalk.green(`✓ Connected as ${result.user}`));
          } else {
            console.log(chalk.red(`✗ ${result.error}`));
          }
        }
      } catch (error: unknown) {
        console.log(chalk.red(`✗ ${(error as Error).message}`));
      }
    }

    if (status.linear.configured) {
      process.stdout.write('  Linear: ');
      try {
        const { getLinearConfig } = await import('../config/integrations');
        const { LinearClient } = await import('../integrations/linear/client');
        const linearConfig = getLinearConfig();
        if (linearConfig) {
          const client = new LinearClient(linearConfig);
          const result = await client.testConnection();
          if (result.success) {
            console.log(chalk.green(`✓ Connected as ${result.user}`));
          } else {
            console.log(chalk.red(`✗ ${result.error}`));
          }
        }
      } catch (error: unknown) {
        console.log(chalk.red(`✗ ${(error as Error).message}`));
      }
    }

    if (status.notion.configured) {
      process.stdout.write('  Notion: ');
      try {
        const { getNotionConfig } = await import('../config/integrations');
        const { NotionClient } = await import('../integrations/notion');
        const notionConfig = getNotionConfig();
        if (notionConfig) {
          const client = new NotionClient(notionConfig);
          const result = await client.testConnection();
          if (result.success) {
            console.log(chalk.green(`✓ Connected as ${result.user}`));
          } else {
            console.log(chalk.red(`✗ ${result.error}`));
          }
        }
      } catch (error: unknown) {
        console.log(chalk.red(`✗ ${(error as Error).message}`));
      }
    }
    
    console.log('');
  }

  if (!status.jira.configured && !status.linear.configured && !status.notion.configured) {
    showSetupInstructions();
  }
}

function showSetupInstructions(): void {
  console.log(chalk.bold('Setup Instructions:\n'));
  console.log(chalk.bold.cyan('Option 1: Environment Variables\n'));
  console.log(chalk.gray('  export JIRA_URL=https://yourcompany.atlassian.net'));
  console.log(chalk.gray('  export JIRA_EMAIL=your.email@company.com'));
  console.log(chalk.gray('  export JIRA_TOKEN=your_api_token'));
  console.log(chalk.gray('  # Get token: https://id.atlassian.com/manage-profile/security/api-tokens\n'));
  console.log(chalk.bold.cyan('Option 2: Config File\n'));
  console.log(chalk.gray(`  Run: git-dev-metrics config --init\n`));
}

async function initConfig(): Promise<void> {
  const configPath = getConfigFilePath();

  if (configFileExists()) {
    console.log(chalk.yellow(`\n⚠️  Config exists at: ${configPath}`));
    console.log(chalk.gray('Delete it first to create a new one.\n'));
    return;
  }

  const exampleConfig = {
    jira: {
      url: 'https://yourcompany.atlassian.net',
      email: 'your.email@company.com',
      token: 'YOUR_JIRA_API_TOKEN',
    },
    linear: {
      apiKey: 'lin_api_YOUR_LINEAR_API_KEY',
    },
  };

  const configDir = dirname(configPath);
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  writeFileSync(configPath, JSON.stringify(exampleConfig, null, 2));

  console.log(chalk.green(`\n✓ Created config at: ${configPath}\n`));
  console.log(chalk.bold('Next steps:'));
  console.log(chalk.gray('  1. Edit the config file with your credentials'));
  console.log(chalk.gray('  2. Run: git-dev-metrics config --test'));
  console.log(chalk.gray('  3. Try: git-dev-metrics jira -p YOUR_PROJECT_KEY\n'));
}
