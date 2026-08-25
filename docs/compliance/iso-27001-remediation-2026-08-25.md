# ISO 27001 Repository-Control Remediation Receipt

Date: 2026-08-25
Repository: `seanchatmangpt/unjucks`
Historical failing run: `17598484165`
Historical failing commit: `7b932ce3b63d36df221627a649b00524ba84e9a9`
Remediation base: `5ecffdee7b02a407951db5918b3dafd28184d7b2`

## Status before remediation

The historical `ISO 27001 Compliance` job failed while the SOX, PCI-DSS, GDPR, setup, and evidence-collection jobs succeeded.

The historical workflow job logs are no longer available and the workflow artifacts have expired. This remediation therefore does not claim access to evidence that no longer exists. The failure was reconstructed from the exact historical workflow definition and repository tree.

The same repository-level A.5 evidence gap remained on the remediation base: neither `SECURITY.md` nor `.github/SECURITY.md` existed.

## Root cause

The ISO Annex A.5 repository probe in `.github/workflows/compliance-automation.yml` treats either `SECURITY.md` or `.github/SECURITY.md` as the required information-security-policy evidence.

The workflow scores eight controls and requires a 95% score. A single hard failure therefore yields 87% and fails the job. The missing security policy is sufficient to explain the observed ISO job failure without lowering the threshold or suppressing the control.

The validator is a repository-level readiness heuristic. Its control names must not be interpreted as proof of complete ISO/IEC 27001 implementation or certification.

## Evidence-retention defect

The historical workflow configured `EVIDENCE_RETENTION_DAYS: 2555` and described that as seven-year retention. The artifacts produced by run `17598484165` nevertheless expired on 2025-12-08, approximately 90 days after the 2025-09-09 run.

Therefore GitHub Actions artifact storage is treated here as transient CI evidence, not as a seven-year compliance records system. The replacement repository-readiness gate explicitly requests 90-day artifact retention rather than manufacturing a multi-year retention claim that this repository cannot prove.

Any requirement for multi-year compliance-record retention needs a separately admitted durable archive or records system with independently verified retention, integrity, access, and replay properties. That external archival capability is outside this PR.

## Changes

### Canonical repository security policy

`SECURITY.md` is now the canonical repository security policy. It defines:

- repository security scope;
- private vulnerability-reporting expectations;
- required report content;
- severity-driven triage and remediation;
- supported-code semantics;
- coordinated disclosure; and
- the evidence boundary between repository readiness checks and organizational ISO/IEC 27001 certification.

### Permanent repository-readiness guard

`.github/workflows/iso27001-repository-readiness.yml` adds a fail-closed repository-control gate that:

- runs on pull requests targeting `main`, pushes to `main`, and manual dispatch;
- admits the pull-request head SHA (or push SHA) as the subject;
- checks out that exact subject rather than accepting GitHub's synthetic PR merge commit as the crowned object;
- asserts `git rev-parse HEAD` equals the admitted subject before validation;
- validates five repository evidence controls: security policy, code ownership, security-integrated workflows, workflow permissions, and cryptographic-control indicators;
- emits a machine-readable JSON receipt containing admitted subject, executed subject, workflow SHA, score, control states, and standing;
- uploads the receipt as transient CI evidence; and
- explicitly states that repository readiness is not an accredited ISO/IEC 27001 audit or certification.

## Verification model

A full local Git checkout was attempted from the agent execution environment but GitHub DNS resolution was unavailable there, so full-checkout local transport was classified as blocked rather than silently replaced with a claim of execution.

A dependency-closed sparse replay was then constructed from exact repository objects needed by the verifier. The same five predicates evaluated as:

- security policy: true;
- code ownership: true;
- security-integrated workflows: true;
- workflow permissions: true;
- cryptographic indicators: true;
- failures: 0; and
- score: 100.

That replay is useful local validation but is not the final crown. Final standing requires an observed hosted workflow execution in which the admitted subject and executed subject are the exact same PR-head SHA.

## Evidence limitations

This remediation establishes repository-level security-policy evidence and a reproducible repository-readiness verifier. It does not establish organizational ISO/IEC 27001 certification, an accredited audit result, or complete operation of an information security management system (ISMS).

Organizational ISMS scope, risk assessment and treatment, statement of applicability, operating evidence, internal audit, management review, corrective action, certification evidence, and any durable multi-year records archive remain outside this repository-level check unless separately admitted and verified.