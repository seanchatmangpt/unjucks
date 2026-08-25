# Security Policy

## Scope

This policy applies to the Unjucks source tree, build and release automation, GitHub Actions workflows, and repository-managed configuration.

## Reporting a vulnerability

Do not disclose a suspected vulnerability in a public issue, pull request, discussion, or other public channel.

Use GitHub's private vulnerability-reporting or Security Advisory capability for this repository when available. Include enough information to reproduce and assess the issue, including:

- affected component and version or commit;
- reproduction steps or a minimal proof of concept;
- expected and observed behavior;
- likely impact and prerequisites;
- any known workaround or containment action.

If private reporting is unavailable, avoid publishing exploit details and contact a repository maintainer through an established private channel before disclosure.

## Triage and remediation

Maintainers should classify reports by exploitability, impact, affected surface, and exposure. Remediation priority is severity-driven. Security-sensitive fixes should preserve least privilege, reviewability, deterministic build behavior, and an auditable change history.

A report is not considered resolved solely because a patch exists. Closure should include the applicable verification evidence, affected-version assessment, and any required release or operational follow-up.

## Supported code

Security fixes are targeted at the default branch and any release line that is actively maintained at the time of the report. Historical or unsupported revisions are not guaranteed to receive fixes.

## Coordinated disclosure

Public disclosure should occur only after maintainers have had a reasonable opportunity to validate, remediate, and distribute a fix, unless continued nondisclosure would create greater security risk.

## Compliance evidence boundary

This document provides repository-level evidence that an information-security policy and vulnerability-reporting procedure exist. Automated repository checks may use it as one input to security-control readiness.

Passing those checks does **not** by itself establish organizational ISO/IEC 27001 certification, an accredited audit result, or complete implementation of an information security management system (ISMS). Such claims require the applicable organizational scope, risk treatment, operating evidence, audit evidence, and certification process.