import test from "node:test";
import assert from "node:assert/strict";
import { TARGET, createApi, deploymentBody, deployVerified, readConfiguration } from "../scripts/deploy-verified.mjs";

const sha = "abcdef0123".repeat(4);
const env = {
  GITHUB_SHA: sha,
  GITHUB_REPOSITORY: TARGET.repository,
  GITHUB_REPOSITORY_ID: TARGET.repositoryId,
  GITHUB_REF: TARGET.ref,
  VERCEL_PROJECT_ID: TARGET.projectId,
  VERCEL_ORG_ID: TARGET.orgId,
  VERCEL_TOKEN: "test-token-never-log",
};
const id = "dpl_TestDeployment123";
const ready = {
  id, projectId: TARGET.projectId, target: "production", readyState: "READY",
  gitSource: { type: "github", repoId: Number(TARGET.repositoryId), sha },
  meta: { githubCommitSha: sha }, aliasAssigned: true, alias: [TARGET.alias],
};
const alias = { alias: TARGET.alias, projectId: TARGET.projectId, deploymentId: id, deployment: { id } };

function harness(responses) {
  let elapsed = 0;
  const calls = [];
  const logs = [];
  return {
    calls, logs,
    dependencies: {
      api: async (...args) => {
        calls.push(args);
        const response = responses.shift();
        assert.ok(response, "Unexpected API call");
        return response;
      },
      now: () => elapsed,
      sleep: async (ms) => { assert.ok(ms <= 15_000); elapsed += ms; },
      log: (message) => logs.push(message),
    },
  };
}

test("configuration rejects any other repository, branch, project, team, or missing secret before API calls", async () => {
  for (const key of Object.keys(env)) {
    let called = false;
    await assert.rejects(deployVerified({ ...env, [key]: "" }, { api: () => { called = true; } }));
    assert.equal(called, false);
  }
  assert.throws(() => readConfiguration({ ...env, GITHUB_REF: "refs/pull/1/merge" }));
  assert.throws(() => readConfiguration({ ...env, GITHUB_SHA: "main" }));
  assert.throws(() => readConfiguration({ ...env, GITHUB_SHA: `${sha}\n` }));
  assert.throws(() => readConfiguration({ ...env, VERCEL_TOKEN: "token\n" }));
});

test("creates only the verified commit and waits for both readiness and canonical alias assignment", async () => {
  const h = harness([
    { id }, { ...ready, readyState: "BUILDING", aliasAssigned: false, alias: [] },
    { ...ready, aliasAssigned: false }, ready,
    { ...alias, deploymentId: "dpl_Previous", deployment: { id: "dpl_Previous" } }, ready, alias,
  ]);
  assert.deepEqual(await deployVerified(env, h.dependencies), { id, url: "https://gastro-intranet.vercel.app" });
  assert.deepEqual(h.calls[0], ["POST", `/v13/deployments?teamId=${TARGET.orgId}`, deploymentBody(sha)]);
  assert.equal(h.calls.filter(([method]) => method === "POST").length, 1);
  assert.ok(h.calls.some(([, endpoint]) => endpoint.endsWith("&withGitRepoInfo=true")));
  assert.ok(h.calls.some(([, endpoint]) => endpoint.startsWith(`/v4/aliases/${TARGET.alias}?`)));
  assert.equal(h.logs.join("\n").includes(env.VERCEL_TOKEN), false);
});

test("rejects failed deployments and mismatched project, repository, commit, target, and alias identity", async () => {
  for (const change of [
    { readyState: "ERROR" }, { readyState: "CANCELED" }, { readyState: "BLOCKED" },
    { id: "dpl_Other" }, { projectId: "prj_Other" }, { target: "preview" },
    { gitSource: { ...ready.gitSource, repoId: 123 } },
    { gitSource: { ...ready.gitSource, sha: "0".repeat(40) } },
    { meta: { githubCommitSha: "0".repeat(40) } }, { aliasError: { message: "private-provider-error" } },
  ]) {
    const h = harness([{ id }, { ...ready, ...change }]);
    await assert.rejects(deployVerified(env, h.dependencies));
    assert.equal(h.calls.filter(([method]) => method === "POST").length, 1);
  }
  const h = harness([{ id }, ready, { ...alias, projectId: "prj_Other" }]);
  await assert.rejects(deployVerified(env, h.dependencies), /alias does not match/);
});

test("times out without re-creating a deployment if the production alias never becomes current", async () => {
  let postCount = 0;
  let elapsed = 0;
  await assert.rejects(deployVerified(env, {
    api: (method) => {
      if (method === "POST") { postCount++; return { id }; }
      return { ...ready, aliasAssigned: false };
    },
    now: () => elapsed,
    sleep: async (ms) => { elapsed += ms; },
    log: () => {},
  }), /timed out/);
  assert.equal(postCount, 1);
  assert.equal(elapsed, 15 * 60_000);
});

test("CLI uses stdin JSON, piped outputs, a bounded timeout, and never exposes raw command errors", () => {
  const api = createApi(env.VERCEL_TOKEN, (command, args, options) => {
    assert.equal(command, "vercel");
    assert.deepEqual(args, ["api", "/v13/deployments", "--method", "POST", "--raw", "--token", env.VERCEL_TOKEN, "--input", "-"]);
    assert.equal(options.timeout, 60_000);
    assert.deepEqual(options.stdio, ["pipe", "pipe", "pipe"]);
    assert.deepEqual(JSON.parse(options.input), deploymentBody(sha));
    return JSON.stringify({ id });
  });
  assert.deepEqual(api("POST", "/v13/deployments", deploymentBody(sha)), { id });
  const fail = createApi(env.VERCEL_TOKEN, () => { throw new Error(`Command failed --token ${env.VERCEL_TOKEN}`); });
  assert.throws(() => fail("GET", "/anything"), (error) => !String(error).includes(env.VERCEL_TOKEN));
  assert.throws(() => createApi(env.VERCEL_TOKEN, () => "not json")("GET", "/anything"), /invalid response/);
  assert.throws(() => createApi(env.VERCEL_TOKEN, () => JSON.stringify({ error: { message: env.VERCEL_TOKEN } }))("GET", "/anything"), (error) => !String(error).includes(env.VERCEL_TOKEN));
});
