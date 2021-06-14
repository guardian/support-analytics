### support-analytics


#### component-event-stream

Consists of an API gateway integrated with a kinesis stream for recording realtime component events from dotcom.

Currently there is a single endpoint, `/epic-view`. In the future we could have many endpoints and many streams.

The API is behind fastly at:

- PROD - https://contributions.guardianapis.com/events/epic-view
- CODE - https://contributions.code.dev-guardianapis.com/events/epic-view

Fastly routes any requests with a path starting `/events/` to the API, dropping the `/events/` prefix.

