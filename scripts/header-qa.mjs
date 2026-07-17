import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_BASE_URL = 'http://127.0.0.1:3000';
const DEFAULT_TIMEOUT_MS = 15_000;
const VIEWPORTS = new Map([
    [1280, { name: 'desktop', width: 1280, height: 900 }],
    [768, { name: 'tablet', width: 768, height: 900 }],
    [375, { name: 'mobile', width: 375, height: 812 }],
]);

const args = process.argv.slice(2);
const getArg = (name) => {
    const index = args.indexOf(name);
    if (index >= 0) return args[index + 1];
    const inline = args.find((arg) => arg.startsWith(name + '='));
    return inline ? inline.slice(name.length + 1) : undefined;
};

const baseUrl = getArg('--base-url') || process.env.SIGNAL_QA_URL || DEFAULT_BASE_URL;
const timeoutMs = Number(getArg('--timeout') || process.env.SIGNAL_QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
const captureScreenshots = !args.includes('--no-screenshots') && process.env.SIGNAL_QA_SCREENSHOTS !== '0';
const requestedRoutes = (getArg('--route') || '/,/research')
    .split(',')
    .map((route) => route.trim())
    .filter(Boolean)
    .map((route) => (route.startsWith('/') ? route : '/' + route));
const requestedWidths = (getArg('--viewport') || '1280,768,375')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);

const viewports = requestedWidths.map((width) => {
    const knownViewport = VIEWPORTS.get(width);
    return knownViewport || {
        name: `width-${width}`,
        width,
        height: width <= 480 ? 812 : 900,
    };
});

const startedAt = Date.now();
const timestamp = new Date().toISOString().replace(/[.:]/g, '-');
const evidenceDir = path.resolve(
    process.env.SIGNAL_QA_EVIDENCE_DIR || path.join('.tmp', 'signal-header-qa', timestamp),
);
const reportPath = path.join(evidenceDir, 'report.json');
const report = {
    command: 'npm run qa:header',
    baseUrl,
    timeoutMs,
    captureScreenshots,
    scenarios: [],
    warnings: [],
    fatalError: null,
};

const shorten = (value, limit = 320) => {
    const text = String(value).replace(/\s+/g, ' ').trim();
    return text.length > limit ? text.slice(0, limit - 3) + '...' : text;
};

const addIssue = (scenario, category, message, blocking) => {
    const issue = { category, message: shorten(message), blocking };
    if (scenario) scenario.issues.push(issue);
    else report.warnings.push(issue);
};

const parseOrigin = (value) => {
    try {
        return new URL(value).origin;
    } catch {
        return null;
    }
};

const isAbortedRequest = (request) => (request.failure()?.errorText || '').includes('ERR_ABORTED');

const runCheck = (checks, name, condition, details) => {
    const passed = Boolean(condition);
    checks.push({ name, status: passed ? 'passed' : 'failed', details });
    if (!passed) throw new Error(`${name}: ${details}`);
};

const inspectHeader = async (page, routePath, viewport) => page.evaluate(({ routePath: currentRoute, viewportWidth }) => {
    const header = document.querySelector('header[aria-label="Signal application header"]');
    const inner = header?.firstElementChild;
    const nav = header?.querySelector('nav[aria-label="Primary"]');
    const toggle = header?.querySelector('button[aria-label^="Switch to"]');
    const command = header?.querySelector('[aria-label="Market briefing controls"]');
    const researchControls = header?.querySelector('[aria-label="Research controls"]');
    const rect = (element) => {
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
    };
    const navLinks = nav
        ? [...nav.querySelectorAll('a')].map((link) => ({
            label: link.textContent?.trim() || '',
            ariaCurrent: link.getAttribute('aria-current'),
            rect: rect(link),
            clientWidth: link.clientWidth,
            scrollWidth: link.scrollWidth,
        }))
        : [];
    const headerStyle = header ? getComputedStyle(header) : null;
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0);
    const expectedInnerWidth = Math.min(viewportWidth - 48, 1280);
    return {
        header: rect(header),
        inner: rect(inner),
        nav: rect(nav),
        navLinks,
        toggle: rect(toggle),
        command: rect(command),
        researchControls: rect(researchControls),
        borderBottomWidth: headerStyle ? Number.parseFloat(headerStyle.borderBottomWidth) : 0,
        borderBottomStyle: headerStyle?.borderBottomStyle || 'none',
        documentWidth,
        viewportWidth,
        expectedInnerWidth,
        themePressed: toggle?.getAttribute('aria-pressed') || null,
        themeLabel: toggle?.getAttribute('aria-label') || null,
        routeSurface: currentRoute.startsWith('/research') ? 'research' : 'market',
    };
}, { routePath, viewportWidth: viewport.width });

