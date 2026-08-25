# ISO 27001 Repository-Control Remediation Receipt

Date: 2026-08-25
Repository: `seanchatmangpt/unjucks`
Historical failing run: `17598484165`
Historical failing commit: `7b932ce3b63d36df221627a649b00524ba84e9a9`
Remediation base: `5ecffdee7b02a407951db5918b3dafd28184d7b2`

## Status before remediation

The historical `ISO 27001 Compliance` job failed while the SOX, PCI-DSS, GDPR, setup, and evidence-collection jobs succeeded.

The historical workflow artifacts and job logs have expired, so this remediation does not claim access to those unavailable records. The failure was reconstructed from the exact historical workflow definition and repository tree.

## Root cause

The ISO Annex A.5 repository probe in `.github/workflows/compliance-automation.yml` treats either `SECURITY.md` or `.github/SECURITY.md` as the required information-security-policy evidence.

Neither path existed at the historical failing commit. The same gap remained on the remediation base.

The workflow scores eight controls and requires a 95% score. A single hard failure therefore yields 87% and fails the job.

## Change

`SECURITY.md` is now the canonical repository security policy. It defines:

- the repository security scope;
- private vulnerability-reporting expectations;
- required report content;
- severity-driven triage and remediation;
- supported-code semantics;
- coordinated disclosure;
- the evidence boundary between repository readiness checks and actual organizational ISO/IEC 27001 certification.

## Expected verifier transition

For the current ISO job logic, adding `SECURITY.md` removes the A.5 hard failure. Existing repository evidence already satisfies the other hard probes used by that job: code ownership, security-integrated workflows, workflow permissions, and cryptographic-control indicators.

Expected result on the remediation head: zero hard failures and a computed repository-readiness score of 100%.

This expectation is not the final receipt. The final receipt is an observed successful workflow execution against the exact remediation head.

## Evidence limitations

The automated workflow is a repository-level heuristic. It is not an accredited ISO/IEC 27001 audit and must not be represented as certification. Organizational ISMS scope, risk assessment and treatment, statement of applicability, operating evidence, internal audit, management review, corrective action, and certification evidence remain outside this repository-level check unless separately admitted and verified.