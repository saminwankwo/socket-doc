import { describe, it, expect } from 'vitest';
import http from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, runCli, usage, type CliIO } from '../src/index.js';

const fixtures = fileURLToPath(new URL('./fixtures', import.meta.url));
const cleanSpec = join(fixtures, 'spec-clean.json');
const brokenSpec = join(fixtures, 'spec-with-errors.json');

function captureIO() {
  const out: string[] = [];
  const err: string[] = [];
  const io: CliIO = {
    out: (line) => out.push(line),
    err: (line) => err.push(line),
  };
  return {
    io,
    out,
    err,
    text: () => out.join('\n'),
    errText: () => err.join('\n'),
  };
}

describe('socketdocs cli — parseArgs', () => {
  it('parses url, file and output flags', () => {
    expect(parseArgs(['lint', '--url', 'http://x/spec.json'])).toMatchObject({
      command: 'lint',
      source: { url: 'http://x/spec.json' },
    });
    expect(
      parseArgs(['export-asyncapi', '--file=a.json', '--output', 'out.json']),
    ).toMatchObject({
      command: 'export-asyncapi',
      source: { file: 'a.json' },
      output: 'out.json',
    });
  });

  it('rejects ambiguous or unknown input', () => {
    expect(parseArgs(['lint', '--url', 'u', '--file', 'f']).error).toMatch(
      /not both/,
    );
    expect(parseArgs(['lint', '--nope']).error).toMatch(/Unknown option/);
    expect(parseArgs(['lint', 'extra', 'args']).error).toMatch(
      /Unexpected argument/,
    );
    expect(parseArgs(['lint', '--url']).error).toMatch(/Missing value/);
  });
});

describe('socketdocs cli — lint', () => {
  it('exits 1 and reports errors for a broken spec', async () => {
    const { io, text, errText } = captureIO();
    const code = await runCli(['lint', '--file', brokenSpec], io);

    expect(code).toBe(1);
    expect(text()).toContain("Duplicate error code 'BOOM'");
    expect(text()).toContain('missing required error code');
    expect(errText()).toMatch(/error\(s\)/);
  });

  it('exits 0 for a clean spec', async () => {
    const { io, text } = captureIO();
    const code = await runCli(['lint', '--file', cleanSpec], io);

    expect(code).toBe(0);
    expect(text()).toContain('✓ no errors');
  });

  it('lints a spec served by a live server', async () => {
    const server = http.createServer((_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          specVersion: '1.0',
          info: { title: 'Live', version: '1.0.0', description: 'live' },
          namespaces: {},
        }),
      );
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as { port: number }).port;

    try {
      const { io, text } = captureIO();
      const code = await runCli(
        ['lint', '--url', `http://127.0.0.1:${port}/spec.json`],
        io,
      );
      expect(code).toBe(0);
      expect(text()).toContain('✓ no errors');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('fails when the URL cannot be fetched', async () => {
    const { io, errText } = captureIO();
    const code = await runCli(
      ['lint', '--url', 'http://127.0.0.1:1/spec.json'],
      io,
    );
    expect(code).toBe(1);
    expect(errText()).toMatch(/Failed to fetch/);
  });
});

describe('socketdocs cli — export-asyncapi', () => {
  it('prints an AsyncAPI 3.0 document to stdout', async () => {
    const { io, text } = captureIO();
    const code = await runCli(['export-asyncapi', '--file', cleanSpec], io);

    expect(code).toBe(0);
    const document = JSON.parse(text());
    expect(document.asyncapi).toBe('3.0.0');
    expect(document.info.title).toBe('Clean API');
    expect(Object.keys(document.channels)).toEqual(['/chat']);
    expect(document.components.messages['_chat_send_message'].name).toBe(
      'send_message',
    );
  });

  it('writes the document to a file with --output', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'socketdocs-cli-'));
    const outFile = join(dir, 'asyncapi.json');
    try {
      const { io, text } = captureIO();
      const code = await runCli(
        ['export-asyncapi', '--file', cleanSpec, '-o', outFile],
        io,
      );

      expect(code).toBe(0);
      expect(text()).toContain(`AsyncAPI document written to ${outFile}`);
      const written = JSON.parse(await readFile(outFile, 'utf8'));
      expect(written.asyncapi).toBe('3.0.0');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('socketdocs cli — input and usage errors', () => {
  it('reports invalid JSON and non-spec documents', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'socketdocs-cli-'));
    const badJson = join(dir, 'bad.json');
    const notSpec = join(dir, 'not-spec.json');
    await writeFile(badJson, '{ nope', 'utf8');
    await writeFile(notSpec, JSON.stringify({ hello: 'world' }), 'utf8');

    try {
      const first = captureIO();
      expect(await runCli(['lint', '--file', badJson], first.io)).toBe(1);
      expect(first.errText()).toMatch(/not valid JSON/);

      const second = captureIO();
      expect(await runCli(['lint', '--file', notSpec], second.io)).toBe(1);
      expect(second.errText()).toMatch(/not a SocketDocs spec/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('returns exit code 2 for usage problems', async () => {
    const noArgs = captureIO();
    expect(await runCli([], noArgs.io)).toBe(2);
    expect(noArgs.errText()).toContain('Usage:');

    const unknown = captureIO();
    expect(await runCli(['frobnicate'], unknown.io)).toBe(2);
    expect(unknown.errText()).toMatch(/Unknown command/);

    const missingSource = captureIO();
    expect(await runCli(['lint'], missingSource.io)).toBe(1);
    expect(missingSource.errText()).toMatch(/No spec source given/);
  });

  it('prints help and version', async () => {
    const help = captureIO();
    expect(await runCli(['--help'], help.io)).toBe(0);
    expect(help.text()).toBe(usage());

    const version = captureIO();
    expect(await runCli(['--version'], version.io)).toBe(0);
    expect(version.text()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
