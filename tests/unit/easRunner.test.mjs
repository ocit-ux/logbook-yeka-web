import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { resolveEasCommand, resolveGhPagesCommand, resolveExpoExportCommand } from '../../apps/mobile/update-semua.js';

test('resolveEasCommand on win32 prefers local node_modules bin if present', () => {
  const baseDir = 'C:\\workspace\\apps\\mobile';
  const expectedLocal = `"${path.win32.join(baseDir, 'node_modules', '.bin', 'eas.cmd')}"`;

  const mockFs = {
    existsSync: (targetPath) => targetPath === path.win32.join(baseDir, 'node_modules', '.bin', 'eas.cmd')
  };
  const mockExecSync = () => {
    throw new Error('Should not call execSync when local bin exists');
  };

  const cmd = resolveEasCommand(baseDir, 'win32', { fs: mockFs, execSync: mockExecSync });
  assert.strictEqual(cmd, expectedLocal);
});

test('resolveEasCommand on win32 falls back to monorepo root node_modules bin', () => {
  const baseDir = 'C:\\workspace\\apps\\mobile';
  const expectedRoot = `"${path.win32.resolve(baseDir, '../../node_modules/.bin', 'eas.cmd')}"`;

  const mockFs = {
    existsSync: (targetPath) => targetPath === path.win32.resolve(baseDir, '../../node_modules/.bin', 'eas.cmd')
  };
  const mockExecSync = () => {
    throw new Error('Should not call execSync when root bin exists');
  };

  const cmd = resolveEasCommand(baseDir, 'win32', { fs: mockFs, execSync: mockExecSync });
  assert.strictEqual(cmd, expectedRoot);
});

test('resolveEasCommand on win32 checks system PATH with where eas', () => {
  const baseDir = 'C:\\workspace\\apps\\mobile';
  let executedCmd = null;

  const mockFs = {
    existsSync: () => false
  };
  const mockExecSync = (cmd) => {
    executedCmd = cmd;
    return 'C:\\global\\eas.cmd\n';
  };

  const cmd = resolveEasCommand(baseDir, 'win32', { fs: mockFs, execSync: mockExecSync });
  assert.strictEqual(executedCmd, 'where eas');
  assert.strictEqual(cmd, 'eas');
});

test('resolveEasCommand on win32 falls back to npx.cmd when not in PATH', () => {
  const baseDir = 'C:\\workspace\\apps\\mobile';

  const mockFs = {
    existsSync: () => false
  };
  const mockExecSync = () => {
    const error = new Error('where: not found');
    error.status = 1;
    throw error;
  };

  const cmd = resolveEasCommand(baseDir, 'win32', { fs: mockFs, execSync: mockExecSync });
  assert.strictEqual(cmd, 'npx.cmd --yes eas-cli');
});

test('resolveEasCommand on unix prefers local node_modules bin if present', () => {
  const baseDir = '/home/user/workspace/apps/mobile';
  const expectedLocal = `"${path.posix.join(baseDir, 'node_modules', '.bin', 'eas')}"`;

  const mockFs = {
    existsSync: (targetPath) => targetPath === path.posix.join(baseDir, 'node_modules', '.bin', 'eas')
  };
  const mockExecSync = () => {
    throw new Error('Should not call execSync when local bin exists');
  };

  const cmd = resolveEasCommand(baseDir, 'linux', { fs: mockFs, execSync: mockExecSync });
  assert.strictEqual(cmd, expectedLocal);
});

test('resolveEasCommand on unix falls back to monorepo root node_modules bin', () => {
  const baseDir = '/home/user/workspace/apps/mobile';
  const expectedRoot = `"${path.posix.resolve(baseDir, '../../node_modules/.bin', 'eas')}"`;

  const mockFs = {
    existsSync: (targetPath) => targetPath === path.posix.resolve(baseDir, '../../node_modules/.bin', 'eas')
  };
  const mockExecSync = () => {
    throw new Error('Should not call execSync when root bin exists');
  };

  const cmd = resolveEasCommand(baseDir, 'linux', { fs: mockFs, execSync: mockExecSync });
  assert.strictEqual(cmd, expectedRoot);
});

