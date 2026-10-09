# Legal and compliance notes

This is an engineering checklist, **not legal advice**. Talk to an excise/licensing lawyer in each state before launch.

- Alcohol is a **state subject** in India. Each state sets its own excise law, licence types, legal drinking age (commonly 21 or 25), shop timings and whether home delivery is allowed at all.
- You generally cannot sell alcohol without the right licence. A common model is a **marketplace partnership with already-licensed retailers**, but even that needs permission from the state excise department.
- The values in `server/db/seed.js` (`STATE_RULES`, store licences) are **demo placeholders**. Replace them with verified data. The server refuses delivery in any state whose `delivery_allowed` is 0.
- Keep the in-app health message and the "do not drink and drive" notice. Many states restrict alcohol advertising; check before marketing.
- Keep records: `audit_log`, `order_events` and the `id_checked` flag exist so you can show inspectors who delivered what, to whom, and when.
- Never deliver without a physical ID check, to anyone who looks intoxicated, or to anyone underage. The rider app has a one-tap refuse button for this.
