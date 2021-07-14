import * as Redis from "ioredis";

const TESTS_KEY = 'tests';
const TESTS_VIEWS_KEY = 'tests:views:';

const ELASTICACHE_HOST = 'epic-test-views.yh9tc4.0001.euw1.cache.amazonaws.com';
const ELASTICACHE_PORT = 6379;

export async function handler() {
  const client = new Redis(ELASTICACHE_PORT, ELASTICACHE_HOST);

  const tests = await getAllTests(client);

  const views: { [test: string]: number } = {};
  for (let test of tests) {
    views[test] = await getViews(test, client);
  }

  console.log({ views })

  client.quit();
}

async function getAllTests(client: Redis.Redis) {
  const [, [, tests]] = await client
    .multi()
    .zremrangebyscore(TESTS_KEY, 0, expirationMs())
    .zrange(TESTS_KEY, 0, -1)
    .exec();

  return tests;
}

async function getViews(test: string, client: Redis.Redis) {
  const [, [, reply]] = await client
    .multi()
    .zremrangebyscore(TESTS_VIEWS_KEY + test, 0, expirationMs())
    .zcard(TESTS_VIEWS_KEY + test)
    .exec();

  return parseInt(reply);
}

function expirationMs() {
  return Date.now() - 60_000;
}