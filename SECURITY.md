# Security policy

## Supported versions

Only the latest release of the 1132 Fixer browser extension (every browser target is built from
the same source tree and version) receives security fixes.

## Reporting a vulnerability

Please report security issues **privately**. Do not open a public issue for a
vulnerability.

Use GitHub's private vulnerability reporting: open the repository's **Security**
tab and choose **Report a vulnerability**. You will get an acknowledgment within
seven days.

Public issues are fine for everything that is not a security risk — see
[SUPPORT.md](SUPPORT.md).

## Scope

The extension runs locally and touches only Zoom-origin browser state (cookies
plus the active Zoom tab's site data), and only after the user presses
**FIX ZOOM**. It does not perform the Windows `user1` / isolated-profile
repair. The one networked surface is the Report-a-Bug page, which talks only
to the project's support service and only when you submit a report. Reports
about any behavior outside that boundary — unexpected network traffic, access
to non-Zoom data, or data leaving the browser — are exactly what this policy
is for.
