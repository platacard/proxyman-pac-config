import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'dist');
const placeholder = '{{PROXY}}';
const defaultPort = 9090;
const sampleProxy = `192.168.0.1:${defaultPort}`;
const namePattern = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

const readText = (file) => readFileSync(join(root, file), 'utf8');
const readJson = (file) => JSON.parse(readText(file));

const pacHelpers = {
  shExpMatch: (str, pattern) =>
    new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`).test(str),
  dnsDomainIs: (host, domain) => host.endsWith(domain),
  isPlainHostName: (host) => !host.includes('.'),
  localHostOrDomainIs: (host, hostdom) => host === hostdom || hostdom.startsWith(`${host}.`),
  dnsDomainLevels: (host) => host.split('.').length - 1,
};

const isPrivateIPv4 = (ip) => {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  if (octets.some((octet) => octet > 255)) return false;
  const [a, b] = octets;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
};

const parseProxy = (value) => {
  if (typeof value !== 'string') return null;
  const match = /^([\d.]+)(?::(\d{1,5}))?$/.exec(value.trim());
  if (!match || !isPrivateIPv4(match[1])) return null;
  const port = match[2] ? Number(match[2]) : defaultPort;
  return port >= 1 && port <= 65535 ? `${match[1]}:${port}` : null;
};

const render = (template, proxy) => template.replaceAll(placeholder, proxy);

const verify = (pac, proxy, checks) => {
  const context = vm.createContext({ ...pacHelpers });
  vm.runInContext(pac, context, { timeout: 1000 });
  if (typeof context.FindProxyForURL !== 'function') return ['FindProxyForURL is not defined'];
  const resolve = (host) => {
    context.checkHost = host;
    return vm.runInContext('FindProxyForURL(`https://${checkHost}/`, checkHost)', context, { timeout: 1000 });
  };
  const problems = [];
  for (const host of checks.proxy ?? []) {
    const result = resolve(host);
    if (!String(result).startsWith(`PROXY ${proxy}`)) problems.push(`${host} must go through ${proxy}, got "${result}"`);
  }
  for (const host of checks.direct ?? []) {
    const result = resolve(host);
    if (result !== 'DIRECT') problems.push(`${host} must go DIRECT, got "${result}"`);
  }
  return problems;
};

const template = readText('template.pac');
const testers = readJson('testers.json');
const checks = readJson('checks.json');
const errors = [];

if (!template.includes(placeholder)) errors.push(`template.pac: ${placeholder} placeholder is missing`);

try {
  errors.push(...verify(render(template, sampleProxy), sampleProxy, checks).map((problem) => `template.pac: ${problem}`));
} catch (error) {
  errors.push(`template.pac: ${error.message}`);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const isObject = testers !== null && typeof testers === 'object' && !Array.isArray(testers);
if (!isObject) errors.push('testers.json must be an object like { "egor.danilov": "192.168.0.26" }');
const names = isObject ? Object.keys(testers).sort() : [];

for (const name of names) {
  if (!namePattern.test(name)) {
    errors.push(`testers.json: "${name}" must be a lowercase login like egor.danilov`);
    continue;
  }
  const proxy = parseProxy(testers[name]);
  if (!proxy) {
    errors.push(`testers.json: "${name}" must be a private IPv4 address with an optional port, got ${JSON.stringify(testers[name])}`);
    continue;
  }
  const pac = render(template, proxy);
  writeFileSync(join(outDir, `${name}.pac`), pac);
}

writeFileSync(
  join(outDir, 'index.html'),
  '<!doctype html>\n<html lang="en">\n<meta charset="utf-8">\n<title>Proxyman PAC files</title>\n<p>Proxy auto-config files for mobile QA. Personal file: <code>&lt;login&gt;.pac</code> next to this page.</p>\n</html>\n',
);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`Built ${names.length} PAC file(s) in dist/`);
