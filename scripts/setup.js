const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.join(__dirname, '..');
const skipInstall = process.argv.includes('--skip-install');

function runNpm(args, cwd) {
  return new Promise((resolve, reject) => {
    const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm ${args.join(' ')} failed with exit code ${code ?? 'unknown'}.`));
    });
  });
}

function setEnvValue(contents, key, value) {
  const line = new RegExp(`^${key}=.*$`, 'm');
  if (!line.test(contents)) throw new Error(`Missing ${key} setting in backend/.env.example.`);
  return contents.replace(line, `${key}=${value}`);
}

async function prepareEnv() {
  const examplePath = path.join(root, 'backend', '.env.example');
  const envPath = path.join(root, 'backend', '.env');

  try {
    await fs.access(envPath);
    console.log('Keeping existing backend/.env unchanged.');
    return;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  let contents = await fs.readFile(examplePath, 'utf8');
  contents = setEnvValue(contents, 'JWT_SECRET', crypto.randomBytes(32).toString('base64'));
  contents = setEnvValue(contents, 'APP_KEY', crypto.randomBytes(32).toString('base64'));

  try {
    await fs.writeFile(envPath, contents, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    console.log('Created backend/.env with new local secrets; secret values were not displayed.');
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    console.log('backend/.env was created by another process; leaving it unchanged.');
  }
}

async function main() {
  if (Number(process.versions.node.split('.')[0]) < 18) {
    throw new Error('KejaLink requires Node.js 18 or newer.');
  }

  await prepareEnv();

  if (!skipInstall) {
    for (const folder of ['backend', 'frontend']) {
      console.log(`\nInstalling ${folder} dependencies...`);
      await runNpm(['ci'], path.join(root, folder));
    }
  }

  console.log('\nSetup preparation complete.');
  console.log('Next: set DATABASE_URL in backend/.env to your PostgreSQL/Supabase connection string.');
  console.log('Run database/01_schema.sql and database/02_security_and_storage.sql in your database.');
  console.log('Optionally run database/03_demo_data.sql, then start with: npm start');
}

main().catch((error) => {
  console.error(`Setup failed: ${error.message}`);
  process.exitCode = 1;
});
