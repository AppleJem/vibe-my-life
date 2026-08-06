/**
 * One-off migration for the habit-group and habit-colour reshape.
 *
 *   pnpm --filter backend exec tsx scripts/migrate-habits.ts          # dry run
 *   pnpm --filter backend exec tsx scripts/migrate-habits.ts --apply  # write
 *
 * Two changes, both on habit definitions (`SK = META#<id>`):
 *
 *   1. `group` was free text on each habit. Every distinct string per user becomes one
 *      `HABIT_GROUP#<uuid>` item, and the habit points at it through `groupId` instead.
 *      Order is seeded from the order the habits came back in, which is what the list page
 *      was already showing.
 *   2. `color` was a palette key ("pink"). It becomes the hex that key used to resolve to.
 *
 * Idempotent: a habit with no `group` and a hex `color` is left alone, so re-running after
 * a partial failure finishes the job rather than duplicating groups. Groups are matched by
 * name against ones already present for exactly that reason.
 */
// Must precede the db import: `config/env.ts` validates on load, and the server picks this
// up from `index.ts`, which a script never goes through.
import 'dotenv/config'
import { ScanCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'
import { docClient, HABIT_TABLE_NAME } from '../src/config/db.js'
import type { Habit, HabitGroup } from '../src/modules/habit/habit.types.d.js'

const APPLY = process.argv.includes('--apply')

/** What each palette key used to render as, taken from the old Tailwind classes. */
const LEGACY_COLORS: Record<string, string> = {
  pink: '#ec4899',
  cyan: '#22d3ee',
  violet: '#a78bfa',
  lime: '#a3e635',
  amber: '#fbbf24',
  sky: '#38bdf8',
}

const DEFAULT_COLOR = LEGACY_COLORS.pink
const HEX = /^#[0-9a-f]{6}$/i

/** A habit as it may still be stored: with the pre-migration `group` string. */
type LegacyHabit = Habit & { group?: string; PK: string; SK: string }
type StoredGroup = HabitGroup & { PK: string; SK: string }

/** The whole habit table. It is small, and there is no key to query users by. */
async function scanAll(): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = []
  let lastKey: Record<string, unknown> | undefined

  do {
    const result = await docClient.send(new ScanCommand({
      TableName: HABIT_TABLE_NAME,
      ExclusiveStartKey: lastKey,
    }))

    items.push(...(result.Items ?? []))
    lastKey = result.LastEvaluatedKey
  } while (lastKey)

  return items
}

const items = await scanAll()

const habits = items.filter((item) => String(item.SK).startsWith('META#')) as LegacyHabit[]
const existingGroups = items.filter(
  (item) => String(item.SK).startsWith('HABIT_GROUP#')
) as StoredGroup[]

/** Group habits by their partition key — one bucket per user. */
const byUser = new Map<string, LegacyHabit[]>()
for (const habit of habits) {
  const bucket = byUser.get(habit.PK)
  if (bucket) bucket.push(habit)
  else byUser.set(habit.PK, [habit])
}

console.log(
  `${habits.length} habit definition(s) across ${byUser.size} user(s); ` +
  `${existingGroups.length} group(s) already exist\n` +
  `${APPLY ? 'APPLYING CHANGES' : 'DRY RUN — pass --apply to write'}\n`
)

let groupsCreated = 0
let habitsRewritten = 0

for (const [pk, userHabits] of byUser) {
  // Names are matched case-insensitively so a re-run doesn't mint a second "Rehab"
  // alongside "rehab" — the free-text field never enforced a casing rule.
  const groupsByName = new Map<string, string>()
  for (const group of existingGroups) {
    if (group.PK === pk) groupsByName.set(group.name.toLowerCase(), group.id)
  }

  /** Groups minted in this pass, so their `habitIds` can be filled in afterwards. */
  const pending = new Map<string, { group: HabitGroup; habitIds: string[] }>()
  let userGroups = 0
  let userHabitsRewritten = 0

  for (const habit of userHabits) {
    const legacyGroup = habit.group?.trim()
    const needsColor = !HEX.test(habit.color ?? '')

    if (!legacyGroup && !needsColor) continue

    let groupId: string | undefined

    if (legacyGroup) {
      const key = legacyGroup.toLowerCase()
      groupId = groupsByName.get(key)

      if (!groupId) {
        const group: HabitGroup = {
          id: uuidv4(),
          name: legacyGroup,
          habitIds: [],
          createdAt: new Date().toISOString(),
        }

        groupsByName.set(key, group.id)
        pending.set(group.id, { group, habitIds: [] })
        groupId = group.id
        userGroups++
      }

      pending.get(groupId)?.habitIds.push(habit.id)
    }

    const color = needsColor
      ? LEGACY_COLORS[habit.color as string] ?? DEFAULT_COLOR
      : habit.color

    userHabitsRewritten++

    if (!APPLY) continue

    const sets = ['#color = :color']
    const names: Record<string, string> = { '#color': 'color' }
    const values: Record<string, unknown> = { ':color': color }

    if (groupId) {
      sets.push('#groupId = :groupId')
      names['#groupId'] = 'groupId'
      values[':groupId'] = groupId
    }

    // `group` goes in the same write as `groupId`, so a habit is never briefly in both
    // shapes — and a habit that had no group simply has nothing to remove.
    const removes = legacyGroup ? ' REMOVE #group' : ''
    if (legacyGroup) names['#group'] = 'group'

    await docClient.send(new UpdateCommand({
      TableName: HABIT_TABLE_NAME,
      Key: { PK: habit.PK, SK: habit.SK },
      UpdateExpression: `SET ${sets.join(', ')}${removes}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }))
  }

  if (APPLY) {
    // Written after the habits: an order entry pointing at a habit that never got its
    // `groupId` would be the worse half-state, and the reader ignores unresolvable ids.
    for (const { group, habitIds } of pending.values()) {
      await docClient.send(new PutCommand({
        TableName: HABIT_TABLE_NAME,
        Item: { PK: pk, SK: `HABIT_GROUP#${group.id}`, ...group, habitIds },
      }))
    }
  }

  groupsCreated += userGroups
  habitsRewritten += userHabitsRewritten

  if (userGroups > 0 || userHabitsRewritten > 0) {
    console.log(`${pk}: ${userGroups} group(s) created, ${userHabitsRewritten} habit(s) rewritten`)
    for (const { group, habitIds } of pending.values()) {
      console.log(`    "${group.name}" → ${habitIds.length} habit(s)`)
    }
  }
}

console.log(
  `\n${groupsCreated} group(s), ${habitsRewritten} habit(s)` +
  `${APPLY ? ' written' : ' would change'}`
)
