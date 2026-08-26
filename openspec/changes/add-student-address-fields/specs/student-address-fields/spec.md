## Purpose

Lets the system capture and store each student's geographic location (county, district, and street address) from the import spreadsheet, so this information is available in the system without cluttering the default grid view — it stays hidden until a user deliberately opts to see it.

## ADDED Requirements

### Requirement: County, district, and address are captured during import
The import pipeline SHALL extract a student's county (縣市), district/area (地區), and street address (地址) from the source spreadsheet when those columns are present, using the same header-text detection mechanism already used for other importable fields (so column position drift in the source file does not silently break extraction, as long as the header text matches).

#### Scenario: Source file contains all three columns with recognized headers
- **WHEN** an xlsx file is imported and its header row contains columns matching the recognized county/district/address header text
- **THEN** each student row's county, district, and address values are captured from those columns, regardless of which column position they appear in

#### Scenario: Source file is missing one or more of these columns
- **WHEN** an xlsx file is imported and does not contain a column with a recognized header for county, district, or address
- **THEN** the corresponding field(s) are left empty (not populated) for all rows, and the import does not fail or skip rows because of this

#### Scenario: A student row has some address fields populated and others blank
- **WHEN** a student row has a value in the address column but the county or district cell is blank
- **THEN** only the populated field(s) are stored; blank cells result in an empty (not synthesized) value

### Requirement: County, district, and address are stored per student
The system SHALL persist a student's county, district, and address as part of their record, distinct from the existing organizational "region" (輔導區域/關懷區域) field — these are unrelated concepts and must not overwrite or be conflated with each other.

#### Scenario: Existing organizational region field is unaffected
- **WHEN** a student's county/district/address are imported or edited
- **THEN** the student's existing organizational region value (輔導區域/關懷區域, displayed as "地區") is unchanged

### Requirement: Address fields are hidden by default and can be shown via column settings
The main student grid SHALL NOT display the county, district, or address columns by default when a user first loads the page. A user SHALL be able to reveal these columns through the existing column-visibility settings control, using the same mechanism already used to show/hide other optional columns.

#### Scenario: First page load shows the grid without address columns
- **WHEN** a user loads the student grid for the first time (no prior column-visibility preference)
- **THEN** the county, district, and address columns are not visible in the grid

#### Scenario: User enables address columns via column settings
- **WHEN** a user opens the column-visibility settings panel and enables the county, district, or address column
- **THEN** that column becomes visible in the grid

#### Scenario: Address column labels do not collide with the existing organizational "region" column
- **WHEN** a user views the column settings panel or column headers
- **THEN** the new district/address-related column is labeled distinctly from the existing organizational region column (which remains labeled "地區"), so a user can tell the two apart
