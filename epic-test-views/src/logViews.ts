import {
  KinesisStreamEvent,
	Context,
  ProxyCallback
} from 'aws-lambda';
import * as Redis from "ioredis";

const TESTS_KEY = 'tests';
const TESTS_VIEWS_KEY = 'tests:views:';

const ELASTICACHE_HOST = 'epic-test-views.yh9tc4.0001.euw1.cache.amazonaws.com';
const ELASTICACHE_PORT = 6379;

interface EpicTestView {
  test: string;
}

export async function handler(event: KinesisStreamEvent, context: Context, callback: ProxyCallback) {
  const views: EpicTestView[] = event.Records.map(record => {
    const data = Buffer.from(record.kinesis.data, 'base64').toString('ascii')
    const view = JSON.parse(data);

    return view;
  })
  console.log({ views });

  const client = new Redis(ELASTICACHE_PORT, ELASTICACHE_HOST);

  await Promise.all(views.map(view => {
    logView(view.test, client)
  }));

  client.quit();
  callback();
}


  async function logView(test: string, client: Redis.Redis) {
    const now = Date.now();

    await client
      .multi()
      .zadd(TESTS_KEY, now, test)
      .zadd(TESTS_VIEWS_KEY + test, now, now)
      .expire(TESTS_VIEWS_KEY + test, 60 * 1000)
      .exec();
  }