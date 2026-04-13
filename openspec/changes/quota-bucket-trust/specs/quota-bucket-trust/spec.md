## ADDED Requirements

### Requirement: Quota summary MUST distinguish trusted bucket-scoped capacity from raw key counts
The key-manager summary API SHALL separate raw per-key statuses from bucket-trusted availability.

#### Scenario: Keys are missing quota bucket tags
- **WHEN** one or more keys have no bucket tag / project tag assigned
- **THEN** the summary reports them as unscoped
- **AND** those keys do not contribute to trusted available capacity

#### Scenario: Keys in the same bucket disagree on quota state
- **WHEN** multiple keys assigned to the same bucket report conflicting quota statuses
- **THEN** that bucket is marked as mixed/untrusted
- **AND** the summary surfaces a warning explaining that quota trust is compromised

### Requirement: Legacy statuses MUST be normalized
Data stored with old status names SHALL still produce correct API summaries.

#### Scenario: Database contains `active` or `cooldown`
- **WHEN** the summary/list/export endpoints read those keys
- **THEN** `active` behaves as `available`
- **AND** `cooldown` behaves as `rate_limited`

### Requirement: Trusted export MUST be available for consumers
The export API SHALL provide a way for consumers to request only trusted keys.

#### Scenario: Consumer requests trusted-only export
- **WHEN** `/api/keys/export?trusted_only=1` is called
- **THEN** only keys from `scoped` buckets with trusted `available` status are returned
- **AND** the response includes warnings about unscoped or mixed buckets

### Requirement: UI MUST explain quota bucket tagging
The web dashboard SHALL make it clear that the `projects` tag controls quota-bucket trust.

#### Scenario: User adds or edits a key
- **WHEN** the user opens add/edit/batch import flows
- **THEN** the UI explains that keys sharing the same Google project / quota bucket must use the same tag
