## Purpose

Lets users see, at a glance from the main grid, how long it has been since data was last imported from a spreadsheet for their current business system — so they can judge whether what they're looking at is fresh or stale without navigating away to the import history page.

## Requirements

### Requirement: Last applied import timestamp is queryable per system
The system SHALL provide a way for an authenticated user to retrieve the timestamp of the most recently **applied** import for their effective business system (as determined by the same tenant-isolation rules used elsewhere in the product).

Only import sessions that have been applied (not merely previewed/uploaded) count. If a session was uploaded but never applied, it SHALL NOT be considered.

#### Scenario: An applied import exists for the caller's system
- **WHEN** an authenticated user requests the last import status and at least one import has been applied for their effective system
- **THEN** the system returns the timestamp of the most recently applied import for that system

#### Scenario: No import has ever been applied for the caller's system
- **WHEN** an authenticated user requests the last import status and no import has ever been applied for their effective system
- **THEN** the system returns an explicit "no import yet" result rather than an error, so the caller can render an appropriate empty state

#### Scenario: Import sessions from another system are not returned
- **WHEN** an authenticated user's effective system is "星光" and the most recent applied import belongs to "太陽"
- **THEN** the system does not return the "太陽" import's timestamp as if it were the user's most recent import — it returns the most recent applied import that actually belongs to "星光", or "no import yet" if none exists

#### Scenario: Unauthenticated access is rejected
- **WHEN** a request for the last import status is made without a valid session
- **THEN** the system rejects the request and does not reveal any import timestamp

### Requirement: Elapsed time since last import is shown next to the data freshness indicator
The main student grid SHALL display, adjacent to the existing "last updated" timestamp, a human-readable elapsed-time indicator showing how long it has been since the last applied import for the current system (e.g., in days and hours, or minutes when under an hour).

#### Scenario: Import happened more than a day ago
- **WHEN** the last applied import for the current system was more than 24 hours ago
- **THEN** the indicator shows the elapsed time in whole days and hours (e.g., "距上次匯入 2 天 5 小時")

#### Scenario: Import happened less than an hour ago
- **WHEN** the last applied import for the current system was less than 60 minutes ago
- **THEN** the indicator shows the elapsed time in minutes (e.g., "距上次匯入 12 分鐘")

#### Scenario: No import has ever been applied
- **WHEN** no import has ever been applied for the current system
- **THEN** the indicator shows a distinct message indicating no import has occurred, rather than a numeric elapsed time or an error

#### Scenario: Displayed elapsed time stays current without manual refresh
- **WHEN** a user keeps the grid open without reloading the page
- **THEN** the displayed elapsed time keeps advancing (e.g., an indicator that read "5 分鐘" eventually reads "6 分鐘") without requiring the user to refresh the page or re-trigger a data fetch

### Requirement: Switching business system updates the elapsed-time indicator
The elapsed-time indicator SHALL reflect the currently active business system, consistent with how the rest of the grid's data scopes to the active system.

#### Scenario: Superadmin switches system
- **WHEN** a superadmin user switches the active system from "星光" to "太陽"
- **THEN** the elapsed-time indicator updates to reflect "太陽"'s most recent applied import, not "星光"'s
</content>