test('resolveEasCommand on unix checks system PATH with which eas', () => {
  const baseDir = '/home/user/workspace/apps/mobile';
  let executedCmd = null;

  const mockFs = {
    existsSync: () => false
  };
  const mockExecSync = (cmd) => {
    executedCmd = cmd;
    return '/usr/local/bin/eas\n';
  };

  const cmd = resolveEasCommand(baseDir, 'linux', { fs: mockFs, execSync: mockExecSync });
  assert.strictEqual(executedCmd, 'which eas');
  assert.strictEqual(cmd, 'eas');
});

test('resolveEasCommand on unix falls back to npx when not in PATH', () => {
  const baseDir = '/home/user/workspace/apps/mobile';

  const mockFs = {
    existsSync: () => false
  };
  const mockExecSync = () => {
    const error = new Error('which: not found');
    error.status = 1;
    throw error;
  };

  const cmd = resolveEasCommand(baseDir, 'linux', { fs: mockFs, execSync: mockExecSync });
  assert.strictEqual(cmd, 'npx --yes eas-cli');
});

test('resolveEasCommand defaults to baseDir and process.platform without throwing', () => {
  const cmd = resolveEasCommand();
  assert.ok(typeof cmd === 'string');
  assert.ok(cmd.length > 0);
  if (process.platform === 'win32') {
    assert.ok(cmd.includes('eas') || cmd.includes('npx.cmd'));
  } else {
    assert.ok(cmd.includes('eas') || cmd.includes('npx'));
  }
});

test('resolveGhPagesCommand on win32 prefers local bin if present', () => {
  const baseDir = 'C:\\workspace\\apps\\mobile';
  const expectedLocal = `"${path.win32.join(baseDir, 'node_modules', '.bin', 'gh-pages.cmd')}"`;

  const mockFs = {
    existsSync: (p) => p === path.win32.join(baseDir, 'node_modules', '.bin', 'gh-pages.cmd')
  };

  const cmd = resolveGhPagesCommand(baseDir, 'win32', { fs: mockFs });
  assert.strictEqual(cmd, expectedLocal);
});

test('resolveGhPagesCommand on win32 falls back to npx.cmd when not in PATH', () => {
  const baseDir = 'C:\\workspace\\apps\\mobile';
  const mockFs = { existsSync: () => false };
  const mockExecSync = () => {
    const error = new Error('not found');
    error.status = 1;
    throw error;
  };

  const cmd = resolveGhPagesCommand(baseDir, 'win32', { fs: mockFs, execSync: mockExecSync });
  assert.strictEqual(cmd, 'npx.cmd --yes gh-pages');
});

test('resolveGhPagesCommand on unix falls back to npx when not in PATH', () => {
  const baseDir = '/workspace/apps/mobile';
  const mockFs = { existsSync: () => false };
  const mockExecSync = () => {
    const error = new Error('not found');
    error.status = 1;
    throw error;
  };

  const cmd = resolveGhPagesCommand(baseDir, 'linux', { fs: mockFs, execSync: mockExecSync });
  assert.strictEqual(cmd, 'npx --yes gh-pages');
});

test('resolveExpoExportCommand resolves local or root bin or falls back to npx', () => {
  const baseDir = 'C:\\workspace\\apps\\mobile';
  const mockFs = { existsSync: () => false };

  const cmd = resolveExpoExportCommand(baseDir, 'win32', { fs: mockFs });
  assert.strictEqual(cmd, 'npx.cmd --yes expo export -p web');

  const cmdUnix = resolveExpoExportCommand(baseDir, 'linux', { fs: mockFs });
  assert.strictEqual(cmdUnix, 'npx --yes expo export -p web');
});
