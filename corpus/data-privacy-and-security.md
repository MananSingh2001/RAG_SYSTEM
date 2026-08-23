# Data Privacy and Security

A retrieval system holds a copy of a document corpus and a set of API
credentials, so it carries real privacy and security obligations even at demo
scale.

## Secret management

Service credentials, such as a database service-role key that bypasses row-level
security, must live server-side only and never reach the browser. Keys belong in
environment variables, and the environment file must be excluded from version
control. A key that is ever pasted into a shared channel or committed to a
repository should be treated as compromised and rotated immediately.

## Server-side boundaries

In a deployed system, all calls that use privileged keys run inside server-side
functions. The client sends a question to an endpoint and receives an answer; it
never holds a provider key. This boundary is what lets a public demo exist
without exposing credentials in the shipped JavaScript bundle.

## Free-tier data handling

Free tiers of hosted model providers sometimes reserve the right to use
submitted inputs to improve their models. That is acceptable for a public sample
corpus but not for confidential or regulated data. Moving regulated data across
regions can also trigger legal obligations, so the provider's terms should be
reviewed before real data is sent.

## Access to the endpoint

A public answering endpoint can be called by anyone, which means anyone can
consume the quota it is backed by. Basic rate limiting per client, and a cap on
request size, keep a demo from being drained or driven into overage.

## Minimizing exposure

The safest system stores only what it needs, keeps personally identifying
information out of the corpus where possible, and logs questions and answers
with care, since those logs can themselves contain sensitive text.
