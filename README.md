### support-analytics

#### bandit

Consists of three lambdas that make up a state machine for recording view and acquisition data for multi-armed bandit experiments. See [Bandit README](bandit/README.md) for more detail.

#### super-mode-calculator

A single lambda that queries BigQuery on an hourly schedule and writes to a DynamoDb table.

Used by support-dotcom-components for "Epic Super Mode", which boosts epic views on high-performing content.
