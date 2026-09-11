# 15 — Operational Scripts

Maintained scripts live under target categories `audit`, `migrate`, `repair`, `seed`, or `verify`.

Every mutating script must:

1. state purpose, collections/providers, environment, and rollback in its header;
2. default to test/dry-run;
3. require explicit execution flag for production;
4. print resolved environment and masked target;
5. use application environment guards;
6. refuse empty/unresolved/broad mutation filters;
7. print cohort count and safe samples before mutation;
8. be idempotent or checkpointed;
9. record successes/failures and before/after counts;
10. provide verification mode/query;
11. avoid embedded URI, secret, real phone, event-specific live constant, or private key;
12. require backup for material production mutation.

`scratch_*`, `final_*`, `fix_*`, and date-stamped scripts are historical clues, not automatically safe reusable tools. Promote needed logic into a guarded purpose-named script before reuse.

