# Product Scope

## What the app does
Hockey Dashboard is a draft-day decision tool.
It helps a solo user review league snapshots, validate trust in the data, and quickly inspect player and owner context.

## Primary use case
A laptop-first draft aid that supports:
- Best Available review
- owner and roster context
- player lookup
- trust/validation checks
- portable saved-state handoff between devices

## Phone role
Phone access is a backup lookup mode.
It is useful for checking player context, availability, and snapshot freshness when you are away from your main laptop.
It is not the primary editing or assignment workflow.

## What matters for the next draft
- reliable launch on a fresh machine
- clear trust/freshness signals
- portable saved state
- simple CSV refresh workflow
- less surface area during live decisions

## What the app does not do
- It does not replace the authoritative league sheet.
- It does not require a backend.
- It does not require live NHL API availability.
- It is not trying to make the phone the main drafting interface.
- It is not a real-time synced draft execution platform.

## Product rule
The product should answer only:
- Who is available?
- Who owns what?
- What is this player’s draft value/context?
- Can I trust this data right now?