const main = async () => {
    await mkdir(evidenceDir, { recursive: true });
    const baseOrigin = parseOrigin(baseUrl);
    if (!baseOrigin) throw new Error(`Invalid base URL: ${baseUrl}`);
    if (viewports.length === 0) throw new Error('No valid viewport widths were provided.');
    if (requestedRoutes.length === 0) throw new Error('No routes were provided.');

    let browser = null;
    let currentScenario = null;
    try {
        const response = await fetch(baseUrl, { signal: AbortSignal.timeout(timeoutMs) });
        if (!response.ok) throw new Error(`Base URL returned HTTP ${response.status}: ${baseUrl}`);

        browser = await chromium.launch({ headless: !args.includes('--headed') });
        const context = await browser.newContext();
        context.setDefaultTimeout(timeoutMs);
        const page = await context.newPage();

        page.on('console', (message) => {
            if (message.type() === 'warning') {
                addIssue(currentScenario, 'console-warning', message.text(), false);
            }
            if (message.type() === 'error') {
                addIssue(currentScenario, 'console-error', message.text(), true);
            }
        });
        page.on('pageerror', (error) => addIssue(currentScenario, 'page-error', error.message, true));
        page.on('requestfailed', (request) => {
            if (isAbortedRequest(request)) return;
            const requestOrigin = parseOrigin(request.url());
            const sameOrigin = requestOrigin === baseOrigin;
            addIssue(
                currentScenario,
                'request-failed',
                `${request.method()} ${request.url()} (${request.failure()?.errorText || 'unknown failure'})`,
                sameOrigin,
            );
        });
        page.on('response', (response) => {
            if (response.status() < 400) return;
            const responseOrigin = parseOrigin(response.url());
            const sameOrigin = responseOrigin === baseOrigin;
            addIssue(
                currentScenario,
                'http-response',
                `${response.status()} ${response.request().method()} ${response.url()}`,
                sameOrigin,
            );
        });

        for (const route of requestedRoutes) {
            const routePath = new URL(route, baseUrl).pathname;
            for (const viewport of viewports) {
                const scenario = {
                    route,
                    viewport: `${viewport.width}x${viewport.height}`,
                    screenshot: null,
                    checks: [],
                    issues: [],
                    durationMs: 0,
                    status: 'failed',
                };
                report.scenarios.push(scenario);
                currentScenario = scenario;
                const scenarioStartedAt = Date.now();
                try {
                    await page.setViewportSize({ width: viewport.width, height: viewport.height });
                    const navigationResponse = await page.goto(new URL(route, baseUrl).toString(), {
                        waitUntil: 'domcontentloaded',
                        timeout: timeoutMs,
                    });
                    runCheck(
                        scenario.checks,
                        'document response',
                        navigationResponse?.ok() === true,
                        navigationResponse ? `HTTP ${navigationResponse.status()}` : 'navigation did not return a response',
                    );

                    const header = page.locator('header[aria-label="Signal application header"]');
                    await header.waitFor({ state: 'visible', timeout: timeoutMs });
                    await page.locator('nav[aria-label="Primary"] a').nth(1).waitFor({ state: 'visible', timeout: timeoutMs });
                    const details = await inspectHeader(page, routePath, viewport);
                    const expectedSurface = routePath.startsWith('/research') ? 'research' : 'market';
                    const linkLabels = details.navLinks.map((link) => link.label);
                    const navBounds = details.nav;
                    const linksVisible = Boolean(navBounds) && details.navLinks.length === 2 && details.navLinks.every((link) => (
                        Boolean(link.rect)
                        && link.rect.width > 0
                        && link.rect.left >= navBounds.left - 1
                        && link.rect.right <= navBounds.right + 1
                        && link.scrollWidth <= link.clientWidth + 1
                    ));
                    const documentOverflow = details.documentWidth - details.viewportWidth;
                    const innerWidthDelta = details.inner ? Math.abs(details.inner.width - details.expectedInnerWidth) : Infinity;
                    const toggleSize = details.toggle
                        ? Math.abs(details.toggle.width - 52) <= 1 && Math.abs(details.toggle.height - 28) <= 1
                        : false;

                    runCheck(scenario.checks, 'shared header visible', Boolean(details.header), 'header[aria-label="Signal application header"] is visible');
                    runCheck(scenario.checks, 'header content width', innerWidthDelta <= 2, `inner width ${details.inner?.width ?? 'missing'}; expected ${details.expectedInnerWidth}`);
                    runCheck(scenario.checks, 'bottom hairline', details.borderBottomStyle === 'solid' && details.borderBottomWidth > 0 && details.borderBottomWidth <= 1, `${details.borderBottomStyle} ${details.borderBottomWidth}px`);
                    runCheck(scenario.checks, 'primary navigation labels', linkLabels.join('|') === 'Market|Research', linkLabels.join('|') || 'no links');
                    const selectedLabel = details.navLinks.find((link) => link.ariaCurrent === 'page')?.label;
                    runCheck(scenario.checks, 'primary navigation selected state', selectedLabel === (expectedSurface === 'market' ? 'Market' : 'Research'), selectedLabel || 'no selected link');
                    runCheck(scenario.checks, 'primary navigation fully visible', linksVisible, `nav ${navBounds ? `${navBounds.width}px` : 'missing'}`);
                    runCheck(scenario.checks, 'document has no horizontal overflow', documentOverflow <= 1, `${details.documentWidth}px document width on ${details.viewportWidth}px viewport`);
                    runCheck(scenario.checks, 'theme toggle dimensions', toggleSize, details.toggle ? `${details.toggle.width}x${details.toggle.height}` : 'toggle missing');
                    runCheck(scenario.checks, `${expectedSurface} surface present`, Boolean(expectedSurface === 'market' ? details.command : details.researchControls), expectedSurface === 'market' ? 'market briefing controls' : 'research controls');

                    const toggle = header.locator('button[aria-label^="Switch to"]');
                    await page.waitForFunction(
                        () => document.documentElement.getAttribute('data-theme-ready') === 'true',
                        undefined,
                        { timeout: timeoutMs },
                    );
                    const initialPressed = await toggle.getAttribute('aria-pressed');
                    runCheck(scenario.checks, 'theme toggle exposes state', initialPressed === 'true' || initialPressed === 'false', initialPressed || 'missing aria-pressed');
                    await toggle.click();
                    await page.waitForFunction(
                        (previous) => document.querySelector('header[aria-label="Signal application header"] button[aria-label^="Switch to"]')?.getAttribute('aria-pressed') !== previous,
                        initialPressed,
                        { timeout: timeoutMs },
                    );
                    const switchedPressed = await toggle.getAttribute('aria-pressed');
                    runCheck(scenario.checks, 'theme toggle changes state', switchedPressed !== initialPressed, `${initialPressed} -> ${switchedPressed}`);
                    await toggle.click();
                    await page.waitForFunction(
                        (expected) => document.querySelector('header[aria-label="Signal application header"] button[aria-label^="Switch to"]')?.getAttribute('aria-pressed') === expected,
                        initialPressed,
                        { timeout: timeoutMs },
                    );
                    runCheck(scenario.checks, 'theme toggle restores state', await toggle.getAttribute('aria-pressed') === initialPressed, `restored ${initialPressed}`);

                    if (captureScreenshots) {
                        const filename = `${routePath === '/' ? 'main' : 'research'}-${viewport.name}-${viewport.width}x${viewport.height}.png`;
                        const screenshotPath = path.join(evidenceDir, filename);
                        await page.screenshot({ path: screenshotPath, fullPage: false });
                        scenario.screenshot = screenshotPath;
                    }
                    scenario.status = 'passed';
                } catch (error) {
                    scenario.error = shorten(error instanceof Error ? error.message : error);
                } finally {
                    scenario.durationMs = Date.now() - scenarioStartedAt;
                }
            }
        }
        await context.close();
    } catch (error) {
        report.fatalError = shorten(error instanceof Error ? error.message : error);
    } finally {
        if (browser) await browser.close();
    }

    report.durationMs = Date.now() - startedAt;
    report.passedScenarios = report.scenarios.filter((scenario) => scenario.status === 'passed').length;
    report.failedScenarios = report.scenarios.length - report.passedScenarios;
    await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

    const blockingIssueCount = report.scenarios.reduce(
        (count, scenario) => count + scenario.issues.filter((issue) => issue.blocking).length,
        0,
    );
    console.log(`Header QA ${report.fatalError || report.failedScenarios > 0 || blockingIssueCount > 0 ? 'FAILED' : 'PASSED'} in ${report.durationMs}ms`);
    for (const scenario of report.scenarios) {
        const suffix = scenario.error ? `: ${scenario.error}` : '';
        console.log(`${scenario.status === 'passed' ? 'PASS' : 'FAIL'} ${scenario.route} ${scenario.viewport} (${scenario.durationMs}ms)${suffix}`);
    }
    if (report.warnings.length > 0) console.log(`WARN run-level issues: ${report.warnings.length}`);
    console.log(`Evidence report: ${reportPath}`);

    if (report.fatalError || report.failedScenarios > 0 || blockingIssueCount > 0) {
        process.exitCode = 1;
    }
};

main().catch((error) => {
    console.error(`Header QA could not start: ${shorten(error instanceof Error ? error.message : error)}`);
    process.exitCode = 1;
});
